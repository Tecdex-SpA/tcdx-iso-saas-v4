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
function rows(b:any){if(Array.isArray(b))return b;for(const k of ['data','items','findings','rows','audits','action_plans','plans','evidences','effective_controls','generic_controls','personalized_controls','controls'])if(Array.isArray(b?.[k]))return b[k];if(b?.data&&typeof b.data==='object'){for(const k of ['items','rows','evidences','controls'])if(Array.isArray(b.data?.[k]))return b.data[k]}return []}
async function session(page:Page,token:string){await page.addInitScript(v=>{localStorage.setItem('token',v);localStorage.setItem('authToken',v)},token)}
async function open(page:Page,route:string){await page.goto(route,{waitUntil:'domcontentloaded'});await expect(page).not.toHaveURL(/\/login/);await page.waitForLoadState('networkidle').catch(()=>{});await page.waitForTimeout(1600)}
async function shot(page:Page,key:string,name:string,topOnly=false){const d=path.join(out,key,'before-after');fs.mkdirSync(d,{recursive:true});if(topOnly){const vp=page.viewportSize();await page.screenshot({path:path.join(d,`${name}.png`),clip:{x:0,y:0,width:vp?.width||2866,height:Math.min(1200,vp?.height||1200)}})}else{await page.screenshot({path:path.join(d,`${name}.png`),fullPage:false})}}

async function countState(api:APIRequestContext,token:string,tenantId:string,iso:string){
  const findings=rows(await req(api,'GET',`/api/findings/${tenantId}?iso=${iso}`,token));
  const audits=rows(await req(api,'GET',`/api/audits/${tenantId}?iso=${iso}`,token));
  const evidences=rows(await req(api,'GET',`/api/evidences/${tenantId}?iso=${iso}`,token));
  return {
    findings:findings.length,
    openFindings:findings.filter((x:any)=>!['cerrado','closed','resuelto','resuelta'].includes(String(x.status||'').toLowerCase())).length,
    highFindings:findings.filter((x:any)=>['alta','high','critica','crítica','critical'].includes(String(x.severity||'').toLowerCase())).length,
    audits:audits.length,
    completedAudits:audits.filter((x:any)=>String(x.status||'').toLowerCase()==='completada').length,
    runningAudits:audits.filter((x:any)=>String(x.status||'').toLowerCase()==='en_ejecucion').length,
    evidences:evidences.length,
    approvedEvidences:evidences.filter((x:any)=>String(x.status||'').toLowerCase()==='aprobada').length,
    pendingEvidences:evidences.filter((x:any)=>!['aprobada','aprobado'].includes(String(x.status||'').toLowerCase())).length,
  };
}

async function uploadEvidence(api:APIRequestContext,token:string,tenantId:string,iso:string,prefix:string,control:any,index:number){
  const code=`${prefix}-EV-${runTag}-${String(index+1).padStart(2,'0')}`;
  const fileBuffer=Buffer.from([
    `Código de evidencia: ${code}`,
    `Norma: ${iso}`,
    `Control: ${String(control.clause||control.category||control.control_id||'Control ISO')}`,
    'Tipo: registro objetivo de verificación.',
    'Contenido: revisión fechada, responsable, resultado de control, referencia documental y conclusión de cumplimiento.',
    'Uso documental: dataset demostrativo para evidenciar cómo la evidencia aprobada alimenta la operación ISO del tenant.',
  ].join('\n'),'utf8');
  const r=await api.post('/api/evidences/upload',{headers:{Authorization:`Bearer ${token}`},multipart:{tenant_id:tenantId,tenant_control_id:String(control.tenant_control_id||control.tenant_control_id_moderno||''),control_id:String(control.id||control.control_id||control.catalog_control_id||''),description:`${code} - Registro objetivo de cumplimiento y trazabilidad`,evidence_type:'documental',file:{name:`${code}.txt`,mimeType:'text/plain',buffer:fileBuffer}}});
  const b=await r.json().catch(()=>({}));expect(r.ok(),`upload evidence ${code}: ${JSON.stringify(b)}`).toBeTruthy();const ev=b.data||b.evidence||b;expect(ev?.id).toBeTruthy();return ev;
}

async function uploadAuditReport(api:APIRequestContext,token:string,id:string,name:string){
  const content=Buffer.from('%PDF-1.4\n% TCDX documented audit result\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n','utf8');
  const r=await api.post(`/api/audits/upload/${id}`,{headers:{Authorization:`Bearer ${token}`},multipart:{file:{name,mimeType:'application/pdf',buffer:content}}});
  const b=await r.json().catch(()=>({}));expect(r.ok(),`audit report ${id}: ${JSON.stringify(b)}`).toBeTruthy();return b;
}

test.beforeAll(()=>{expect(apiBase).toBeTruthy();expect(password).toBeTruthy();expect(writeEnabled).toBeTruthy()});

for(const s of scenarios){
  test(`${s.key} rich measurable ISO dataset before-after`,async({page})=>{
    const api=await createRequest.newContext({baseURL:apiBase});
    try{
      const{token,tenantId}=await login(api,s.email);await session(page,token);const before=await countState(api,token,tenantId,s.iso);
      await open(page,'/dashboard?view=executive');await shot(page,s.key,'01-dashboard-ANTES-ingesta',true);
      await open(page,'/hallazgos');await shot(page,s.key,'02-hallazgos-ANTES-ingesta');
      await open(page,'/planes-accion');await shot(page,s.key,'03-planes-ANTES-ingesta');
      await open(page,'/auditorias');await shot(page,s.key,'04-auditorias-ANTES-ingesta');

      const controls=rows(await req(api,'GET',`/api/findings/controls/${tenantId}?iso=${s.iso}`,token)).filter((x:any)=>x.tenant_control_id||x.tenant_control_id_moderno);
      expect(controls.length).toBeGreaterThan(0);

      // 6 hallazgos con severidad y vencimientos diversos -> planes y presión operativa visibles.
      const definitions=[
        ['01','alta','Brecha mayor de evidencia objetiva',-5],
        ['02','alta','Desviación de ejecución del procedimiento',-2],
        ['03','media','Trazabilidad documental incompleta',7],
        ['04','media','Seguimiento de revisión pendiente',14],
        ['05','baja','Oportunidad de mejora documental',21],
        ['06','baja','Optimización de registro operativo',30],
      ];
      for(let i=0;i<definitions.length;i++){
        const[n,severity,label,offset]=definitions[i] as [string,string,string,number];const code=`${s.prefix}-${runTag}-${n}`;const control=controls[i%controls.length];
        const created=await req(api,'POST','/api/findings',token,{tenant_id:tenantId,iso_code:s.iso,title:`${code} ${label}`,description:`${code}. Hallazgo demostrativo con causa, impacto y trazabilidad suficiente para enseñar priorización, remediación y efecto en el estado ISO.`,finding_type:'observacion',severity,status:'abierto',source_type:'manual',owner:s.email,detected_by:'Dataset documental de alta calidad',due_date:new Date(Date.now()+offset*86400000).toISOString().slice(0,10),tenant_control_id:String(control.tenant_control_id||control.tenant_control_id_moderno)});
        const f=created.data||created.finding||created;if(f?.id){try{await req(api,'POST',`/api/findings/${f.id}/create-action`,token,{})}catch{}}
      }

      // 6 evidencias distribuidas en controles distintos: 4 aprobadas y 2 pendientes.
      const evidenceControls=controls.slice(0,Math.min(6,controls.length));
      for(let i=0;i<evidenceControls.length;i++){
        const ev=await uploadEvidence(api,token,tenantId,s.iso,s.prefix,evidenceControls[i],i);
        if(i<4) await req(api,'PUT',`/api/evidences/approve/${ev.id}`,token,{status:'aprobada'});
      }

      // 4 auditorías: 2 completadas con informe, 1 en ejecución y 1 pendiente.
      for(let i=0;i<4;i++){
        const requester=`${s.prefix}-AUD-${runTag}-${i+1}`;
        const audit=await req(api,'POST','/api/audits',token,{tenant_id:tenantId,iso:s.iso,start_date:new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+(8+i)*86400000).toISOString().slice(0,10),requester_name:requester,auditor_type:'interno',auditor_name:s.auditor});
        if(i<3) await req(api,'PUT',`/api/audits/start/${audit.id}`,token,{});
        if(i<2){await uploadAuditReport(api,token,audit.id,`${requester}.pdf`);await req(api,'PUT',`/api/audits/complete/${audit.id}`,token,{})}
      }

      const after=await countState(api,token,tenantId,s.iso);
      expect(after.findings).toBeGreaterThan(before.findings);
      expect(after.audits).toBeGreaterThan(before.audits);
      expect(after.completedAudits).toBeGreaterThanOrEqual(before.completedAudits+2);
      expect(after.evidences).toBeGreaterThan(before.evidences);
      expect(after.approvedEvidences).toBeGreaterThan(before.approvedEvidences);

      await open(page,'/hallazgos');await shot(page,s.key,'05-hallazgos-DESPUES-ingesta');
      await open(page,'/planes-accion');await shot(page,s.key,'06-planes-DESPUES-ingesta');
      await open(page,'/auditorias');await shot(page,s.key,'07-auditorias-DESPUES-ingesta');
      await open(page,'/dashboard?view=executive');await shot(page,s.key,'08-dashboard-DESPUES-ingesta',true);

      fs.mkdirSync(path.join(root,'artifacts/documentation'),{recursive:true});
      fs.appendFileSync(path.join(root,'artifacts/documentation/demo-enrichment.ndjson'),JSON.stringify({scenario:s.key,tenantId,iso:s.iso,runTag,before,after,delta:{findings:after.findings-before.findings,openFindings:after.openFindings-before.openFindings,highFindings:after.highFindings-before.highFindings,audits:after.audits-before.audits,completedAudits:after.completedAudits-before.completedAudits,runningAudits:after.runningAudits-before.runningAudits,evidences:after.evidences-before.evidences,approvedEvidences:after.approvedEvidences-before.approvedEvidences,pendingEvidences:after.pendingEvidences-before.pendingEvidences}})+'\n');
    }finally{await api.dispose()}
  });
}
