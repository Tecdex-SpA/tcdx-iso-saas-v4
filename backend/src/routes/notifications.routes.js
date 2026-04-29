const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notifications.controller');

router.get('/:tenantId', auth, getNotifications);
router.patch('/:id/read', auth, markNotificationRead);
router.patch('/tenant/:tenantId/read-all', auth, markAllNotificationsRead);

module.exports = router;
