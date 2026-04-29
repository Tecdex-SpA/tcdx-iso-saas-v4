require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const reportsRoutes = require('./routes/reports.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const controlsRoutes = require('./routes/controls.routes');
const aiRoutes = require('./routes/ai.routes');
const diagnosticRoutes = require('./routes/diagnostic.routes');
const ncRoutes = require('./routes/nonconformities.routes');
const dashboardControls = require('./routes/dashboard-controls.routes');
const evidencesRoutes = require('./routes/evidences.routes');
const policyRoutes = require('./routes/policy.routes');
const auditsRoutes = require('./routes/audits.routes');
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

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/reports', reportsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/controls', controlsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/nonconformities', ncRoutes);
app.use('/api/dashboard-controls', dashboardControls);
app.use('/api/evidences', evidencesRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/audits', auditsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/tenant', tenantsRoutes);
app.use('/api/tenant-standards', tenantStandardsRoutes);
app.use('/api/soa', soaRoutes);
app.use('/api/action-plans', actionPlansRoutes);
app.use('/api/findings', findingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/health', healthRoutes);
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

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
