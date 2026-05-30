const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');

// Tất cả các routes chat cần được xác thực
router.use(authMiddleware);

router.get('/conversations', chatController.getConversations);
router.get('/messages/:partnerId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);
router.put('/messages/:partnerId/read', chatController.markAsRead);
router.get('/contacts', chatController.getContacts);

module.exports = router;
