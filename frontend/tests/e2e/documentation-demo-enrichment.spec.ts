import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Scenario = { key:string; email:string; iso:string; prefix:string; auditor:string };
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const writeEnabled = String(process.env.DOC_ENABLE_WRITES || '').toLowerCase() === 'true';
const runTag = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9A-Za-z_-]/g, '');
const scenarios: Scenario[] = [
  { key:'iso9001', email:'admin.demo9001@tcdx.demo', iso:'ISO9001', prefix:'DOC-METRIC-QMS', auditor:'Auditor Métrico 9001' },
  { key:'iso27001', email:'admin.demo27001@tcdx.demo', iso:'ISO27001', prefix:'DOC-METRIC-ISMS', auditor:'Auditor Métrico 27001' },
  { key:'integrated', email:'admin.demoisos@tcdx.demo', iso:'ISO9001', prefix:'DOC-METRIC-IMS', auditor:'Auditor Métrico Integrado' },
];
function jwt(t:string){try{return JSON.parse(Buffer.from((t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))}catch{return {}}}
async function login(api:APIRequestContext,email:string){const r=await api.post('/api/auth/login',{data:{email,password}});const b=await r.json();expect(r.status()).toBe(200);const token=String(b.token||b.accessToken||b.data?.token||b.data?.accessToken||'');const c=jwt(token);const tenantId=String(b.tenant_id||b.tenantId||b.user?.tenant_id||b.data?.tenant_id||b.data?.user?.tenant_id||c.tenant_id||c.tenantId||'');expect(token).toBeTruthy();expect(tenantId).toBeTruthy();return{token,tenantId}}
async function req(api:APIRequestContext,method:'GET'|'POST'|'PUT',url:string,token:string,data?:unknown){const o:any={headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}};if(data!==undefined)o.data=data;const r=method==='GET'?await api.get(url,o):method==='POST'?await api.post(url,o):await api.put(url,o);const b=await r.json().catch(()=>({}));expect(r.ok(),`${method} ${url}: ${JSON.stringify(b)}`).toBeTruthy();return b}
function rows(b:any){if(Array.isArray(b))return b;for(const k of ['data','items','findings','rows','audits','action_plans','plans'])if(Array.isArray(b?.[k]))return b[k];return []}
async function session(page:Page,token:string){await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token)}
async function open(page:Page,route:string){await page.goto(route,{waitUntil:'domcontentloaded'});await page.waitForLoadState('networkidle').catch(()=>{});await page.waitForTimeout(1600)}
async function shot(page:Page,key:string,name:string){const d=path.join(out,key,'before-after');fs.mkdirSync(d,{recursive:true});await page.screenshot({path:path.join(d,`${name}.png`),fullPage:false})}
async function countState(api:APIRequestContext,token:string,tenantId:string,iso:string){const findings=rows(await req(api,'GET',`/api/findings/${tenantId}?iso=${iso}`,token));const audits=rows(await req(api,'GET',`/api/audits/${tenantId}?iso=${iso}`,token));return{findings:findings.length,openFindings:findings.filter((x:any)=>!['cerrado','closed','resuelto','resuelta'].includes(String(x.status||'').toLowerCase())).length,audits:audits.length,completedAudits:audits.filter((x:any)=>String(x.status||'').toLowerCase()==='completada').length}}

test.beforeAll(()=>{expect(apiBase).toBeTruthy();expect(password).toBeTruthy();expect(writeEnabled).toBeTruthy()});
for(const s of scenarios){test(`${s.key} measurable ingestion before-after`,async({page})=>{const api=await createRequest.newContext({baseURL:apiBase});try{const{token,tenantId}=await login(api,s.email);await session(page,token);const before=await countState(api,token,tenantId,s.iso);
  await open(page,'/dashboard?view=executive');await shot(page,s.key,'01-dashboard-ANTES-ingesta');
  await open(page,'/hallazgos');await shot(page,s.key,'02-hallazgos-ANTES-ingesta');

  const controls=rows(await req(api,'GET',`/api/findings/controls/${tenantId}?iso=${s.iso}`,token));expect(controls.length).toBeGreaterThan(0);const tcId=String(controls[0].tenant_control_id||controls[0].tenant_control_id_moderno||'');expect(tcId).toBeTruthy();
  const definitions=[
    ['001','alta','Brecha crítica de evidencia objetiva'],['002','alta','Desviación mayor de operación'],['003','media','Observación de trazabilidad'],['004','media','Seguimiento documental pendiente']
  ];
  for(const [n,severity,label] of definitions){const code=`${s.prefix}-${runTag}-${n}`;const created=await req(api,'POST','/api/findings',token,{tenant_id:tenantId,iso_code:s.iso,title:`${code} ${label}`,description:`${code}. Registro demo creado durante la ingesta documental para demostrar variación medible en Hallazgos, Planes y Dashboard.`,finding_type:'observacion',severity,status:'abierto',source_type:'manual',owner:s.email,detected_by:'Dataset documental medible',due_date:new Date(Date.now()+(10+Number(n))*86400000).toISOString().slice(0,10),tenant_control_id:tcId});const f=created.data||created.finding||created;if(f?.id){try{await req(api,'POST',`/api/findings/${f.id}/create-action`,token,{})}catch{}}}

  for(const n of ['001','002']){const requester=`${s.prefix}-AUD-${runTag}-${n}`;await req(api,'POST','/api/audits',token,{tenant_id:tenantId,iso:s.iso,start_date:new Date(Date.now()+Number(n)*86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+(7+Number(n))*86400000).toISOString().slice(0,10),requester_name:requester,auditor_type:'interno',auditor_name:s.auditor})}

  const after=await countState(api,token,tenantId,s.iso);expect(after.findings).toBeGreaterThan(before.findings);expect(after.audits).toBeGreaterThan(before.audits);
  await open(page,'/hallazgos');await shot(page,s.key,'03-hallazgos-DESPUES-ingesta');
  await open(page,'/planes-accion');await shot(page,s.key,'04-planes-DESPUES-ingesta');
  await open(page,'/auditorias');await shot(page,s.key,'05-auditorias-DESPUES-ingesta');
  await open(page,'/dashboard?view=executive');await shot(page,s.key,'06-dashboard-DESPUES-ingesta');
  await open(page,'/dashboard?view=kpi');await shot(page,s.key,'07-dashboard-kpi-DESPUES-ingesta');
  await open(page,'/dashboard?view=iso');await shot(page,s.key,'08-dashboard-salud-DESPUES-ingesta');
  await open(page,'/iso-health');await shot(page,s.key,'09-iso-health-DESPUES-ingesta');
  fs.mkdirSync(path.join(root,'artifacts/documentation'),{recursive:true});fs.appendFileSync(path.join(root,'artifacts/documentation/demo-enrichment.ndjson'),JSON.stringify({scenario:s.key,tenantId,iso:s.iso,runTag,before,after,delta:{findings:after.findings-before.findings,openFindings:after.openFindings-before.openFindings,audits:after.audits-before.audits,completedAudits:after.completedAudits-before.completedAudits}})+'\n');
}finally{await api.dispose()}})}
