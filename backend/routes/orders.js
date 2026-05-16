const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderDetail);

module.exports = router;
