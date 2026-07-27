const { sha256 } = require('./phase2Rules');

const PROVIDER_ALIASES = Object.freeze({
  microsoft_graph: 'microsoft',
  microsoft_365: 'microsoft',
  entra_id: 'microsoft',
  onedrive: 'microsoft',
  sharepoint: 'microsoft',
  google_workspace: 'google',
  google_drive: 'google',
  jira: 'jira_confluence',
  confluence: 'jira_confluence',
  github: 'github',
});

function isoNow(clock) {
  return new Date(clock()).toISOString();
}

function sandboxRecords(provider, clock = Date.now) {
  const observedAt = isoNow(clock);
  const fixtures = {
    microsoft: [
      { type: 'identity_user', id: 'ms-user-inactive-1', version: '1', data: { display_name: 'Cuenta inactiva controlada', active: false, privileged: false, mfa: true } },
      { type: 'identity_user', id: 'ms-user-privileged-1', version: '1', data: { display_name: 'Cuenta privilegiada controlada', active: true, privileged: true, mfa: false } },
      { type: 'document', id: 'ms-document-1', version: '3', data: { name: 'Evidencia Microsoft controlada.pdf', owner: 'qa-owner', mime_type: 'application/pdf', source: 'sharepoint' } },
    ],
    google: [
      { type: 'identity_user', id: 'google-user-inactive-1', version: '1', data: { display_name: 'Usuario Google inactivo controlado', active: false, privileged: false, mfa: true } },
      { type: 'identity_group', id: 'google-group-1', version: '2', data: { name: 'security-reviewers', members: 3 } },
      { type: 'document', id: 'google-document-1', version: '4', data: { name: 'Evidencia Google controlada.pdf', owner: 'qa-owner', mime_type: 'application/pdf', source: 'drive' } },
    ],
    jira_confluence: [
      { type: 'issue', id: 'JIRA-QA-1', version: '5', data: { key: 'JIRA-QA-1', title: 'Remedial externo controlado', status: 'in_progress', overdue: true, assignee: 'qa-owner' } },
      { type: 'comment', id: 'JIRA-QA-1-C1', version: '1', data: { issue: 'JIRA-QA-1', body: 'Comentario de trazabilidad controlado' } },
      { type: 'document', id: 'CONF-QA-1', version: '7', data: { name: 'Página Confluence controlada', owner: 'qa-owner', mime_type: 'text/html', source: 'confluence' } },
    ],
    github: [
      { type: 'repository', id: 'github-repo-1', version: '1', data: { name: 'sandbox-repository', visibility: 'private', default_branch: 'main' } },
      { type: 'branch_protection', id: 'github-repo-1:main', version: '1', data: { repository: 'sandbox-repository', branch: 'main', protected: false, required_reviews: 0 } },
      { type: 'security_alert', id: 'github-alert-1', version: '1', data: { repository: 'sandbox-repository', severity: 'high', state: 'open', dependency: 'controlled-package' } },
    ],
  };
  return (fixtures[PROVIDER_ALIASES[provider]] || []).map(record => ({
    ...record,
    observed_at: observedAt,
    provenance: {
      provider,
      mode: 'sandbox',
      adapter_version: '1.0.0',
      controlled_fixture: true,
    },
  }));
}

function bearerHeaders(credentials = {}, extra = {}) {
  const token = String(credentials.access_token || credentials.token || '').trim();
  if (!token) {
    const error = new Error('CONNECTOR_ACCESS_TOKEN_REQUIRED');
    error.code = 'CONNECTOR_ACCESS_TOKEN_REQUIRED';
    throw error;
  }
  return { Authorization: `Bearer ${token}`, Accept: 'application/json', ...extra };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(Number(options.timeoutMs || 15000)),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`CONNECTOR_HTTP_${response.status}`);
    error.code = `CONNECTOR_HTTP_${response.status}`;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return body;
}

async function microsoftRecords(credentials, cursor = {}) {
  const base = String(credentials.base_url || 'https://graph.microsoft.com/v1.0').replace(/\/$/, '');
  const body = await fetchJson(cursor.next_link || `${base}/users?$select=id,displayName,accountEnabled,userType`, {
    headers: bearerHeaders(credentials),
  });
  return {
    records: (body.value || []).map(item => ({
      type: 'identity_user',
      id: String(item.id),
      version: String(item['@odata.etag'] || '1'),
      observed_at: new Date().toISOString(),
      data: {
        display_name: item.displayName || item.userPrincipalName || item.id,
        active: item.accountEnabled !== false,
        privileged: item.userType === 'Member' && Boolean(item.onPremisesSyncEnabled),
        mfa: item.strongAuthenticationRequirements?.length > 0,
      },
      provenance: { provider: 'microsoft_graph', mode: 'live', endpoint: '/users', adapter_version: '1.0.0' },
    })),
    cursor: { next_link: body['@odata.nextLink'] || null },
  };
}

async function googleRecords(credentials) {
  const customer = encodeURIComponent(credentials.customer_id || 'my_customer');
  const body = await fetchJson(`https://admin.googleapis.com/admin/directory/v1/users?customer=${customer}&maxResults=200`, {
    headers: bearerHeaders(credentials),
  });
  return {
    records: (body.users || []).map(item => ({
      type: 'identity_user',
      id: String(item.id),
      version: String(item.etag || '1'),
      observed_at: new Date().toISOString(),
      data: {
        display_name: item.name?.fullName || item.primaryEmail || item.id,
        active: item.suspended !== true,
        privileged: item.isAdmin === true,
        mfa: item.isEnrolledIn2Sv === true,
      },
      provenance: { provider: 'google_workspace', mode: 'live', endpoint: '/admin/directory/v1/users', adapter_version: '1.0.0' },
    })),
    cursor: { page_token: body.nextPageToken || null },
  };
}

async function jiraConfluenceRecords(credentials) {
  const base = String(credentials.base_url || '').replace(/\/$/, '');
  if (!/^https:\/\//i.test(base)) {
    const error = new Error('CONNECTOR_BASE_URL_HTTPS_REQUIRED');
    error.code = 'CONNECTOR_BASE_URL_HTTPS_REQUIRED';
    throw error;
  }
  const headers = credentials.email && credentials.api_token
    ? {
      Authorization: `Basic ${Buffer.from(`${credentials.email}:${credentials.api_token}`).toString('base64')}`,
      Accept: 'application/json',
    }
    : bearerHeaders(credentials);
  const body = await fetchJson(`${base}/rest/api/3/search/jql?jql=updated%20%3E%3D%20-30d&maxResults=100`, { headers });
  return {
    records: (body.issues || []).map(item => ({
      type: 'issue',
      id: String(item.key || item.id),
      version: String(item.fields?.updated || '1'),
      observed_at: item.fields?.updated || new Date().toISOString(),
      data: {
        key: item.key,
        title: item.fields?.summary,
        status: item.fields?.status?.name,
        overdue: Boolean(item.fields?.duedate && new Date(item.fields.duedate) < new Date()),
        assignee: item.fields?.assignee?.displayName || null,
      },
      provenance: { provider: 'jira', mode: 'live', endpoint: '/rest/api/3/search/jql', adapter_version: '1.0.0' },
    })),
    cursor: { next_page_token: body.nextPageToken || null },
  };
}

async function githubRecords(credentials) {
  const body = await fetchJson('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: bearerHeaders(credentials, {
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tcdx-iso-saas-v4',
    }),
  });
  return {
    records: (Array.isArray(body) ? body : []).map(item => ({
      type: 'repository',
      id: String(item.id),
      version: String(item.updated_at || '1'),
      observed_at: item.updated_at || new Date().toISOString(),
      data: {
        name: item.full_name,
        visibility: item.visibility || (item.private ? 'private' : 'public'),
        default_branch: item.default_branch,
      },
      provenance: { provider: 'github', mode: 'live', endpoint: '/user/repos', adapter_version: '1.0.0' },
    })),
    cursor: {},
  };
}

function normalizeRecord(provider, record) {
  const normalized = {
    external_type: String(record.type || '').trim(),
    external_id: String(record.id || '').trim(),
    external_version: String(record.version || ''),
    observed_at: new Date(record.observed_at || Date.now()).toISOString(),
    data: record.data && typeof record.data === 'object' ? record.data : {},
    provenance: {
      ...(record.provenance || {}),
      provider,
      normalized_at: new Date().toISOString(),
      normalizer_version: 'phase2-normalizer-v1',
    },
  };
  if (!normalized.external_type || !normalized.external_id) {
    const error = new Error('CONNECTOR_RECORD_IDENTITY_REQUIRED');
    error.code = 'CONNECTOR_RECORD_IDENTITY_REQUIRED';
    throw error;
  }
  return {
    ...normalized,
    payload_hash: sha256({
      provider,
      external_type: normalized.external_type,
      external_id: normalized.external_id,
      external_version: normalized.external_version,
      observed_at: normalized.observed_at,
      data: normalized.data,
      source_provenance: record.provenance || {},
    }),
  };
}

async function pullConnectorRecords({ provider, mode, credentials = {}, cursor = {}, clock = Date.now }) {
  if (!PROVIDER_ALIASES[provider]) {
    const error = new Error(`CONNECTOR_PROVIDER_UNSUPPORTED:${provider}`);
    error.code = 'CONNECTOR_PROVIDER_UNSUPPORTED';
    throw error;
  }
  if (mode === 'sandbox') {
    return {
      records: sandboxRecords(provider, clock).map(record => normalizeRecord(provider, record)),
      cursor: { sandbox_completed_at: isoNow(clock) },
    };
  }
  const key = PROVIDER_ALIASES[provider];
  const result = key === 'microsoft'
    ? await microsoftRecords(credentials, cursor)
    : key === 'google'
      ? await googleRecords(credentials, cursor)
      : key === 'jira_confluence'
        ? await jiraConfluenceRecords(credentials, cursor)
        : await githubRecords(credentials, cursor);
  return {
    records: result.records.map(record => normalizeRecord(provider, record)),
    cursor: result.cursor || {},
  };
}

module.exports = {
  PROVIDER_ALIASES,
  normalizeRecord,
  pullConnectorRecords,
  sandboxRecords,
};
