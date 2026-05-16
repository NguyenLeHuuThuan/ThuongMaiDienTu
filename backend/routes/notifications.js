const express = require('express');
const router = express.Router();
const notiController = require('../controllers/notiController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', notiController.getNotifications);
router.put('/:id/read', notiController.markAsRead);

module.exports = router;
