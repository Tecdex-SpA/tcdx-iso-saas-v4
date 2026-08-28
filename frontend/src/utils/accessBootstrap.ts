type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type AccessBootstrapRegistry = {
  generation: number;
  responseCache: Map<string, CacheEntry<unknown>>;
  pendingRequests: Map<string, Promise<unknown>>;
};

const DEFAULT_TTL_MS = 30_000;
const REGISTRY_KEY = '__tcdxAccessBootstrapRegistry__';

function getRegistry(): AccessBootstrapRegistry {
  const globalScope = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: AccessBootstrapRegistry;
  };

  if (!globalScope[REGISTRY_KEY]) {
    globalScope[REGISTRY_KEY] = {
      generation: 0,
      responseCache: new Map<string, CacheEntry<unknown>>(),
      pendingRequests: new Map<string, Promise<unknown>>(),
    };
  }

  return globalScope[REGISTRY_KEY];
}

function getActiveTenantContext() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('activeTenantId') || '';
}

function makeCacheKey(token: string, url: string) {
  return `${token}:${getActiveTenantContext()}:${url}`;
}

function getRetryAfterSeconds(response: Response) {
  const value = Number(response.headers.get('retry-after') || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function fetchAccessBootstrap<T>({
  token,
  url,
  ttlMs = DEFAULT_TTL_MS,
  fallbackError,
  invalidResponseError,
}: {
  token: string;
  url: string;
  ttlMs?: number;
  fallbackError: string;
  invalidResponseError: (status: number) => string;
}): Promise<T> {
  const registry = getRegistry();
  const { responseCache, pendingRequests } = registry;
  const requestGeneration = registry.generation;
  const cacheKey = makeCacheKey(token, url);
  const cached = responseCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = pendingRequests.get(cacheKey) as Promise<T> | undefined;
  if (pending) return pending;

  const request = (async (): Promise<T> => {
    const activeTenantId = getActiveTenantContext();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeTenantId ? { 'X-Tenant-Id': activeTenantId } : {}),
      },
    });

    const text = await response.text();
    let payload: (T & {
      ok?: boolean;
      error?: string;
      message?: string;
      code?: string;
    }) | null = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(invalidResponseError(response.status));
    }

    if (response.status === 429) {
      const retryAfter = getRetryAfterSeconds(response);
      const suffix = retryAfter ? ` Reintenta en ${retryAfter} segundos.` : '';
      throw new Error(`${payload?.message || payload?.error || fallbackError}${suffix}`);
    }

    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload?.error || payload?.message || fallbackError);
    }

    if (registry.generation === requestGeneration) {
      responseCache.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + Math.max(1_000, ttlMs),
      });
    }

    return payload;
  })();

  pendingRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

export function clearAccessBootstrapCache() {
  const registry = getRegistry();
  const { responseCache, pendingRequests } = registry;
  registry.generation += 1;
  responseCache.clear();
  pendingRequests.clear();
}
