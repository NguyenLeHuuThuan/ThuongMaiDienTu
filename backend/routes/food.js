const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');

router.get('/categories', foodController.getCategories);
router.get('/restaurants', foodController.getRestaurants);
router.get('/', foodController.getFoods);
router.get('/:id', foodController.getFoodDetail);

module.exports = router;
