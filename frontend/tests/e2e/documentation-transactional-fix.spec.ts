import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Seed = { code: string; name: string; area: string; ops: Array<[string,string,string]> };
type Scenario = { key: string; email: string; standards: string[]; processes: Seed[] };

const root = path.resolve(__dirname, '../../..');
const outputRoot = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const transactionFile = path.resolve(root, 'artifacts/documentation/transactional-fix.json');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const writeEnabled = String(process.env.DOC_ENABLE_WRITES || '').toLowerCase() === 'true';
const results: unknown[] = [];

const scenarios: Scenario[] = [
  { key:'iso9001', email:'admin.demo9001@tcdx.demo', standards:['ISO9001'], processes:[
    {code:'DOC-QMS-COM',name:'Gestión comercial y contratos',area:'Comercial',ops:[['DOC-QMS-COM-01','Revisión de requisitos del cliente','Por contrato']]},
    {code:'DOC-QMS-OPS',name:'Prestación del servicio',area:'Operaciones',ops:[['DOC-QMS-OPS-01','Ejecución y registro del servicio','Diaria'],['DOC-QMS-OPS-02','Verificación de entrega y cierre','Por servicio']]},
    {code:'DOC-QMS-CAL',name:'Gestión de calidad',area:'Calidad',ops:[['DOC-QMS-CAL-01','Gestión de no conformidades','Continua'],['DOC-QMS-CAL-02','Auditoría interna del SGC','Semestral']]}
  ]},
  { key:'iso27001', email:'admin.demo27001@tcdx.demo', standards:['ISO27001'], processes:[
    {code:'DOC-ISMS-IAM',name:'Gestión de identidades y accesos',area:'Seguridad de la Información',ops:[['DOC-ISMS-IAM-01','Alta y modificación de accesos','Por solicitud'],['DOC-ISMS-IAM-02','Revisión periódica de permisos','Trimestral']]},
    {code:'DOC-ISMS-OPS',name:'Operación de infraestructura TI',area:'Tecnología',ops:[['DOC-ISMS-OPS-01','Ejecución y verificación de respaldos','Diaria'],['DOC-ISMS-OPS-02','Gestión de cambios de infraestructura','Por cambio']]},
    {code:'DOC-ISMS-SEC',name:'Gestión de seguridad de la información',area:'Seguridad de la Información',ops:[['DOC-ISMS-SEC-01','Revisión de controles de seguridad','Mensual'],['DOC-ISMS-SEC-02','Auditoría interna del SGSI','Semestral']]}
  ]},
  { key:'integrated', email:'admin.demoisos@tcdx.demo', standards:['ISO9001','ISO27001'], processes:[
    {code:'DOC-IMS-COM',name:'Gestión comercial y clientes',area:'Comercial',ops:[['DOC-IMS-COM-01','Revisión contractual','Por contrato']]},
    {code:'DOC-IMS-OPS',name:'Prestación de servicios',area:'Operaciones',ops:[['DOC-IMS-OPS-01','Prestación y registro del servicio','Diaria'],['DOC-IMS-OPS-02','Gestión de cambios del servicio','Por cambio']]},
    {code:'DOC-IMS-IT',name:'Gestión de tecnología',area:'Tecnología',ops:[['DOC-IMS-IT-01','Administración de accesos','Por solicitud'],['DOC-IMS-IT-02','Gestión de respaldos','Diaria']]},
    {code:'DOC-IMS-MGT',name:'Sistema integrado de gestión',area:'Gestión',ops:[['DOC-IMS-MGT-01','Auditoría interna integrada','Semestral'],['DOC-IMS-MGT-02','Gestión de acciones correctivas','Continua']]}
  ]}
];

function jwt(token:string){ try { return JSON.parse(Buffer.from((token.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')); } catch { return {}; } }
async function login(api:APIRequestContext,email:string){ const r=await api.post('/api/auth/login',{data:{email,password}}); const b=await r.json(); expect(r.status()).toBe(200); const token=String(b.token||b.accessToken||b.data?.token||b.data?.accessToken||''); expect(token).toBeTruthy(); const c=jwt(token); const tenantId=String(b.tenant_id||b.tenantId||b.user?.tenant_id||b.data?.tenant_id||b.data?.user?.tenant_id||c.tenant_id||c.tenantId||''); const role=String(b.role||b.user?.role||b.data?.role||b.data?.user?.role||c.role||'').toLowerCase(); expect(tenantId).toBeTruthy(); expect(role).toBe('admin'); return {token,tenantId}; }
async function req(api:APIRequestContext,method:'GET'|'POST',url:string,token:string,data?:unknown){ const o:any={headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}; if(data!==undefined)o.data=data; const r=method==='GET'?await api.get(url,o):await api.post(url,o); const b=await r.json().catch(()=>({})); expect(r.ok(),`${method} ${url}: ${JSON.stringify(b)}`).toBeTruthy(); return b; }
async function ensure(api:APIRequestContext,token:string,p:Seed){ let l=await req(api,'GET','/api/tenant-processes',token); let row=(l.data||[]).find((x:any)=>x.code===p.code); if(!row){ row=(await req(api,'POST','/api/tenant-processes',token,{code:p.code,name:p.name,description:`Dataset documental ${p.code}`,area:p.area,criticality:'alta',is_active:true})).data; } expect(row.code).toBe(p.code); for(const [code,name,frequency] of p.ops){ const ops=await req(api,'GET',`/api/tenant-processes/${row.id}/operations`,token); if(!(ops.data||[]).some((x:any)=>x.code===code)) await req(api,'POST',`/api/tenant-processes/${row.id}/operations`,token,{code,name,description:`Operación documental ${code}`,operation_type:'operacion',frequency,is_active:true}); } return row; }
async function capture(page:Page,key:string,name:string){ const dir=path.join(outputRoot,key,'transactional'); fs.mkdirSync(dir,{recursive:true}); await page.screenshot({path:path.join(dir,`${name}.png`),fullPage:true}); }
function processRow(page: Page, p: Seed) {
  return page.getByRole('row').filter({ hasText: p.code }).filter({ hasText: p.name }).first();
}

test.beforeAll(()=>{ expect(apiBase).toBeTruthy(); expect(password).toBeTruthy(); expect(writeEnabled).toBeTruthy(); fs.mkdirSync(path.dirname(transactionFile),{recursive:true}); });
test.afterAll(()=>fs.writeFileSync(transactionFile,JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)));

for(const s of scenarios){ test(`${s.key} DOC baseline is persisted and visible`,async({page})=>{ const api=await createRequest.newContext({baseURL:apiBase}); try { const {token,tenantId}=await login(api,s.email); const scope=await req(api,'GET',`/api/tenant-standards/scope/${tenantId}`,token); const active=(scope.standards||[]).filter((x:any)=>x.is_active===true&&Number(x.active_operations_count||0)>0).map((x:any)=>String(x.code||x.standard_code)).sort(); expect(active).toEqual([...s.standards].sort()); for(const p of s.processes){ expect(p.code.startsWith('DOC-')).toBeTruthy(); await ensure(api,token,p); }
    await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token); await page.goto('/configuracion',{waitUntil:'domcontentloaded'}); await expect(page.getByRole('heading',{name:'Procesos registrados'})).toBeVisible();
    for(const p of s.processes){ const row=processRow(page,p); await expect(row,`rendered process row ${p.code}`).toBeVisible(); }
    await capture(page,s.key,'03-configuracion-procesos-doc-creados'); const first=processRow(page,s.processes[0]); await first.getByRole('button',{name:'Editar'}).click(); await expect(page.getByRole('heading',{name:'Editar proceso'})).toBeVisible(); await expect(page.getByLabel('Código').first()).toHaveValue(s.processes[0].code); await capture(page,s.key,'04-configuracion-proceso-doc-edicion');
    const persisted=await req(api,'GET','/api/tenant-processes',token); for(const p of s.processes){ const row=(persisted.data||[]).find((x:any)=>x.code===p.code); expect(row).toBeTruthy(); const ops=await req(api,'GET',`/api/tenant-processes/${row.id}/operations`,token); for(const [code] of p.ops) expect((ops.data||[]).some((x:any)=>x.code===code),`persisted op ${code}`).toBeTruthy(); }
    results.push({scenario:s.key,tenantId,status:'PASS',processCodes:s.processes.map(p=>p.code),operationCodes:s.processes.flatMap(p=>p.ops.map(o=>o[0]))});
  } finally { await api.dispose(); } }); }
