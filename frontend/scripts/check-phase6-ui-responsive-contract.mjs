import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tsxFiles = walk(srcRoot).filter((filePath) => filePath.endsWith('.tsx'));
const directResponsiveContainerImports = tsxFiles.filter((filePath) => {
  const relative = path.relative(root, filePath);
  if (relative === 'src/components/ui/enterprise/ResponsiveChartFrame.tsx') return false;
  return /ResponsiveContainer/.test(read(filePath));
});

assert(
  directResponsiveContainerImports.length === 0,
  `ResponsiveContainer must be used through ResponsiveChartFrame only: ${directResponsiveContainerImports.join(', ')}`
);

const responsiveChartFrame = read(path.join(
  srcRoot,
  'components/ui/enterprise/ResponsiveChartFrame.tsx'
));

assert(
  /ResizeObserver/.test(responsiveChartFrame),
  'ResponsiveChartFrame must observe container size before rendering charts.'
);
assert(
  /data-phase6-chart-frame/.test(responsiveChartFrame),
  'ResponsiveChartFrame must expose a stable structural marker for browser validation.'
);
assert(
  /minWidth/.test(responsiveChartFrame) && /minHeight/.test(responsiveChartFrame),
  'ResponsiveChartFrame must define minimum render dimensions.'
);

const globals = read(path.join(srcRoot, 'app/globals.css'));

assert(
  /\.tcdx-responsive-chart-frame/.test(globals),
  'Global CSS must define the reusable responsive chart frame.'
);
assert(
  /\.enterprise-page-header[\s\S]*?flex-wrap:\s*wrap/.test(globals),
  'Enterprise page headers must wrap actions on notebook widths.'
);
assert(
  /\.enterprise-card-header[\s\S]*?flex-wrap:\s*wrap/.test(globals),
  'Enterprise card headers must wrap actions on notebook widths.'
);

console.log('PHASE6_UI_RESPONSIVE_CONTRACT_PASS');
