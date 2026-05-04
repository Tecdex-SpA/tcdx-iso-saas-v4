require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./middleware/auth');
const { enforceApiAccess } = require('./middleware/rbac.middleware');
const reportsRoutes = require('./routes/reports.routes');
const billingRoutes = require('./routes/billing.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const controlsRoutes = require('./routes/controls.routes');
const aiRoutes = require('./routes/ai.routes');
const aiAuditorRoutes = require('./routes/ai-auditor.routes');
const diagnosticRoutes = require('./routes/diagnostic.routes');
const ncRoutes = require('./routes/nonconformities.routes');
const dashboardControls = require('./routes/dashboard-controls.routes');
const evidencesRoutes = require('./routes/evidences.routes');
const policyRoutes = require('./routes/policy.routes');
const auditsRoutes = require('./routes/audits.routes');
const auditExecutionRoutes = require('./routes/audit-execution.routes');
const assetsRoutes = require('./routes/assets.routes');
const usersRoutes = require('./routes/users.routes');
const tenantsRoutes = require('./routes/tenants.routes');
const tenantStandardsRoutes = require('./routes/tenant-standards.routes');
const soaRoutes = require('./routes/soa.routes');
const actionPlansRoutes = require('./routes/action-plans.routes');
const findingsRoutes = require('./routes/findings.routes');
const searchRoutes = require('./routes/search.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const kpiRoutes = require('./routes/kpi.routes');
const healthRoutes = require('./routes/health');
const meRoutes = require('./routes/me.routes');
const adminSaasRoutes = require('./routes/admin-saas.routes');
const meModulesRoutes = require('./routes/me-modules.routes');
const aiComplianceRoutes = require('./routes/ai-compliance.routes');
const aiAnswerRoutes = require('./routes/ai-answer.routes');
const aiBenchmarkRoutes = require('./routes/ai-benchmark.routes');
const aiKnowledgeRoutes = require('./routes/ai-knowledge.routes');
const aiTenantSearchRoutes = require('./routes/ai-tenant-search.routes');
const lifecycleRoutes = require('./routes/lifecycle.routes');
const aiFeedbackRoutes = require('./routes/ai-feedback.routes');
const aiExternalLookupRoutes = require('./routes/ai-external-lookup.routes');
const aiTracesRoutes = require('./routes/ai-traces.routes');
const quotesRoutes = require('./routes/quotes.routes');
const objectivesRoutes = require('./routes/objectives.routes');

const app = express();

const defaultFrontendUrl = 'http://192.168.100.130:8080';
const allowedCorsOrigins = Array.from(new Set([
  ...String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  defaultFrontendUrl,
].filter(Boolean)));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.length === 0 || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use('/uploads/logos', express.static(path.join(__dirname, '..', 'uploads', 'logos')));
app.use('/uploads/profiles', express.static(path.join(__dirname, '..', 'uploads', 'profiles')));
app.use('/uploads/reports', express.static(path.join(__dirname, '..', 'uploads', 'reports')));
app.use('/uploads/tenants', express.static(path.join(__dirname, '..', 'uploads', 'tenants')));
app.use('/uploads/tenant-logos', express.static(path.join(__dirname, '..', 'uploads', 'tenant-logos')));
app.use('/api/auth', express.json(), authRoutes);
app.use('/api', auth, enforceApiAccess);
app.use(express.json());
app.use('/api/reports', reportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/controls', controlsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-auditor', aiAuditorRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/nonconformities', ncRoutes);
app.use('/api/dashboard-controls', dashboardControls);
app.use('/api/evidences', evidencesRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/audits', auditsRoutes);
app.use('/api/audit-execution', auditExecutionRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/tenant-standards', tenantStandardsRoutes);
app.use('/api/soa', soaRoutes);
app.use('/api/action-plans', actionPlansRoutes);
app.use('/api/findings', findingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/health', auth, enforceApiAccess, healthRoutes);
app.use('/ai-feedback', aiFeedbackRoutes);
app.use('/ai-external-lookup', aiExternalLookupRoutes);
app.use('/api/ai-traces', aiTracesRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin-saas', adminSaasRoutes);
app.use('/api/me', meModulesRoutes);
app.use('/api/ai-compliance/answer', aiAnswerRoutes);
app.use('/api/ai-compliance/benchmark', aiBenchmarkRoutes);
app.use('/api/ai-compliance', aiComplianceRoutes);
app.use('/api/ai-compliance/knowledge', aiKnowledgeRoutes);
app.use('/api/ai-compliance/tenant-search', aiTenantSearchRoutes);
app.use('/api/lifecycle', lifecycleRoutes);


/* KPI: compatibilidad con ambas rutas */
app.use('/api/kpi', kpiRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/objectives', objectivesRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando 🚀');
});

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
