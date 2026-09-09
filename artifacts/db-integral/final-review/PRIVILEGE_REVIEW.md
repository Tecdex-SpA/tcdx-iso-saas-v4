# Privilege Review

Status: PASS.

Static and effective ACL gates:

- `PRODUCTION_ROLE_PRIVILEGES STATIC PASS`.
- `MIGRATION_ADMIN_BOOTSTRAP PASS`.
- `R00 FUNCTION_EXECUTE_ALLOWLIST PASS`.
- `R01 BACKEND_DML PASS`.
- `R02 BACKEND_ADMIN_DML_DENIED PASS`.
- `R03_R04 SUPPORT_READ_ONLY PASS`.
- `R05 AI_READER_SAFE_DEFER PASS`.
- `R06 PLATFORM_CATALOG_ONLY PASS`.
- `R07_R08 NO_BYPASSRLS_NO_DDL PASS`.
- `VERSIONED_REFERENCE_READ_ONLY_ACL PASS`.
- `PRODUCTION_ROLE_PRIVILEGES EFFECTIVE PASS`.

Key findings:

- No runtime role receives `BYPASSRLS`, superuser, createdb or createrole.
- No runtime role receives broad `GRANT EXECUTE ON ALL FUNCTIONS`.
- Default function EXECUTE is revoked from `PUBLIC` for `public` and `tcdx_security`.
- `tcdx_backend_runtime` gets only explicit `tcdx_security.*` and DB-N02 Health helper functions.
- `tcdx_platform_runtime` gets only explicit `tcdx_security.*` functions.
- `tcdx_readonly_support` and `ai_reader` execute no app-owned functions.
- `ai_reader` has no direct SELECT grants while `AI_READER_RLS_DEFERRED` remains in force.
