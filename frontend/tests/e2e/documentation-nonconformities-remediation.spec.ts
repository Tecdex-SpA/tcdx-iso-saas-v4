import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Scenario={key:string,email:string,iso:string,code:string};
const root=path.resolve(__dirname,'../../..');
const out=path.resolve(root,process.env.DOC_CAPTURE_DIR||'artifacts/documentation/screenshots');
const apiBase=String(process.env.DOC_API_BASE_URL||process.env.DOC_WEB_BASE_URL||'').replace(/\/$/,'');
const password=String(process.env.DOC_DEMO_PASSWORD||'');
const writeEnabled=String(process.env.DOC_ENABLE_WRITES||'').toLowerCase()==='true';
const scenarios:Scenario[]=[
 {key:'iso9001',email:'admin.demo9001@tcdx.demo',iso:'ISO9001',code:'DOC-NC-QMS-001'},
 {key:'iso27001',email:'admin.demo27001@tcdx.demo',iso:'ISO27001',code:'DOC-NC-ISMS-001'},
 {key:'integrated',email:'admin.demoisos@tcdx.demo',iso:'ISO9001',code:'DOC-NC-IMS-001'},
];
function jwt(t:string){try{return JSON.parse(Buffer.from((t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))}catch{return {}}}
async function login(api:APIRequestContext,email:string){const r=await api.post('/api/auth/login',{data:{email,password}});const b=await r.json();expect(r.status()).toBe(200);const token=String(b.token||b.accessToken||b.data?.token||b.data?.accessToken||'');const c=jwt(token);const tenantId=String(b.tenant_id||b.tenantId||b.user?.tenant_id||b.data?.tenant_id||b.data?.user?.tenant_id||c.tenant_id||c.tenantId||'');expect(token).toBeTruthy();expect(tenantId).toBeTruthy();return{token,tenantId}}
async function call(api:APIRequestContext,method:'GET'|'POST'|'PUT',url:string,token:string,data?:unknown){const o:any={headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}};if(data!==undefined)o.data=data;const r=method==='GET'?await api.get(url,o):method==='POST'?await api.post(url,o):await api.put(url,o);const b=await r.json().catch(()=>({}));return{ok:r.ok(),status:r.status(),body:b}}
function rows(b:any){if(Array.isArray(b))return b;for(const k of ['data','items','rows','nonconformities'])if(Array.isArray(b?.[k]))return b[k];return []}
async function shot(page:Page,key:string,name:string){const d=path.join(out,key,'nonconformities-remediation');fs.mkdirSync(d,{recursive:true});await page.screenshot({path:path.join(d,`${name}.png`),fullPage:true})}
async function session(page:Page,token:string){await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token)}

test.beforeAll(()=>{expect(apiBase).toBeTruthy();expect(password).toBeTruthy();expect(writeEnabled).toBeTruthy()});
for(const s of scenarios){test(`${s.key} NC remediation capability`,async({page})=>{const api=await createRequest.newContext({baseURL:apiBase});try{const{token,tenantId}=await login(api,s.email);
 const ctlResp=await call(api,'GET',`/api/findings/controls/${tenantId}?iso=${s.iso}`,token);expect(ctlResp.ok,JSON.stringify(ctlResp.body)).toBeTruthy();const controls=rows(ctlResp.body);expect(controls.length).toBeGreaterThan(0);const ctl=controls[0];const tcId=String(ctl.tenant_control_id||ctl.tenant_control_id_moderno||'');expect(tcId).toBeTruthy();
 const before=await call(api,'GET',`/api/nonconformities/${tenantId}?iso=${s.iso}`,token);expect(before.ok,JSON.stringify(before.body)).toBeTruthy();let nc=rows(before.body).find((x:any)=>String(x.control_description||'').includes(s.code));let createBlocker:any=null;
 if(!nc){const create=await call(api,'POST',`/api/controls/workbench/${tcId}/quick-nonconformity`,token,{tenant_id:tenantId,iso_code:s.iso,control_description:`${s.code} No conformidad documental reproducible`});if(create.ok){nc=create.body?.data||create.body?.nonconformity||create.body}else{createBlocker={status:create.status,body:create.body}}}
 await session(page,token);for(const route of ['/no-conformidades','/hallazgos','/auditorias']){await page.goto(route,{waitUntil:'domcontentloaded'}).catch(()=>{});const body=await page.locator('body').innerText().catch(()=>'');if(body.includes(s.code)||/No conformidad|No conformidades/i.test(body)){await shot(page,s.key,nc?'01-nc-creada-visible':'01-nc-capacidad-bloqueada');break}}
 if(nc?.id){for(const status of ['en progreso','pendiente_aprobacion','resuelta']){const u=await call(api,'PUT',`/api/nonconformities/${nc.id}`,token,{status});expect(u.ok,`${status}: ${JSON.stringify(u.body)}`).toBeTruthy();await page.goto('/no-conformidades',{waitUntil:'domcontentloaded'}).catch(()=>{});await shot(page,s.key,`02-nc-${status.replace(/ /g,'-')}`)}const after=await call(api,'GET',`/api/nonconformities/${tenantId}?iso=${s.iso}`,token);const persisted=rows(after.body).find((x:any)=>String(x.id)===String(nc.id));expect(persisted?.status).toBe('resuelta');}
 fs.mkdirSync(path.join(root,'artifacts/documentation'),{recursive:true});fs.appendFileSync(path.join(root,'artifacts/documentation/nonconformities-remediation.ndjson'),JSON.stringify({scenario:s.key,tenantId,iso:s.iso,code:s.code,ncId:nc?.id||null,resolved:nc?.id?true:false,createBlocker})+'\n');
 }finally{await api.dispose()}})}
