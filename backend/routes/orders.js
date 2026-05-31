const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/auth');

// Public route cho VNPay IPN (Server-to-Server)
router.get('/vnpay-ipn', orderController.vnpayIpn);

// Tất cả các route bên dưới yêu cầu xác thực JWT
router.use(authMiddleware);

router.get('/payment-configs', orderController.getPaymentConfigs);
router.get('/', orderController.getOrders);
router.get('/shipping-fee', orderController.getShippingFee);
router.post('/', orderController.placeOrder);
router.post('/vnpay-verify', orderController.verifyVnPay);
router.get('/:id', orderController.getOrderDetail);
router.put('/:id/cancel', orderController.cancelOrder);
router.put('/:id/status', orderController.updateOrderStatus);
router.post('/:id/review', orderController.submitReview);
router.post('/:id/complaint', orderController.submitComplaint);

module.exports = router;
