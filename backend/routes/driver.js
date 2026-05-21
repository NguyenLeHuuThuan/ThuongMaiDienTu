const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authMiddleware } = require('../middleware/auth');

// Yêu cầu xác thực token (JWT)
router.use(authMiddleware);

// Lấy danh sách đơn hàng có thể nhận
router.get('/orders/available', driverController.getAvailableOrders);

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

module.exports = router;
