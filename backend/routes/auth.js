const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', authController.register);
router.post('/register-shipper', authController.registerShipper);
router.post('/register-restaurant', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'cover_image', maxCount: 1 }
]), authController.registerRestaurant);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
