// routes/historyRoutes.js
const express = require('express');
const { getHistory, clearHistory, clearOwnHistory } = require('../controllers/historyController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin'); // hanya untuk admin

const router = express.Router();

// Semua role bisa akses riwayatnya sendiri
router.get('/', auth, getHistory);

// Hanya admin bisa hapus semua
router.delete('/clear', auth, admin, clearHistory);

// Petugas/pimpinan bisa hapus riwayatnya sendiri
router.delete('/clear-own', auth, clearOwnHistory);

module.exports = router;