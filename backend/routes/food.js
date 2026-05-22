const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');

router.get('/categories', foodController.getCategories);
router.get('/restaurants', foodController.getRestaurants);
router.get('/restaurants/:id', foodController.getRestaurantDetail);
router.get('/promotions', foodController.getPromotions);
router.get('/', foodController.getFoods);
router.get('/:id', foodController.getFoodDetail);
router.get('/:id/reviews', foodController.getFoodReviews);

module.exports = router;
