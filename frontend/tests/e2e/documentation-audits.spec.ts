import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Scenario={key:string,email:string,iso:string,requester:string,auditor:string};
const root=path.resolve(__dirname,'../../..');
const out=path.resolve(root,process.env.DOC_CAPTURE_DIR||'artifacts/documentation/screenshots');
const apiBase=String(process.env.DOC_API_BASE_URL||process.env.DOC_WEB_BASE_URL||'').replace(/\/$/,'');
const password=String(process.env.DOC_DEMO_PASSWORD||'');
const writeEnabled=String(process.env.DOC_ENABLE_WRITES||'').toLowerCase()==='true';
const scenarios:Scenario[]=[
 {key:'iso9001',email:'admin.demo9001@tcdx.demo',iso:'ISO9001',requester:'DOC Auditoría ISO 9001',auditor:'Auditor Demo 9001'},
 {key:'iso27001',email:'admin.demo27001@tcdx.demo',iso:'ISO27001',requester:'DOC Auditoría ISO 27001',auditor:'Auditor Demo 27001'},
 {key:'integrated',email:'admin.demoisos@tcdx.demo',iso:'ISO9001',requester:'DOC Auditoría Sistema Integrado',auditor:'Auditor Demo ISOS'},
];
function jwt(t:string){try{return JSON.parse(Buffer.from((t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))}catch{return {}}}
async function login(api:APIRequestContext,email:string){const r=await api.post('/api/auth/login',{data:{email,password}});const b=await r.json();expect(r.status()).toBe(200);const token=String(b.token||b.accessToken||b.data?.token||b.data?.accessToken||'');const c=jwt(token);const tenantId=String(b.tenant_id||b.tenantId||b.user?.tenant_id||b.data?.tenant_id||b.data?.user?.tenant_id||c.tenant_id||c.tenantId||'');expect(token).toBeTruthy();expect(tenantId).toBeTruthy();return{token,tenantId}}
async function req(api:APIRequestContext,method:'GET'|'POST'|'PUT',url:string,token:string,data?:unknown){const o:any={headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}};if(data!==undefined)o.data=data;const r=method==='GET'?await api.get(url,o):method==='POST'?await api.post(url,o):await api.put(url,o);const b=await r.json().catch(()=>({}));expect(r.ok(),`${method} ${url}: ${JSON.stringify(b)}`).toBeTruthy();return b}
function rows(b:any){if(Array.isArray(b))return b;for(const k of ['data','items','audits','rows'])if(Array.isArray(b?.[k]))return b[k];return []}
async function shot(page:Page,key:string,name:string){const d=path.join(out,key,'audits');fs.mkdirSync(d,{recursive:true});await page.screenshot({path:path.join(d,`${name}.png`),fullPage:true})}
async function session(page:Page,token:string){await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token)}

test.beforeAll(()=>{expect(apiBase).toBeTruthy();expect(password).toBeTruthy();expect(writeEnabled).toBeTruthy()});
for(const s of scenarios){test(`${s.key} audit lifecycle`,async({page})=>{const api=await createRequest.newContext({baseURL:apiBase});try{const{token,tenantId}=await login(api,s.email);const all=rows(await req(api,'GET',`/api/audits/${tenantId}?iso=${s.iso}`,token));let audit=all.find((x:any)=>String(x.requester_name||'')===s.requester);if(!audit){audit=await req(api,'POST','/api/audits',token,{tenant_id:tenantId,iso:s.iso,start_date:new Date().toISOString().slice(0,10),end_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),requester_name:s.requester,auditor_type:'interno',auditor_name:s.auditor});}
 expect(audit?.id).toBeTruthy();await session(page,token);await page.goto('/auditorias',{waitUntil:'domcontentloaded'});await expect(page.getByText(s.requester,{exact:false}).first()).toBeVisible();await shot(page,s.key,'01-auditoria-creada');
 if(String(audit.status||'').toLowerCase()!=='en_ejecucion'&&String(audit.status||'').toLowerCase()!=='completada')await req(api,'PUT',`/api/audits/start/${audit.id}`,token,{});await page.reload({waitUntil:'domcontentloaded'});await shot(page,s.key,'02-auditoria-en-ejecucion');
 const summary=await req(api,'GET',`/api/audits/summary/${tenantId}?iso=${s.iso}`,token);expect(summary?.ok).not.toBe(false);fs.mkdirSync(path.join(root,'artifacts/documentation'),{recursive:true});fs.appendFileSync(path.join(root,'artifacts/documentation/audits.ndjson'),JSON.stringify({scenario:s.key,tenantId,iso:s.iso,auditId:audit.id,status:'PASS',summary:summary.summary||null})+'\n');
 }finally{await api.dispose()}})}
