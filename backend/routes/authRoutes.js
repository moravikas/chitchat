const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 1. Signup Route
router.post('/signup', authController.signup);

// 2. Login Route
router.post('/login', authController.login);

// 3. Forgot Password Route
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
