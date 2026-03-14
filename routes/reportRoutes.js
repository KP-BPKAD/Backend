// routes/reportRoutes.js
const express = require('express');
const { getMonthlyReport } = require('../controllers/reportController');
const auth = require('../middleware/auth');

const router = express.Router();

// Hanya pimpinan & admin yang bisa akses
router.get('/monthly', auth, (req, res, next) => {
  if (req.user.role === 'pimpinan' || req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Akses khusus pimpinan/admin.' });
  }
}, getMonthlyReport);

module.exports = router;