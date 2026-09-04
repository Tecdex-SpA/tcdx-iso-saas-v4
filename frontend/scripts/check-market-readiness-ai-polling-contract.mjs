import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hookSource = fs.readFileSync(path.join(root, 'src/hooks/useIntelligenceBrief.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/const INTELLIGENCE_BRIEF_LOCALE = 'es'/.test(hookSource), 'El contexto de polling debe incluir el locale real del brief.');
assert(/const INTELLIGENCE_BRIEF_AI_MODE = 'ai'/.test(hookSource), 'El contexto de polling debe incluir el modo AI usado por la ruta.');
assert(/function pollingContextKey\(tenantId: string\)/.test(hookSource), 'Debe existir una key explicita de contexto para polling AI.');
assert(/return `\$\{tenantId\}:\$\{INTELLIGENCE_BRIEF_LOCALE\}:\$\{INTELLIGENCE_BRIEF_AI_MODE\}`/.test(hookSource), 'La key de polling debe quedar scoped por tenant, locale y modo AI.');
assert(/const aiRefreshContextRef = useRef<string \| null>\(null\)/.test(hookSource), 'Debe existir estado mutable del contexto de polling.');
assert(/aiRefreshContextRef\.current !== nextAiRefreshContext/.test(hookSource), 'El hook debe detectar cambio de tenant/contexto.');
assert(/window\.clearTimeout\(aiRefreshTimerRef\.current\)/.test(hookSource), 'El timer pendiente debe cancelarse al cambiar contexto y en cleanup.');
assert(/requestRef\.current\?\.abort\(\)/.test(hookSource), 'La request anterior debe abortarse al cambiar contexto y en cleanup.');
assert(/aiRefreshAttemptsRef\.current = 0/.test(hookSource), 'El contador de polling debe resetearse al cambiar contexto.');
assert(/aiRefreshContextRef\.current = nextAiRefreshContext/.test(hookSource), 'El nuevo contexto debe quedar registrado antes de iniciar request.');
assert(/brief\.metadata\?\.ai_pending === true && aiRefreshAttemptsRef\.current < 5/.test(hookSource), 'El limite de polling existente debe mantenerse en 5 intentos.');
assert(/aiRefreshContextRef\.current = null/.test(hookSource), 'El cleanup debe limpiar el contexto de polling.');

console.log('MARKET_READINESS_AI_POLLING_CONTRACT_PASS');
