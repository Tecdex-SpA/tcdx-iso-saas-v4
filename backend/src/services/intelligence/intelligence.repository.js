const aiContextBuilder = require('../aiContextBuilder.service');

async function getTenantIntelligenceDataset({ tenantId }) {
  return aiContextBuilder.buildAiTenantContext({ tenantId });
}

module.exports = {
  getTenantIntelligenceDataset,
};
