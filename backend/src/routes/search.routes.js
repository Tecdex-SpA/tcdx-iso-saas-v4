const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  globalSearch,
  getRecentSearchHistory,
  trackSearchClick,
} = require('../controllers/search.controller');

router.get('/global/:tenantId', auth, globalSearch);
router.get('/history/:tenantId', auth, getRecentSearchHistory);
router.post('/history/click', auth, trackSearchClick);

module.exports = router;
