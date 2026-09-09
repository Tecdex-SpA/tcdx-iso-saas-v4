'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const tenantContextStorage = new AsyncLocalStorage();
const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
  'platform_scheduler',
  'platform_worker',
  'migration_runner',
]);

function normalizeUuid(value, fieldName = 'tenant_id') {
  const normalized = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    const error = new Error(`${fieldName} must be a valid UUID`);
    error.code = 'TENANT_CONTEXT_INVALID';
    throw error;
  }
  return normalized;
}

function assertTenantContext(context = {}) {
  if (context.platformScope === true) {
    const error = new Error('platform scope requires explicit platform DB context');
    error.code = 'TENANT_CONTEXT_PLATFORM_SCOPE_FORBIDDEN';
    throw error;
  }

  const tenantId = context.tenantId || context.tenant_id || null;

  return {
    tenantId: normalizeUuid(tenantId),
    platformScope: false,
    role: context.role || 'tenant_runtime',
  };
}

function assertPlatformContext(context = {}) {
  const role = String(context.role || 'platform_admin').trim() || 'platform_admin';
  const normalizedRole = role.toLowerCase();
  if (!PLATFORM_ROLES.has(normalizedRole)) {
    const error = new Error('platform DB context requires an explicit platform role');
    error.code = 'PLATFORM_CONTEXT_ROLE_REQUIRED';
    throw error;
  }

  if (context.tenantId || context.tenant_id) {
    const error = new Error('platform DB context must not carry tenant_id');
    error.code = 'PLATFORM_CONTEXT_TENANT_FORBIDDEN';
    throw error;
  }

  return {
    tenantId: '',
    platformScope: true,
    role,
    reason: String(context.reason || 'platform_operation').trim() || 'platform_operation',
  };
}

async function setLocalTenantContext(client, context = {}) {
  const normalized = context.platformScope === true
    ? assertPlatformContext(context)
    : assertTenantContext(context);
  await client.query(
    `SELECT
       set_config('app.tenant_id', $1, true),
       set_config('app.platform_scope', $2, true),
       set_config('app.runtime_role', $3, true)`,
    [
      normalized.tenantId,
      normalized.platformScope ? 'true' : 'false',
      normalized.role,
    ],
  );
  return normalized;
}

async function withTenantTransaction(pool, context, callback) {
  const requestedContext = assertTenantContext(context);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const normalizedContext = await setLocalTenantContext(client, requestedContext);
    const result = await callback(client, normalizedContext);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function withPlatformTransaction(pool, context, callback) {
  const requestedContext = assertPlatformContext(context);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const normalizedContext = await setLocalTenantContext(client, requestedContext);
    const result = await callback(client, normalizedContext);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

function currentDbTenantContext() {
  return tenantContextStorage.getStore() || null;
}

function runWithDbTenantContext(context, callback) {
  const normalizedContext = assertTenantContext(context);
  return tenantContextStorage.run(normalizedContext, callback);
}

function runWithPlatformDbContext(context, callback) {
  const normalizedContext = assertPlatformContext(context);
  return tenantContextStorage.run(normalizedContext, callback);
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(String(role || '').trim().toLowerCase());
}

function tenantContextMiddleware(req, _res, next) {
  const role = req.user?.role || req.user?.user_role || req.user?.userRole || 'tenant_runtime';
  if (isPlatformRole(role)) {
    return next();
  }

  const tenantId = req.resolvedTenantId || getUserTenantId(req.user);
  if (!tenantId) {
    return next();
  }

  return runWithDbTenantContext({ tenantId, role }, () => next());
}

function sqlText(args) {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first && typeof first.text === 'string') return first.text;
  return '';
}

function isBegin(sql) {
  return /^\s*BEGIN\b/i.test(sql);
}

function isTransactionControl(sql) {
  return /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE\s+SAVEPOINT|ROLLBACK\s+TO\s+SAVEPOINT)\b/i.test(sql);
}

function callbackFromArgs(args) {
  const maybeCallback = args[args.length - 1];
  return typeof maybeCallback === 'function' ? maybeCallback : null;
}

function withoutCallback(args) {
  return callbackFromArgs(args) ? args.slice(0, -1) : args;
}

function callbackResult(promise, callback) {
  if (!callback) return promise;
  promise.then((result) => callback(null, result), (error) => callback(error));
  return undefined;
}

function patchClient(client) {
  if (!client || client.__tcdxTenantContextClient) {
    return client;
  }

  const originalQuery = client.query.bind(client);
  client.query = function tenantAwareClientQuery(...args) {
    const callback = callbackFromArgs(args);
    const queryArgs = withoutCallback(args);
    const sql = sqlText(queryArgs);
    const promise = Promise.resolve()
      .then(() => originalQuery(...queryArgs))
      .then(async (result) => {
        const context = currentDbTenantContext();
        if (context && isBegin(sql)) {
          await setLocalTenantContext({ query: originalQuery }, context);
        }
        return result;
      });
    return callbackResult(promise, callback);
  };
  client.__tcdxTenantContextClient = true;
  return client;
}

function createTenantAwarePool(pool) {
  if (!pool || pool.__tcdxTenantContextPool) {
    return pool;
  }

  if (typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    return pool;
  }

  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);

  pool.query = function tenantAwarePoolQuery(...args) {
    const context = currentDbTenantContext();
    const callback = callbackFromArgs(args);
    const queryArgs = withoutCallback(args);
    const sql = sqlText(queryArgs);

    if (!context || isTransactionControl(sql)) {
      return callbackResult(Promise.resolve().then(() => originalQuery(...queryArgs)), callback);
    }

    const promise = (async () => {
      const client = await originalConnect();
      try {
        await client.query('BEGIN');
        await setLocalTenantContext(client, context);
        const result = await client.query(...queryArgs);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => null);
        throw error;
      } finally {
        client.release();
      }
    })();

    return callbackResult(promise, callback);
  };

  pool.connect = function tenantAwarePoolConnect(callback) {
    const promise = Promise.resolve()
      .then(() => originalConnect())
      .then((client) => patchClient(client));
    if (!callback) return promise;
    promise.then(
      (client) => callback(null, client, client.release.bind(client)),
      (error) => callback(error),
    );
    return undefined;
  };

  pool.__tcdxTenantContextPool = true;
  return pool;
}

module.exports = {
  assertPlatformContext,
  assertTenantContext,
  createTenantAwarePool,
  currentDbTenantContext,
  runWithDbTenantContext,
  runWithPlatformDbContext,
  setLocalTenantContext,
  tenantContextMiddleware,
  withPlatformTransaction,
  withTenantTransaction,
};
