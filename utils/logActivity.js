// utils/logActivity.js
const History = require('../models/History');

const logActivity = async (userId, action, description, req) => {
  try {
    await History.create({
      userId,
      action,
      description,
      ipAddress: req?.ip || req?.headers['x-forwarded-for'] || 'Unknown',
      userAgent: req?.get('User-Agent') || 'Unknown',
      timestamp: new Date()
    });
  } catch (err) {
    console.warn('Gagal simpan riwayat:', err.message);
  }
};

module.exports = { logActivity };