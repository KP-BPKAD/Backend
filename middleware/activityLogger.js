// middleware/activityLogger.js
const History = require('../models/History');

const logActivity = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(); // Skip jika tidak ada user (misal: public route)

  const logData = {
    userId,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
    userAgent: req.get('User-Agent') || 'Unknown'
  };

  // Simpan log setelah response selesai
  res.on('finish', async () => {
    try {
      let action = null;
      let description = '';

      // 1. Auth
      if (req.path === '/api/auth/login' && req.method === 'POST') {
        action = 'login';
        description = 'User berhasil login';
      } else if (req.path === '/api/auth/logout' && req.method === 'POST') {
        action = 'logout';
        description = 'User logout';
      }

      // 2. Letters
      else if (req.path.startsWith('/api/letters') && req.method === 'POST') {
        action = 'send_letter';
        description = `Surat dikirim`;
      } else if (req.path.startsWith('/api/letters') && req.method === 'PUT') {
        action = 'edit_letter';
        description = `Surat di-edit`;
      } else if (req.path.startsWith('/api/letters') && req.method === 'DELETE') {
        action = 'delete_letter';
        description = `Surat dihapus`;
      }

      // 3. Reports
      else if (req.path.startsWith('/api/reports') && req.method === 'GET') {
        action = 'view_report';
        description = 'Laporan diakses';
      }

      // 4. Classifications
      else if (req.path.startsWith('/api/classifications') && req.method === 'POST') {
        action = 'manage_classification';
        description = 'Klasifikasi ditambahkan';
      } else if (req.path.startsWith('/api/classifications') && req.method === 'PUT') {
        action = 'manage_classification';
        description = 'Klasifikasi diubah';
      } else if (req.path.startsWith('/api/classifications') && req.method === 'DELETE') {
        action = 'manage_classification';
        description = 'Klasifikasi dihapus';
      }

      // 5. Users
      else if (req.path.startsWith('/api/users') && req.method === 'POST') {
        action = 'manage_user';
        description = 'User ditambahkan';
      } else if (req.path.startsWith('/api/users') && req.method === 'PUT') {
        action = 'manage_user';
        description = 'User diubah';
      } else if (req.path.startsWith('/api/users') && req.method === 'DELETE') {
        action = 'manage_user';
        description = 'User dihapus';
      }

      // Jika tidak cocok dengan kondisi di atas, skip
      if (!action) return;

      // Simpan ke database
      await History.create({
        ...logData,
        action,
        description,
        timestamp: new Date()
      });

    } catch (err) {
      console.warn('Gagal simpan riwayat:', err.message);
    }
  });

  next();
};

module.exports = logActivity;