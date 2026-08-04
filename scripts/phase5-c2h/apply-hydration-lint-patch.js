'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function patchFile(relativePath, from, to) {
  const absolutePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');

  if (source.includes(to)) {
    console.log(`${relativePath} ya se encuentra actualizado.`);
    return false;
  }

  if (!source.includes(from)) {
    throw new Error(`No se encontró el bloque esperado en ${relativePath}`);
  }

  fs.writeFileSync(absolutePath, source.replace(from, to), 'utf8');
  console.log(`${relativePath} actualizado.`);
  return true;
}

patchFile(
  'frontend/src/components/AppLayout.tsx',
  `  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
  }, []);`,
  `  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);`
);

patchFile(
  'frontend/src/context/LanguageContext.tsx',
  `  useEffect(() => {
    setLocaleState(resolveClientLocale());
  }, []);`,
  `  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLocaleState(resolveClientLocale());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);`
);
