const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { calculateAllKPIs } = require('../services/kpi.engine');
const {
  getCatalogByTenant,
  getDashboardByTenant,
  getEffectiveHealthSummaryByTenant,
  getAdminListByTenant,
  createCustomKpi,
  updateCustomKpi,
  deleteCustomKpi,  
  upsertTenantKpiSetting,
  saveManualValue,
  recalculateTenantKpis
} = require('../controllers/kpi.controller');

/* =========================
   DASHBOARD / RECALCULO
========================= */

router.post('/recalculate/:tenantId', auth, recalculateTenantKpis);
router.get('/dashboard/:tenantId', auth, getDashboardByTenant);
router.get('/effective-health-summary/:tenantId', auth, getEffectiveHealthSummaryByTenant);

/* =========================
   ADMINISTRACIÓN KPI
========================= */

router.get('/catalog/:tenantId', auth, getCatalogByTenant);
router.get('/admin/:tenantId', auth, getAdminListByTenant);
router.post('/custom', auth, createCustomKpi);
router.put('/custom/:id', auth, updateCustomKpi);
router.post('/tenant-setting', auth, upsertTenantKpiSetting);
router.post('/manual-value', auth, saveManualValue);
router.delete('/custom/:id', auth, deleteCustomKpi);


module.exports = router;
