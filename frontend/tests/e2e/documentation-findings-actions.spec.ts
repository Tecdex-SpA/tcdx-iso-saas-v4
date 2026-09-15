import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Scenario={key:string,email:string,iso:string,code:string,title:string};
const root=path.resolve(__dirname,'../../..');
const out=path.resolve(root,process.env.DOC_CAPTURE_DIR||'artifacts/documentation/screenshots');
const apiBase=String(process.env.DOC_API_BASE_URL||process.env.DOC_WEB_BASE_URL||'').replace(/\/$/,'');
const password=String(process.env.DOC_DEMO_PASSWORD||'');
const writeEnabled=String(process.env.DOC_ENABLE_WRITES||'').toLowerCase()==='true';
const scenarios:Scenario[]=[
 {key:'iso9001',email:'admin.demo9001@tcdx.demo',iso:'ISO9001',code:'DOC-F-QMS-001',title:'DOC-F-QMS-001 Hallazgo documental ISO 9001'},
 {key:'iso27001',email:'admin.demo27001@tcdx.demo',iso:'ISO27001',code:'DOC-F-ISMS-001',title:'DOC-F-ISMS-001 Hallazgo documental ISO 27001'},
 {key:'integrated',email:'admin.demoisos@tcdx.demo',iso:'ISO9001',code:'DOC-F-IMS-001',title:'DOC-F-IMS-001 Hallazgo documental sistema integrado'},
];
function jwt(t:string){try{return JSON.parse(Buffer.from((t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))}catch{return {}}}
async function login(api:APIRequestContext,email:string){const r=await api.post('/api/auth/login',{data:{email,password}});const b=await r.json();expect(r.status()).toBe(200);const token=String(b.token||b.accessToken||b.data?.token||b.data?.accessToken||'');const c=jwt(token);const tenantId=String(b.tenant_id||b.tenantId||b.user?.tenant_id||b.data?.tenant_id||b.data?.user?.tenant_id||c.tenant_id||c.tenantId||'');expect(token).toBeTruthy();expect(tenantId).toBeTruthy();return{token,tenantId}}
async function req(api:APIRequestContext,method:'GET'|'POST'|'PUT',url:string,token:string,data?:unknown){const o:any={headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}};if(data!==undefined)o.data=data;const r=method==='GET'?await api.get(url,o):method==='POST'?await api.post(url,o):await api.put(url,o);const b=await r.json().catch(()=>({}));expect(r.ok(),`${method} ${url}: ${JSON.stringify(b)}`).toBeTruthy();return b}
function rows(b:any){if(Array.isArray(b))return b;for(const k of ['data','items','findings','rows','action_plans','plans'])if(Array.isArray(b?.[k]))return b[k];return []}
async function shot(page:Page,key:string,name:string){const d=path.join(out,key,'findings-actions');fs.mkdirSync(d,{recursive:true});await page.screenshot({path:path.join(d,`${name}.png`),fullPage:true})}
async function session(page:Page,token:string){await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token)}

test.beforeAll(()=>{expect(apiBase).toBeTruthy();expect(password).toBeTruthy();expect(writeEnabled).toBeTruthy()});
for(const s of scenarios){test(`${s.key} finding and action flow`,async({page})=>{const api=await createRequest.newContext({baseURL:apiBase});try{const{token,tenantId}=await login(api,s.email);
 const controls=rows(await req(api,'GET',`/api/findings/controls/${tenantId}?iso=${s.iso}`,token));expect(controls.length).toBeGreaterThan(0);const ctl=controls[0];const tcId=String(ctl.tenant_control_id||ctl.tenant_control_id_moderno||'');expect(tcId).toBeTruthy();
 const existing=rows(await req(api,'GET',`/api/findings/${tenantId}?iso=${s.iso}`,token));let f=existing.find((x:any)=>String(x.title||'').includes(s.code));
 if(!f){f=await req(api,'POST','/api/findings',token,{tenant_id:tenantId,iso_code:s.iso,title:s.title,description:`${s.code} creado para documentación transaccional reproducible`,finding_type:'observacion',severity:'media',status:'abierto',source_type:'manual',owner:s.email,detected_by:'Documentación automatizada',due_date:new Date(Date.now()+30*86400000).toISOString().slice(0,10),tenant_control_id:tcId});f=f.data||f.finding||f}
 expect(f?.id).toBeTruthy();
 await session(page,token);for(const route of ['/hallazgos','/auditorias']){await page.goto(route,{waitUntil:'domcontentloaded'});if((await page.locator('body').innerText()).includes(s.code)){await shot(page,s.key,'01-hallazgo-creado-visible');break}}
 const created=rows(await req(api,'GET',`/api/findings/${tenantId}?iso=${s.iso}`,token)).find((x:any)=>String(x.id)===String(f.id)||String(x.title||'').includes(s.code));expect(created).toBeTruthy();
 let actionError:any=null;try{await req(api,'POST',`/api/findings/${created.id}/create-action`,token,{})}catch(e){actionError=String(e)}
 await page.goto('/planes-accion',{waitUntil:'domcontentloaded'}).catch(()=>{});await shot(page,s.key,'02-planes-accion-post-hallazgo');
 const refreshed=rows(await req(api,'GET',`/api/findings/${tenantId}?iso=${s.iso}`,token)).find((x:any)=>String(x.id)===String(created.id));expect(refreshed).toBeTruthy();
 fs.mkdirSync(path.join(root,'artifacts/documentation'),{recursive:true});fs.appendFileSync(path.join(root,'artifacts/documentation/findings-actions.ndjson'),JSON.stringify({scenario:s.key,tenantId,iso:s.iso,findingId:created.id,code:s.code,hasActionPlan:Boolean(refreshed.has_action_plan),actionError})+'\n');
 }finally{await api.dispose()}})}
