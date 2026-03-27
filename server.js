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
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// ❌ JANGAN GUNAKAN /uploads UNTUK FILE LOCAL — HANYA UNTUK STATIS JIKA DIBUTUHKAN NANTI
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // KOMENTARI INI

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', auth, activityLogger);
app.use('/api/letters', require('./routes/letterRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/classifications', require('./routes/classificationRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

app.get('/', (req, res) => {
  res.send('Backend surat MERN aktif!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});