// routes/letterRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Letter = require('../models/Letter');
const User = require('../models/User'); // ← tambahkan jika belum ada
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const archiver = require('archiver');
const fs = require('fs');

const router = express.Router();

// Setup multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 🔑 1. Route ADMIN: lihat semua surat — filter unik berdasarkan suratId
router.get('/all', auth, admin, async (req, res) => {
  try {
    const allLetters = await Letter.find()
      .populate('pengirimId', 'email')
      .populate('penerimaId', 'email');

    // Filter unik: satu baris per suratId (ambil yang terbaru)
    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    const uniqueLetters = Object.values(uniqueMap);

    res.json(uniqueLetters);
  } catch (err) {
    console.error('Error di /letters/all:', err);
    res.status(500).json({ message: 'Gagal mengambil data surat.' });
  }
});

// 📤 2. Kirim surat (CREATE)
router.post('/', auth, upload.single('arsipDigital'), async (req, res) => {
  try {
    const { createLetter } = require('../controllers/letterController');
    return createLetter(req, res);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengirim surat.' });
  }
});

// 📥 3. Surat MASUK (untuk penerima)
router.get('/masuk', auth, async (req, res) => {
  try {
    const { getIncomingLetters } = require('../controllers/letterController');
    return getIncomingLetters(req, res);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil surat masuk.' });
  }
});

// 📤 4. Surat KELUAR (untuk pengirim)
router.get('/keluar', auth, async (req, res) => {
  try {
    const { getOutgoingLetters } = require('../controllers/letterController');
    return getOutgoingLetters(req, res);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil surat keluar.' });
  }
});

// 📥 5. Surat KELUAR (untuk pengirim) - PENCARIAN — filter unik
router.get('/keluar/search', auth, async (req, res) => {
  try {
    const { q, startDate, endDate, classificationId } = req.query;
    let filter = { pengirimId: req.user.id };

    if (q) {
      filter.$or = [
        { noSurat: { $regex: q, $options: 'i' } },
        { perihal: { $regex: q, $options: 'i' } },
        { asalSurat: { $regex: q, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.tanggalTerima = {};
      if (startDate) filter.tanggalTerima.$gte = new Date(startDate);
      if (endDate) filter.tanggalTerima.$lte = new Date(endDate);
    }

    if (classificationId) {
      filter.klasifikasiId = classificationId;
    }

    const allLetters = await Letter.find(filter)
      .populate('penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });

    // ✅ Filter unik berdasarkan suratId (ambil yang terbaru)
    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    const uniqueLetters = Object.values(uniqueMap);

    res.json(uniqueLetters);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencari surat keluar.' });
  }
});

// 📥 6. Surat MASUK (untuk penerima) - PENCARIAN — filter unik
router.get('/masuk/search', auth, async (req, res) => {
  try {
    const { q, startDate, endDate, classificationId } = req.query;
    let filter = { penerimaId: req.user.id };

    if (q) {
      filter.$or = [
        { noSurat: { $regex: q, $options: 'i' } },
        { perihal: { $regex: q, $options: 'i' } },
        { asalSurat: { $regex: q, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.tanggalTerima = {};
      if (startDate) filter.tanggalTerima.$gte = new Date(startDate);
      if (endDate) filter.tanggalTerima.$lte = new Date(endDate);
    }

    if (classificationId) {
      filter.klasifikasiId = classificationId;
    }

    const allLetters = await Letter.find(filter)
      .populate('pengirimId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });

    // ✅ Filter unik berdasarkan suratId (ambil yang terbaru)
    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    const uniqueLetters = Object.values(uniqueMap);

    res.json(uniqueLetters);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencari surat masuk.' });
  }
});

// 🔍 7. Detail surat (selalu ambil dari outgoing agar biodata muncul)
router.get('/:id', auth, async (req, res) => {
  try {
    // Ambil surat berdasarkan ID
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    // Cari salinan 'outgoing' dengan suratId yang sama agar biodata muncul
    const outgoingLetter = await Letter.findOne({
      suratId: letter.suratId,
      type: 'outgoing'
    }).populate('pengirimId', 'email')
      .populate('penerimaId', 'email')   // ✅ Tambahkan ini
      .populate('klasifikasiId', 'nama warna');

    if (!outgoingLetter) {
      return res.status(404).json({ message: 'Salinan pengirim tidak ditemukan.' });
    }

    // Pastikan user adalah pengirim atau penerima
    const isSender = outgoingLetter.ownerId.toString() === req.user.id.toString();
    const isReceiver = letter.ownerId.toString() === req.user.id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    // Log akses detail surat (opsional)
    const { logActivity } = require('../utils/logActivity');
    await logActivity(req.user.id, 'view_letter_detail', `User melihat detail surat "${letter.noSurat}"`, req);

    res.json(outgoingLetter); // Kirim salinan outgoing agar biodata muncul
  } catch (err) {
    console.error('Error di /letters/:id:', err);
    res.status(500).json({ message: 'Gagal mengambil detail surat.' });
  }
});

// ✏️ 8. Edit surat (hanya pengirim atau admin)
router.put('/:id', auth, upload.single('arsipDigital'), async (req, res) => {
  try {
    const { updateLetter } = require('../controllers/letterController');
    return updateLetter(req, res);
  } catch (err) {
    console.error('Error update surat via route:', err);
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
});

// 🗑️ 9. Hapus surat (hanya pengirim atau admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { deleteLetter } = require('../controllers/letterController');
    return deleteLetter(req, res);
  } catch (err) {
    console.error('Error hapus surat via route:', err);
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
});

// 🔥 ADMIN: Edit surat milik siapa pun
router.put('/admin/:id', auth, admin, upload.single('arsipDigital'), async (req, res) => {
  try {
    const { adminUpdateLetter } = require('../controllers/letterController');
    return adminUpdateLetter(req, res);
  } catch (err) {
    console.error('Error admin update surat via route:', err);
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
});

// 🔥 ADMIN: Hapus surat milik siapa pun
router.delete('/admin/:id', auth, admin, async (req, res) => {
  try {
    const { adminDeleteLetter } = require('../controllers/letterController');
    return adminDeleteLetter(req, res);
  } catch (err) {
    console.error('Error admin hapus surat via route:', err);
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
});

// 🔥 HAPUS PERMANEN: Semua role bisa hapus semua surat secara permanen - TANPA BATAS
router.delete('/permanent/:id', auth, async (req, res) => {
  try {
    const { deleteLetterPermanent } = require('../controllers/letterController');
    return deleteLetterPermanent(req, res);
  } catch (err) {
    console.error('Error hapus permanen via route:', err);
    res.status(500).json({ message: 'Gagal menghapus surat secara permanen.' });
  }
});

// ⬇️ 10. Unduh surat + metadata (ZIP) - FIX KLASIFIKASI DI DOWNLOAD
router.get('/:id/download', auth, async (req, res) => {
  try {
    let letter;

    // Cek akses
    if (req.user.role === 'admin') {
      letter = await Letter.findById(req.params.id)
        .populate('pengirimId', 'email')
        .populate('penerimaId', 'email')
        .populate('klasifikasiId', 'nama warna'); // ✅ FIX: Tambahkan populate
    } else {
      letter = await Letter.findOne({
        _id: req.params.id,
        $or: [
          { pengirimId: req.user.id },
          { penerimaId: req.user.id }
        ]
      })
        .populate('pengirimId', 'email')
        .populate('penerimaId', 'email')
        .populate('klasifikasiId', 'nama warna'); // ✅ FIX: Tambahkan populate
    }

    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const filePath = path.join(__dirname, '..', letter.arsipDigital);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File arsip tidak ditemukan.' });
    }

    const originalFileName = path.basename(letter.arsipDigital);
    const zipName = `surat_${letter.noSurat.replace(/\//g, '_')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Tambahkan file asli
    archive.file(filePath, { name: originalFileName });

    // Tambahkan data surat - FIX KLASIFIKASI DI SINI
    const dataText = `
DATA SURAT
==========
No Urut            : ${letter.noUrut}
No Surat           : ${letter.noSurat}
Tanggal Terima     : ${new Date(letter.tanggalTerima).toLocaleDateString('id-ID')}
Tanggal Disposisi  : ${letter.tanggalDisposisi ? new Date(letter.tanggalDisposisi).toLocaleDateString('id-ID') : '-'}
Asal Surat         : ${letter.asalSurat}
Perihal            : ${letter.perihal}
Keterangan         : ${letter.keterangan}
Tgl Disposisi Bidang: ${letter.tanggalDisposisiBidang ? new Date(letterisiBidang).toLocaleDateString('id-ID') : '-'}
Jabatan            : ${letter.jabatan}
Nama               : ${letter.nama}
NIP                : ${letter.nip}
Pengirim           : ${letter.pengirimId?.email || '–'}
Penerima           : ${letter.penerimaId?.email || '–'}
Klasifikasi        : ${letter.klasifikasiId?.nama || '–'}  
`;
    archive.append(dataText, { name: 'data_surat.txt' });

    await archive.finalize();
  } catch (err) {
    console.error('Error download:', err);
    res.status(500).json({ message: 'Gagal mengunduh surat.' });
  }
});

module.exports = router;
