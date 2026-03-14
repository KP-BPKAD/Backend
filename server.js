// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const activityLogger = require('./middleware/activityLogger');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// === 1. KONEKSI DATABASE ===
connectDB();

// === 2. MIDDLEWARE UMUM (WAJIB DI ATAS ROUTE) ===
app.use(cors()); // ← CORS pertama
app.use(helmet()); // keamanan header
app.use(express.json({ limit: '10mb' })); // parse JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // file statis

// === 3. RATE LIMITER ===
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 10,
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Terapkan rate limiter HANYA untuk login
app.use('/api/auth/login', loginLimiter);

// === 4. ROUTES ===
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', auth, activityLogger); // ✅ Benar
app.use('/api/letters', require('./routes/letterRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/classifications', require('./routes/classificationRoutes')); 

// 🔑 Tambahkan ini untuk history
app.use('/api/history', require('./routes/historyRoutes'));

// === 5. ROOT ROUTE ===
app.get('/', (req, res) => {
  res.send('Backend surat MERN aktif!');
});

// === 6. JALANKAN SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});