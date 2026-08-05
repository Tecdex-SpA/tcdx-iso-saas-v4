type ReportCatalogResponse = {
  typesJson: unknown;
  clientsJson: unknown;
  typesStatus: number;
  clientsStatus: number;
};

type CacheEntry = {
  expiresAt: number;
  promise: Promise<ReportCatalogResponse>;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

function buildKey(token: string) {
  return token.slice(-48);
}

export function clearReportCatalogBootstrapCache(token?: string) {
  if (!token) {
    cache.clear();
    return;
  }

  cache.delete(buildKey(token));
}

export function fetchReportCatalogBootstrap({
  apiUrl,
  token,
  locale,
}: {
  apiUrl: string;
  token: string;
  locale: string;
}) {
  const key = buildKey(token);
  const now = Date.now();
  const existing = cache.get(key);

  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'x-tcdx-locale': locale,
  };

  const promise = Promise.all([
    fetch(`${apiUrl}/api/reports/types?locale=${encodeURIComponent(locale)}`, { headers }),
    fetch(`${apiUrl}/api/reports/clients?locale=${encodeURIComponent(locale)}`, { headers }),
  ])
    .then(async ([typesRes, clientsRes]) => ({
      typesJson: await typesRes.json(),
      clientsJson: await clientsRes.json(),
      typesStatus: typesRes.status,
      clientsStatus: clientsRes.status,
    }))
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    promise,
  });

  return promise;
}
