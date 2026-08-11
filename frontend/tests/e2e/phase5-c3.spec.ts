import { expect, test, type Page } from '@playwright/test';

const api = String(process.env.API_BASE_URL || '');
const password = 'Demo.123456';
const profiles = [
  { name:'tenant A admin',email:'admin.demo@tcdx.demo',role:'admin',value:82,tenant:'76c44a0e-6041-8bda-99c7-b740fccea001' },
  { name:'tenant A reviewer',email:'auditor.demo@tcdx.demo',role:'auditor',value:82,tenant:'76c44a0e-6041-8bda-99c7-b740fccea001' },
  { name:'tenant B admin',email:'admin.c3@tenant-b.local',role:'admin',value:64,tenant:'70000000-0000-0000-0000-000000000702' },
  { name:'tenant B viewer',email:'viewer.c3@tenant-b.local',role:'viewer',value:64,tenant:'70000000-0000-0000-0000-000000000702' },
] as const;

async function authenticate(page:Page,email:string){
  const response=await page.request.post(`${api}/api/auth/login`,{data:{email,password}});expect(response.status()).toBe(200);
  const payload=await response.json();expect(typeof payload.token).toBe('string');
  await page.addInitScript((token)=>localStorage.setItem('token',token),payload.token);return payload.token as string;
}

for(const profile of profiles){
  test(`${profile.name}: API, UI, RBAC y snapshot son consistentes`,async({page})=>{
    const consoleErrors:string[]=[];const serverErrors:string[]=[];let catalogRequests=0;let moduleRequests=0;
    page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text())});
    page.on('response',(response)=>{if(response.url().includes('/api/metrics/official/catalog'))catalogRequests+=1;if(response.url().includes('/api/me/modules'))moduleRequests+=1;if(response.status()>=500)serverErrors.push(`${response.status()} ${response.url()}`)});
    const token=await authenticate(page,profile.email);
    const me=await page.request.get(`${api}/api/user/me`,{headers:{Authorization:`Bearer ${token}`}});expect(me.status()).toBe(200);const identity=await me.json();expect(identity.tenant_id??identity.user?.tenant_id).toBe(profile.tenant);expect(identity.role??identity.user?.role).toBe(profile.role);
    const modules=await page.request.get(`${api}/api/me/modules`,{headers:{Authorization:`Bearer ${token}`}});expect(modules.status(),await modules.text()).toBe(200);
    const catalogResponse=await page.request.get(`${api}/api/metrics/official/catalog`,{headers:{Authorization:`Bearer ${token}`}});expect(catalogResponse.status()).toBe(200);const catalogPayload=await catalogResponse.json();const rows=Array.isArray(catalogPayload.data)?catalogPayload.data:catalogPayload;const compliance=rows.find((row:{definition?:{code?:string}})=>row.definition?.code==='COMPLIANCE');expect(compliance.latest_snapshot.value).toBe(profile.value);expect(compliance.latest_snapshot.snapshot_id).toBe(profile.value===82?'70000000-0000-0000-0000-000000003021':'70000000-0000-0000-0000-000000003022');
    const exportResponse=await page.request.get(`${api}/api/metrics/official/export`,{headers:{Authorization:`Bearer ${token}`}});expect(exportResponse.status(),await exportResponse.text()).toBe(200);const exportPayload=await exportResponse.json();const exported=exportPayload.data.rows.find((row:{metric_code?:string})=>row.metric_code==='COMPLIANCE');expect(exported.value).toBe(profile.value);expect(exported.snapshot_id).toBe(compliance.latest_snapshot.snapshot_id);
    await page.goto('/metricas');await expect(page.getByRole('heading',{name:'Indicadores oficiales'})).toBeVisible();const complianceCard=page.locator('article').filter({hasText:'Cumplimiento evaluado'});await expect(complianceCard).toBeVisible();expect(catalogRequests).toBeLessThanOrEqual(1);expect(moduleRequests).toBeLessThanOrEqual(1);await complianceCard.getByRole('link',{name:'Abrir indicador'}).click();await expect(page.getByText(profile.value===82?'82 %':'64 %',{exact:true}).first()).toBeVisible();
    if(profile.role==='admin')await expect(page.getByRole('button',{name:'Calcular desde fuentes'})).toBeVisible();else await expect(page.getByRole('button',{name:'Calcular desde fuentes'})).toHaveCount(0);
    catalogRequests=0;moduleRequests=0;await page.goto('/bi');await expect(page.getByRole('heading',{name:'Cockpit ejecutivo de decisiones'})).toBeVisible();await expect(page.getByText(profile.value===82?'82 %':'64 %',{exact:true}).first()).toBeVisible();expect(catalogRequests).toBeLessThanOrEqual(1);expect(moduleRequests).toBeLessThanOrEqual(1);
    if(profile.role==='admin'){catalogRequests=0;moduleRequests=0;await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Resumen ejecutivo GRC'})).toBeVisible();await expect(page.getByRole('link',{name:'Ver análisis GRC'})).toHaveAttribute('href','/grc');expect(catalogRequests).toBeLessThanOrEqual(1);expect(moduleRequests).toBeLessThanOrEqual(1);await page.goto('/grc');await expect(page.getByRole('heading',{name:'Decisiones, prioridades e interpretación GRC'})).toBeVisible();await expect(page.getByText(profile.value===82?'82 %':'64 %',{exact:true}).first()).toBeVisible();}
    expect(serverErrors).toEqual([]);expect(consoleErrors.filter((entry)=>/hydration|RBAC_DENIED|failed to load resource/i.test(entry))).toEqual([]);
  });
}

test('Tenant B no puede proponer sobre snapshot publicado de Tenant A',async({page})=>{
  const token=await authenticate(page,'admin.c3@tenant-b.local');
  const response=await page.request.post(`${api}/api/metrics/official/snapshots/70000000-0000-0000-0000-000000003021/proposals`,{headers:{Authorization:`Bearer ${token}`},data:{title:'Cross tenant'}});
  expect(response.status()).toBe(404);
});

test('Admin gobierna una nueva metodología sin mutar la versión publicada',async({page})=>{
  const token=await authenticate(page,'admin.demo@tcdx.demo');const headers={Authorization:`Bearer ${token}`};
  const draftResponse=await page.request.post(`${api}/api/metrics/official/COMPLIANCE/methodology`,{headers,data:{reason:'E2E de versionado 5-C3'}});expect(draftResponse.status(),await draftResponse.text()).toBe(200);const draft=(await draftResponse.json()).data;expect(draft.status).toBe('draft');expect(draft.version).toBeGreaterThan(1);
  const reviewed=await page.request.post(`${api}/api/metrics/official/methodology/${draft.definition_version_id}/review`,{headers,data:{}});expect(reviewed.status(),await reviewed.text()).toBe(200);
  const published=await page.request.post(`${api}/api/metrics/official/methodology/${draft.definition_version_id}/publish`,{headers,data:{}});expect(published.status(),await published.text()).toBe(200);
  const methodology=await page.request.get(`${api}/api/metrics/official/COMPLIANCE/methodology`,{headers});expect(methodology.status(),await methodology.text()).toBe(200);const payload=(await methodology.json()).data;expect(payload.versions.some((version:{version_number:number;status:string})=>version.version_number===draft.version&&version.status==='published')).toBe(true);expect(payload.versions.some((version:{version_number:number;status:string})=>version.version_number===1&&version.status==='published')).toBe(true);
});
