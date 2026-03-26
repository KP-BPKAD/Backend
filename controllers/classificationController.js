// controllers/classificationController.js
const Classification = require('../models/Classification');
const { logActivity } = require('../utils/logActivity'); // ← tambahkan ini

// GET /api/classifications — semua klasifikasi
const getClassifications = async (req, res) => {
  try {
    const classifications = await Classification.find().sort({ nama: 1 });
    
    // Log akses klasifikasi (opsional)
    await logActivity(req.user.id, 'view_classifications', 'User mengakses daftar klasifikasi', req);
    
    res.json(classifications);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil klasifikasi.' });
  }
};

// POST /api/classifications — tambah klasifikasi
const createClassification = async (req, res) => {
  try {
    const { nama, deskripsi, warna } = req.body;

    if (!nama) {
      return res.status(400).json({ message: 'Nama klasifikasi wajib diisi.' });
    }

    const existing = await Classification.findOne({ nama });
    if (existing) {
      return res.status(400).json({ message: 'Nama klasifikasi sudah digunakan.' });
    }

    const classification = new Classification({
      nama,
      deskripsi,
      warna
    });

    await classification.save();
    
    // Log penambahan klasifikasi
    await logActivity(req.user.id, 'manage_classification', `Klasifikasi "${nama}" ditambahkan`, req);
    
    res.status(201).json({ message: 'Klasifikasi berhasil ditambahkan.', classification });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambahkan klasifikasi.' });
  }
};

// PUT /api/classifications/:id — edit klasifikasi
const updateClassification = async (req, res) => {
  try {
    const { nama, deskripsi, warna } = req.body;
    const id = req.params.id;

    const classification = await Classification.findById(id);
    if (!classification) {
      return res.status(404).json({ message: 'Klasifikasi tidak ditemukan.' });
    }

    const oldNama = classification.nama; // Simpan nama lama

    if (nama && nama !== classification.nama) {
      const existing = await Classification.findOne({ nama });
      if (existing) {
        return res.status(400).json({ message: 'Nama klasifikasi sudah digunakan.' });
      }
    }

    classification.nama = nama || classification.nama;
    classification.deskripsi = deskripsi || classification.deskripsi;
    classification.warna = warna || classification.warna;

    await classification.save();
    
    // Log pengubahan klasifikasi
    await logActivity(req.user.id, 'manage_classification', `Klasifikasi "${oldNama}" diubah menjadi "${classification.nama}"`, req);
    
    res.json({ message: 'Klasifikasi berhasil diperbarui.', classification });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui klasifikasi.' });
  }
};

// DELETE /api/classifications/:id — hapus klasifikasi
const deleteClassification = async (req, res) => {
  try {
    const id = req.params.id;

    const classification = await Classification.findById(id);
    if (!classification) {
      return res.status(404).json({ message: 'Klasifikasi tidak ditemukan.' });
    }

    // Cek apakah klasifikasi digunakan oleh surat
    const Letter = require('../models/Letter');
    const usedBy = await Letter.findOne({ klasifikasiId: id });
    if (usedBy) {
      return res.status(400).json({ message: 'Klasifikasi sedang digunakan oleh surat, tidak bisa dihapus.' });
    }

    const nama = classification.nama; // Simpan nama sebelum dihapus

    const result = await Classification.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ message: 'Klasifikasi tidak ditemukan.' });
    }

    // Log penghapusan klasifikasi
    await logActivity(req.user.id, 'manage_classification', `Klasifikasi "${nama}" dihapus`, req);
    
    res.json({ message: 'Klasifikasi berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus klasifikasi.' });
  }
};

module.exports = {
  getClassifications,
  createClassification,
  updateClassification,
  deleteClassification
};