// routes/letterRoutes.js
const express = require('express');
const path = require('path');
const Letter = require('../models/Letter');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const archiver = require('archiver');
const fs = require('fs');
const cloudinary = require('cloudinary').v2; // ✅ Import Cloudinary

const router = express.Router();

// 🔧 Konfigurasi Cloudinary dari environment variable
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// === SETUP MULTER (hanya untuk upload sementara ke temp file, lalu di-upload ke Cloudinary) ===
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Simpan sementara di local folder (untuk diupload ke Cloudinary)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// 🔑 1. Route ADMIN: lihat semua surat — filter unik berdasarkan suratId
router.get('/all', auth, admin, async (req, res) => {
  try {
    const allLetters = await Letter.find()
      .populate('pengirimId', 'email')
      .populate('penerimaId', 'email');

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

// 📤 2. Kirim surat (CREATE) — DENGAN CLOUDINARY
router.post('/', auth, upload.single('arsipDigital'), async (req, res) => {
  try {
    const {
      noUrut, noSurat, tanggalTerima, tanggalDisposisi, asalSurat, perihal,
      keterangan, tanggalDisposisiBidang, jabatan, nama, nip, penerimaEmail,
      klasifikasiId, arsipDigital // ini adalah field dari form, bukan file
    } = req.body;

    let arsipDigitalUrl = '';

    // Upload file ke Cloudinary jika ada
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'bpkad_surat',
          resource_type: 'auto',
          invalidate: true // agar URL baru selalu fresh
        });
        arsipDigitalUrl = result.secure_url; // ✅ Simpan URL publik
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ message: 'Gagal mengunggah file ke Cloudinary.' });
      }
    }

    // Buat surat baru
    const newLetter = new Letter({
      noUrut,
      noSurat,
      tanggalTerima,
      tanggalDisposisi,
      asalSurat,
      perihal,     
      keterangan,
      tanggalDisposisiBidang,
      jabatan,
      nama,
      nip,
      penerimaEmail,
      klasifikasiId,
      arsipDigital: arsipDigitalUrl, // ✅ Simpan URL, bukan path lokal
      ownerId: req.user.id
    });

    await newLetter.save();
    res.status(201).json(newLetter);
  } catch (err) {
    console.error('Error di POST /letters:', err);
    res.status(500).json({ message: 'Gagal mengirim surat.' });
  }
});

// 📥 3. Surat MASUK (untuk penerima)
router.get('/masuk', auth, async (req, res) => {
  try {
    const letters = await Letter.find({ penerimaId: req.user.id })
      .populate('pengirimId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });
    res.json(letters);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil surat masuk.' });
  }
});

// 📤 4. Surat KELUAR (untuk pengirim)
router.get('/keluar', auth, async (req, res) => {
  try {
    const letters = await Letter.find({ pengirimId: req.user.id })
      .populate('penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });
    res.json(letters);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil surat keluar.' });
  }
});

// 📥 5. Surat KELUAR (pencarian)
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

    // Filter unik berdasarkan suratId
    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    res.json(Object.values(uniqueMap));
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencari surat keluar.' });
  }
});

// 📥 6. Surat MASUK (pencarian)
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

    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    res.json(Object.values(uniqueMap));
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencari surat masuk.' });
  }
});

// 🔍 7. Detail surat
router.get('/:id', auth, async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id)
      .populate('pengirimId', 'email')
      .populate('penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna');

    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    // Pastikan user adalah pengirim atau penerima
    const isSender = letter.pengirimId?._id?.toString() === req.user.id.toString();
    const isReceiver = letter.penerimaId?._id?.toString() === req.user.id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    res.json(letter); // ✅ Kirim data lengkap, termasuk arsipDigital (URL publik)
  } catch (err) {
    console.error('Error di /letters/:id:', err);
    res.status(500).json({ message: 'Gagal mengambil detail surat.' });
  }
});

// ✏️ 8. Edit surat
router.put('/:id', auth, upload.single('arsipDigital'), async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const isOwner = letter.pengirimId?.toString() === req.user.id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Hanya pengirim atau admin yang bisa edit.' });
    }

    // Update fields
    letter.noUrut = req.body.noUrut ?? letter.noUrut;
    letter.noSurat = req.body.noSurat ?? letter.noSurat;
    letter.tanggalTerima = req.body.tanggalTerima ?? letter.tanggalTerima;
    letter.tanggalDisposisi = req.body.tanggalDisposisi ?? letter.tanggalDisposisi;
    letter.asalSurat = req.body.asalSurat ?? letter.asalSurat;
    letter.perihal = req.body.perihal ?? letter.perihal;
    letter.keterangan = req.body.keterangan ?? letter.keterangan;
    letter.tanggalDisposisiBidang = req.body.tanggalDisposisiBidang ?? letter.tanggalDisposisiBidang;
    letter.jabatan = req.body.jabatan ?? letter.jabatan;
    letter.nama = req.body.nama ?? letter.nama;
    letter.nip = req.body.nip ?? letter.nip;
    letter.penerimaEmail = req.body.penerimaEmail ?? letter.penerimaEmail;
    letter.klasifikasiId = req.body.klasifikasiId ?? letter.klasifikasiId;

    // Jika ada file baru, upload ke Cloudinary
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'bpkad_surat',
          resource_type: 'auto',
          invalidate: true
        });
        letter.arsipDigital = result.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ message: 'Gagal mengunggah file baru.' });
      }
    }

    await letter.save();
    res.json(letter);
  } catch (err) {
    console.error('Error update surat:', err);
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
});

// 🗑️ 9. Hapus surat
router.delete('/:id', auth, async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const isOwner = letter.pengirimId?.toString() === req.user.id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Hanya pengirim atau admin yang bisa hapus.' });
    }

    await letter.remove();
    res.json({ message: 'Surat berhasil dihapus.' });
  } catch (err) {
    console.error('Error hapus surat:', err);
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
});

// ⬇️ 10. Unduh surat + metadata (ZIP) — *Opsional*: Anda bisa skip ini karena file sudah publik
// Jika tetap ingin ZIP, gunakan URL publik dari arsipDigital untuk download file asli via fetch ke Cloudinary
router.get('/:id/download', auth, async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id)
      .populate('pengirimId', 'email')
      .populate('penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna');

    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const isSender = letter.pengirimId?._id?.toString() === req.user.id.toString();
    const isReceiver = letter.penerimaId?._id?.toString() === req.user.id.toString();
    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    // Jika arsipDigital adalah URL Cloudinary, kita bisa unduh langsung dari sana
    if (!letter.arsipDigital) {
      return res.status(404).json({ message: 'File arsip tidak tersedia.' });
    }

    // ⚠️ Catatan: Untuk produksi, lebih baik gunakan signed URL atau proxy ke Cloudinary
    // Untuk demo, kita asumsikan public URL bisa diakses langsung
    const response = await fetch(letter.arsipDigital);
    if (!response.ok) {
      return res.status(404).json({ message: 'File asli tidak dapat diunduh.' });
    }

    const blob = await response.blob();
    const zipName = `surat_${letter.noSurat.replace(/\//g, '_')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Tambahkan file asli (dari Cloudinary)
    archive.append(blob, { name: `${letter.noSurat.replace(/\//g, '_')}${path.extname(letter.arsipDigital)}` });

    // Tambahkan data surat
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
Tgl Disposisi Bidang: ${letter.tanggalDisposisiBidang ? new Date(letter.tanggalDisposisiBidang).toLocaleDateString('id-ID') : '-'}
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