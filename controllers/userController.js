// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../utils/logActivity'); // ← tambahkan ini

// GET /api/users — semua user (admin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    // Log akses daftar user (opsional)
    await logActivity(req.user.id, 'view_users', 'User mengakses daftar pengguna', req);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil daftar user.' });
  }
};

// POST /api/users — tambah user (admin only)
const createUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await user.save();
    
    // ✅ LOG AKTIVITAS: Tambah User
    await logActivity(req.user.id, 'manage_user', `User "${email}" ditambahkan`, req);

    res.status(201).json({ message: 'User berhasil ditambahkan.', user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambahkan user.' });
  }
};

// PUT /api/users/:id — edit user
const updateUser = async (req, res) => {
  try {
    const { email, role } = req.body;
    const userId = req.params.id;

    // Cek apakah user ada
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    // Simpan data lama untuk deskripsi log
    const oldEmail = user.email;
    const oldRole = user.role;

    // Jika ganti email, pastikan belum dipakai
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: 'Email sudah digunakan oleh user lain.' });
      }
      user.email = email;
    }

    if (role) {
      user.role = role;
    }

    await user.save();
    
    // ✅ LOG AKTIVITAS: Edit User
    const changes = [];
    if (email && email !== oldEmail) changes.push(`email: ${oldEmail} → ${email}`);
    if (role && role !== oldRole) changes.push(`role: ${oldRole} → ${role}`);
    const changeDesc = changes.length > 0 ? ` (${changes.join(', ')})` : '';
    
    await logActivity(req.user.id, 'manage_user', `User "${oldEmail}" diubah${changeDesc}`, req);

    res.json({ message: 'User berhasil diperbarui.', user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui user.' });
  }
};

// DELETE /api/users/:id — hapus user
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Jangan izinkan hapus diri sendiri
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }
    
    // ✅ LOG AKTIVITAS: Hapus User
    await logActivity(req.user.id, 'manage_user', `User "${user.email}" dihapus`, req);

    res.json({ message: 'User berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus user.' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};