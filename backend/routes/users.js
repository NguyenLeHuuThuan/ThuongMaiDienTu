const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// Addresses
router.get('/addresses', userController.getAddresses);
router.post('/addresses', userController.addAddress);
router.put('/addresses/:id', userController.updateAddress);
router.delete('/addresses/:id', userController.deleteAddress);

// Wallet
router.get('/wallet', userController.getWallet);
router.post('/wallet/topup', userController.topupWallet);

// Vouchers
router.get('/vouchers', userController.getVouchers);
router.post('/vouchers/claim', userController.claimVoucher);

module.exports = router;
