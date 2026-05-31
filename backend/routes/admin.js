const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, authorize } = require('../middleware/auth');

// Protect all admin routes using JWT and role verification
router.use(authMiddleware);
router.use(authorize('admin'));

// 1. Dashboard & Statistics & System Monitoring Logs
router.get('/stats', adminController.getStats);
router.get('/notifications', adminController.getAdminNotifications);

// 2. User CRUD
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// 3. Partner Registration Approval
router.get('/partners', adminController.getPartners);
router.put('/partners/:id/approve', adminController.approvePartner);
router.put('/partners/:id/reject', adminController.rejectPartner);

// 4. System Configurations (Operation, Logistics, Payment, UI & Notification)
router.get('/configs', adminController.getConfigs);
router.put('/configs', adminController.updateConfigs);

// 5. User Complaints & Processing
router.get('/complaints', adminController.getComplaints);
router.put('/complaints/:id', adminController.resolveComplaint);

// 6. Category Management (CRUD & Display Sorting & Deactivation)
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// 7. Hot Campaigns & Promotions
router.get('/campaigns', adminController.getCampaigns);
router.post('/campaigns', adminController.createCampaign);
router.put('/campaigns/:id/hot', adminController.toggleHotCampaign);
router.put('/campaigns/:id', adminController.updateCampaign);
router.delete('/campaigns/:id', adminController.deleteCampaign);

// 8. Admin Wallet Management
router.get('/wallet', adminController.getWallet);
router.post('/wallet/withdraw', adminController.withdrawWallet);

// 9. Logistics & Order Control Tower
router.get('/logistics', adminController.getLogisticsData);

module.exports = router;
