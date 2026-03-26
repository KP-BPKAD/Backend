// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const activityLogger = require('./middleware/activityLogger');
const auth = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// === 1. KONEKSI DATABASE ===
connectDB();

// === 2. MIDDLEWARE UMUM ===
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// ✅ Pastikan folder uploads ada (untuk temporary upload sebelum ke Cloudinary)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 uploads folder created');
}
app.use('/uploads', express.static(uploadsDir)); // hanya untuk dev/testing

// === 3. RATE LIMITER ===
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// === 4. ROUTES ===
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', auth, activityLogger);
app.use('/api/letters', require('./routes/letterRoutes')); // ✅ Sudah versi Cloudinary
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/classifications', require('./routes/classificationRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

// === 5. ROOT & HEALTH ===
app.get('/', (req, res) => {
  res.send('Backend surat MERN aktif!');
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === 6. JALANKAN SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});