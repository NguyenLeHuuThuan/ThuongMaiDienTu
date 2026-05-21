const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authMiddleware } = require('../middleware/auth');

// Yêu cầu xác thực token (JWT)
router.use(authMiddleware);

// Lấy danh sách đơn hàng có thể nhận
router.get('/orders/available', driverController.getAvailableOrders);

// Lấy tổng thu nhập hôm nay
router.get('/earnings/today', driverController.getTodayEarnings);

// Nhận đơn hàng
router.put('/orders/:id/accept', driverController.acceptOrder);

// Cập nhật trạng thái đơn hàng (lấy hàng xong, giao xong)
router.put('/orders/:id/status', driverController.updateOrderStatus);

// Lấy danh sách đơn hàng ĐÃ NHẬN của shipper
router.get('/orders/accepted', driverController.getAcceptedOrders);

// Báo cáo sự cố (Complaint)
router.post('/orders/:id/complaint', driverController.reportComplaint);

// Hủy đơn hàng (đang giao)
router.post('/orders/:id/cancel', driverController.cancelOrder);

// Lấy danh sách thông báo
router.get('/notifications', driverController.getNotifications);

// Đánh dấu thông báo đã đọc
router.put('/notifications/:id/read', driverController.markNotificationRead);

// Xóa thông báo
router.delete('/notifications/:id', driverController.deleteNotification);

module.exports = router;
