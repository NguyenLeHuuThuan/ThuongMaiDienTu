const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', orderController.getOrders);
router.post('/', orderController.placeOrder);
router.get('/:id', orderController.getOrderDetail);
router.put('/:id/cancel', orderController.cancelOrder);
router.post('/:id/review', orderController.submitReview);
router.post('/:id/complaint', orderController.submitComplaint);

module.exports = router;
