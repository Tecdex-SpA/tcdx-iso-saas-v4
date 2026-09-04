import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const repoRoot = path.resolve(root, '..');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `No se pudo localizar ${start}.`);
  return source.slice(startIndex, endIndex);
}

const riskRegister = read(path.join(root, 'src/components/risk-control/RiskRegisterWorkspace.tsx'));
const grcPanel = read(path.join(root, 'src/components/grc/GrcPhase1Panel.tsx'));
const grcRoutes = read(path.join(repoRoot, 'backend/src/routes/grc.routes.js'));
const grcService = read(path.join(repoRoot, 'backend/src/services/grc/grc.service.js'));

const riskDrawer = sliceBetween(riskRegister, 'function RiskDetailDrawer', 'export default function RiskRegisterWorkspace');
const runtimePanel = sliceBetween(grcPanel, 'function WorkflowRuntimePanel', 'function FrameworkPanel');

assert(/role="dialog"/.test(riskRegister), 'El detalle de riesgo debe ser dialog accesible.');
assert(/event\.key === 'Escape'/.test(riskRegister), 'El detalle de riesgo debe cerrar con Escape.');
assert(/previous\?\.focus/.test(riskRegister), 'El detalle de riesgo debe devolver el foco al disparador.');
assert(/bg-slate-950\/5/.test(riskRegister), 'El backdrop del detalle de riesgo debe ser sutil.');
assert(!/bg-slate-950\/35/.test(riskRegister), 'El backdrop oscuro anterior no debe volver.');
assert(!/row\.stableKey/.test(riskDrawer), 'El drawer no debe exponer la clave técnica estable.');
assert(/md:w-\[min\(540px,calc\(100vw-24px\)\)\]/.test(riskRegister), 'El drawer desktop debe quedar en rango comercial 480-560px.');

assert(/router\.get\('\/workflow-entity-options'/.test(grcRoutes), 'Debe existir endpoint de opciones compatibles.');
assert(/router\.get\('\/workflow-instances'/.test(grcRoutes), 'Debe existir endpoint de consulta de instancias sin UUID manual.');
assert(/authorized\(req, 'workflow\.read'/.test(grcRoutes), 'Las lecturas de workflow deben preservar RBAC workflow.read.');
assert(/authorized\(req, 'workflow\.transition'/.test(grcRoutes), 'La creación y transición deben preservar RBAC workflow.transition.');

assert(/listWorkflowEntityOptions/.test(grcService), 'El servicio debe listar entidades compatibles.');
assert(/WHERE tenant_id = \$1::uuid/.test(grcService) || /tenant_id=\$1::uuid/.test(grcService), 'Las consultas deben mantener filtro por tenant.');
assert(/AND id = \$2::uuid/.test(grcService) && /AND status = 'active'/.test(grcService), 'La definición elegida debe estar activa y scoped al tenant.');
assert(/ADAPTERS\[definition\.entity_type\]/.test(grcService), 'El selector sólo debe usar tipos compatibles con el runtime GRC.');
assert(/clampWorkflowOptionLimit/.test(grcService), 'El selector debe limitar resultados y evitar catálogos ilimitados.');
assert(/context->>'entity_label'/.test(grcService), 'La consulta de instancias debe usar contexto humano persistido.');
assert(!/i\.entity_id::text.*ILIKE/s.test(grcService), 'La búsqueda de instancias no debe depender de UUID visibles.');

assert(/Proceso/.test(runtimePanel), 'La UI debe mostrar Proceso como concepto funcional.');
assert(/Aplicar a/.test(runtimePanel), 'La UI debe mostrar Aplicar a como selector de entidad.');
assert(/workflow-entity-options/.test(runtimePanel), 'La UI debe cargar entidades compatibles desde backend.');
assert(/selectedEntity\.id/.test(runtimePanel), 'La creación debe enviar el ID interno resuelto por selección.');
assert(/entity_label/.test(runtimePanel) && /workflowEntityLabel/.test(runtimePanel), 'La instancia debe persistir una etiqueta humana.');
assert(/workflow-instances\?\$\{params\.toString\(\)\}/.test(runtimePanel), 'La consulta debe listar instancias sin pegar UUID.');
assert(/Acciones disponibles/.test(runtimePanel), 'Las transiciones válidas deben mostrarse como acciones disponibles.');
assert(/Historial/.test(runtimePanel) && /Estado resultante/.test(runtimePanel), 'El historial persistido debe mostrarse con estado resultante.');
assert(!/ID de entidad|ID de instancia existente|entityId|setEntityId/.test(runtimePanel), 'La UI runtime no debe pedir ni aceptar IDs técnicos de entidad.');
assert(!/alert\(/.test(runtimePanel), 'La UI runtime no debe usar alert nativo.');
assert(!/GRC_ID_REQUIRED|PHASE3_|HTTP|SQL/.test(runtimePanel), 'La UI runtime no debe exponer códigos técnicos.');

console.log('MARKET_READINESS_PART1_UX_WORKFLOWS_CONTRACT_PASS');
