// controllers/historyController.js
const History = require('../models/History');
const User = require('../models/User');
const mongoose = require('mongoose');
const { logActivity } = require('../utils/logActivity'); // tambahkan jika perlu

const getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, user: userEmailOrId, action } = req.query;
    const skip = (page - 1) * limit;

    // Validasi input
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ message: 'Parameter halaman atau batas tidak valid.' });
    }

    let filter = {};

    // Admin bisa filter user lain, non-admin hanya bisa lihat riwayat sendiri
    if (req.user.role === 'admin') {
      // Admin: bisa filter berdasarkan email atau userId
      if (userEmailOrId) {
        if (mongoose.Types.ObjectId.isValid(userEmailOrId)) {
          filter.userId = userEmailOrId;
        } else {
          const user = await User.findOne({ email: { $regex: userEmailOrId, $options: 'i' } });
          if (user) {
            filter.userId = user._id;
          } else {
            return res.json({
              populatedHistory: [],
              pagination: {
                page: pageNum,
                limit: limitNum,
                total: 0,
                totalPages: 0
              }
            });
          }
        }
      }
    } else {
      // Non-admin (petugas/pimpinan): hanya lihat riwayat sendiri
      filter.userId = req.user.id;
    }

    // Filter action jika disediakan
    if (action) {
      filter.action = action;
    }

    // Ambil data history
    const historyDocs = await History.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    // Populasi userId
    const populatedHistory = await Promise.all(
      historyDocs.map(async (item) => {
        let userEmail = 'Unknown';
        let userExists = false;

        if (item.userId) {
          try {
            const user = await User.findById(item.userId).select('email');
            if (user) {
              userEmail = user.email;
              userExists = true;
            }
          } catch (err) {
            console.warn('User tidak ditemukan untuk userId:', item.userId);
          }
        }

        return {
          _id: item._id,
          userId: userExists ? { _id: item.userId, email: userEmail } : { email: 'Unknown' },
          action: item.action,
          description: item.description,
          ipAddress: item.ipAddress || 'N/A',
          userAgent: item.userAgent ? item.userAgent.substring(0, 50) + '...' : 'N/A',
          timestamp: item.timestamp,
        };
      })
    );

    const total = await History.countDocuments(filter);

    res.json({
      populatedHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ message: 'Gagal mengambil riwayat.' });
  }
};

const clearOwnHistory = async (req, res) => {
  try {
    // Hanya hapus riwayat milik req.user.id
    const deletedCount = await History.deleteMany({ userId: req.user.id });
    
    // Log aktivitas hapus riwayat sendiri
    await logActivity(req.user.id, 'clear_own_history', `User menghapus ${deletedCount.deletedCount} riwayat miliknya`, req);
    
    res.json({ message: `Riwayat milik Anda berhasil dihapus (${deletedCount.deletedCount} entri).` });
  } catch (err) {
    console.error('Error clearing own history:', err);
    res.status(500).json({ message: 'Gagal menghapus riwayat.' });
  }
};



const clearHistory = async (req, res) => {
  try {
    await History.deleteMany({});
    res.json({ message: 'Riwayat berhasil dihapus.' });
  } catch (err) {
    console.error('Error clearing history:', err);
    res.status(500).json({ message: 'Gagal menghapus riwayat.' });
  }
};

module.exports = { getHistory, clearHistory, clearOwnHistory };