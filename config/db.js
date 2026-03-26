// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Hanya butuh MONGO_URI — tanpa opsi tambahan
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Berhasil terhubung ke MongoDB Atlas');
  } catch (error) {
    console.error('❌ Gagal terhubung ke MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;