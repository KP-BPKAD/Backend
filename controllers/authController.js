// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../utils/logActivity'); // ← tambahkan ini

// --- Register ---
const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // VALIDASI INPUT (ditambahkan tanpa mengubah logika existing)
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });
    }
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const user = new User({ email, password });
    await user.save();
    
    // Log aktivitas registrasi (opsional)
    await logActivity(user._id, 'register', 'User berhasil register', req);
    
    res.status(201).json({ message: 'Registrasi berhasil!' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

// --- Login ---
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email atau password salah.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Email atau password salah.' });

    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        role: user.role   // ← TAMBAHKAN INI!
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Simpan log login
    await logActivity(user._id, 'login', 'User berhasil login', req);

    // Kirim juga role ke frontend
    res.json({ 
      token, 
      role: user.role, // ← tambahkan ini
      message: 'Login berhasil!' 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// --- Logout ---
const logout = async (req, res) => {
  try {
    // Simpan log logout
    await logActivity(req.user.id, 'logout', 'User logout', req);
    
    res.json({ message: 'Logout berhasil.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal logout.' });
  }
};

// --- Get Profile (Read) ---
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
    
    // Log akses profil (opsional)
    await logActivity(req.user.id, 'view_profile', 'User mengakses profil', req);
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data profil.' });
  }
};

// --- Update Profile (Opsional) ---
const updateProfile = async (req, res) => {
  try {
    const { email } = req.body;

    // VALIDASI TAMBAHAN UNTUK UPDATE (opsional tapi disarankan)
    if (!email) {
      return res.status(400).json({ message: 'Email wajib diisi.' });
    }
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { email },
      { new: true, runValidators: true }
    ).select('-password');
    
    // Log update profil
    await logActivity(req.user.id, 'update_profile', 'User memperbarui profil', req);
    
    res.json({ message: 'Profil berhasil diperbarui.', user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email sudah digunakan.' });
    }
    res.status(500).json({ message: 'Gagal memperbarui profil.' });
  }
};

// --- Delete Account (Opsional & Hati-hati!) ---
const deleteAccount = async (req, res) => {
  try {
    // Log penghapusan akun
    await logActivity(req.user.id, 'delete_account', 'User menghapus akun', req);
    
    await User.findByIdAndDelete(req.user.id);
    // Opsional: hapus semua surat milik user
    await require('../models/Letter').deleteMany({ userId: req.user.id });
    
    res.json({ message: 'Akun berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus akun.' });
  }
};

module.exports = {
  register,
  login,
  logout, // ← tambahkan ini
  getProfile,
  updateProfile,
  deleteAccount
};