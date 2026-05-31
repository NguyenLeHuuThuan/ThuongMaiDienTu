const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { authMiddleware, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Tất cả routes cần xác thực + quyền restaurant_owner
router.use(authMiddleware);
router.use(authorize('restaurant_owner'));

// Thông tin nhà hàng
router.get('/info', restaurantController.getMyRestaurant);
router.put('/info', restaurantController.updateRestaurant);

// Quản lý đơn hàng
router.get('/orders', restaurantController.getRestaurantOrders);
router.put('/orders/:id/accept', restaurantController.acceptOrder);
router.put('/orders/:id/reject', restaurantController.rejectOrder);
router.put('/orders/:id/complete', restaurantController.completeOrder);

// Quản lý thực đơn
router.get('/menu', restaurantController.getRestaurantMenu);
router.post('/menu', restaurantController.addFood);
router.put('/menu/:id', restaurantController.updateFood);
router.put('/menu/:id/toggle', restaurantController.toggleFoodAvailability);

// Quản lý khuyến mãi
router.get('/promotions', restaurantController.getRestaurantPromotions);
router.post('/promotions', restaurantController.createPromotion);
router.delete('/promotions/:id', restaurantController.deletePromotion);

// Phân tích kinh doanh
router.get('/analytics', restaurantController.getAnalytics);

// Quản lý ví (Wallet)
router.get('/wallet', restaurantController.getWallet);
router.post('/wallet/topup', restaurantController.topUpWallet);
router.post('/wallet/withdraw', restaurantController.withdrawWallet);

// Khiếu nại
router.get('/complaints', restaurantController.getComplaints);
router.put('/complaints/:id/respond', restaurantController.respondComplaint);

// Danh mục (cho dropdown)
router.get('/categories', restaurantController.getCategories);

// Trò chuyện (Chat)
router.get('/chat/conversations', restaurantController.getConversations);
router.get('/chat/messages/:partnerId', restaurantController.getMessages);
router.post('/chat/messages', restaurantController.sendMessage);
router.put('/chat/messages/:partnerId/read', restaurantController.markAsRead);
router.get('/chat/contacts', restaurantController.getContacts);

module.exports = router;
