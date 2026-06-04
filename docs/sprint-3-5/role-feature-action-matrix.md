# Role / Feature / Action Matrix

| Role | Read library | Manage sources | Associate | Analyze | Accept/reject suggestions |
|---|---:|---:|---:|---:|---:|
| admin / tenant_admin | Yes | Yes | Yes | Yes | Yes |
| auditor | Yes | No | No | No | No |
| responsable_area / operativo | Yes | No | No | No | No |
| ejecutivo_cliente | No | No | No | No | No |
| dealer | No | No | No | No | No |
| superadmin | Internal only | Internal only | Internal only | Internal only | Internal only |

Backend enforcement:

- read roles: `admin`, `tenant_admin`, `auditor`, `responsable_area`, `area_owner`, `operativo`;
- manage roles: `admin`, `tenant_admin`.

