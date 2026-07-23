-- Synthetic contract fixture for the Phase 1 migration gate.
-- Scope: only pre-existing tables, columns and roles referenced directly by
-- the Phase 1 migrations and PostgreSQL integration gate. It contains no tenant
-- data, customer content, credentials or secrets and is not an application seed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id), email text NOT NULL);
CREATE TABLE app_roles (role_key text PRIMARY KEY);
CREATE TABLE permissions (
  permission_key text PRIMARY KEY, permission_group text NOT NULL, display_name text NOT NULL,
  description text, is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE role_permissions (
  role_key text NOT NULL REFERENCES app_roles(role_key), permission_key text NOT NULL REFERENCES permissions(permission_key),
  is_allowed boolean NOT NULL DEFAULT TRUE, created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (role_key, permission_key)
);
CREATE TABLE saas_modules (
  module_key text PRIMARY KEY, display_name text NOT NULL, description text,
  default_enabled boolean NOT NULL DEFAULT TRUE, is_system boolean NOT NULL DEFAULT TRUE,
  is_active boolean NOT NULL DEFAULT TRUE, sort_order integer NOT NULL DEFAULT 100,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE tenant_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  module_key text NOT NULL REFERENCES saas_modules(module_key), is_enabled boolean NOT NULL DEFAULT TRUE,
  enabled_at timestamp, disabled_at timestamp, enabled_by uuid REFERENCES users(id), disabled_by uuid REFERENCES users(id),
  notes text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(), UNIQUE (tenant_id, module_key)
);
CREATE TABLE audit_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), table_name text NOT NULL, record_id uuid, tenant_id uuid,
  action text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), changed_by uuid,
  old_data jsonb, new_data jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE evidences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id));
CREATE TABLE tcdx_async_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL);
CREATE TABLE tenant_controls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id));
CREATE TABLE audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  iso text,
  status text,
  start_date date,
  end_date date,
  requester_name text,
  auditor_type text,
  auditor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE findings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  status text,
  priority text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_roles(role_key) VALUES
  ('admin'), ('tenant_admin'), ('admin_cumplimiento'), ('compliance_admin'),
  ('auditor'), ('operativo'), ('responsable_area'), ('area_owner');
