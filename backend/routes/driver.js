const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Yêu cầu xác thực token (JWT)
router.use(authMiddleware);

const walletController = require('../controllers/walletController');

// Ví thu nhập
router.get('/wallet', walletController.getWallet);
router.post('/wallet/deposit', walletController.deposit);
router.post('/wallet/withdraw', walletController.withdraw);

// Lấy danh sách đơn hàng có thể nhận
router.get('/orders/available', driverController.getAvailableOrders);

// Lấy tổng thu nhập hôm nay
router.get('/earnings/today', driverController.getTodayEarnings);

// Lấy thống kê chung
router.get('/statistics', driverController.getStatistics);

// Nhận đơn hàng
router.put('/orders/:id/accept', driverController.acceptOrder);

// Cập nhật trạng thái đơn hàng (lấy hàng xong, giao xong)
router.put('/orders/:id/status', driverController.updateOrderStatus);

// Lấy danh sách đơn hàng ĐÃ NHẬN của shipper
router.get('/orders/accepted', driverController.getAcceptedOrders);

// Lấy chi tiết đơn hàng
router.get('/orders/:id', driverController.getOrderById);

// Lấy danh sách khiếu nại (của tôi và về tôi)
router.get('/complaints', driverController.getComplaints);

// Báo cáo sự cố (Complaint)
router.post('/orders/:id/complaint', upload.array('issue_images', 5), driverController.reportComplaint);

// Gỡ khiếu nại
router.put('/complaints/:id/withdraw', driverController.withdrawComplaint);

// Hủy đơn hàng (đang giao)
router.post('/orders/:id/cancel', driverController.cancelOrder);

// Lấy danh sách thông báo
router.get('/notifications', driverController.getNotifications);

// Đánh dấu thông báo đã đọc
router.put('/notifications/:id/read', driverController.markNotificationRead);

// Xóa thông báo
router.delete('/notifications/:id', driverController.deleteNotification);

// Thông tin tài xế
router.get('/profile', driverController.getProfile);
router.put('/profile', upload.single('avatar'), driverController.updateProfile);

// Trò chuyện (Chat)
router.get('/chat/conversations', driverController.getConversations);
router.get('/chat/messages/:partnerId', driverController.getMessages);
router.post('/chat/messages', driverController.sendMessage);
router.put('/chat/messages/:partnerId/read', driverController.markAsRead);

module.exports = router;
