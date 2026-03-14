// routes/authRoutes.js
const express = require('express');
const { register, login, logout, getProfile, updateProfile, deleteAccount } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout); // ← tambahkan ini
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.delete('/account', auth, deleteAccount);

module.exports = router;