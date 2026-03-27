// controllers/letterController.js
const Letter = require('../models/Letter');
const User = require('../models/User');
const History = require('../models/History');
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios'); // Import axios

// fs.promises tidak lagi digunakan untuk menghapus file lokal
// const fs = require('fs').promises; // Commented out or removed

// Tidak ada import/config cloudinary lagi

const { logActivity } = require('../utils/logActivity');

const isValidFileType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  return /\.(pdf|docx|xlsx|jpg|jpeg|png|txt)$/i.test(ext);
};

const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date.toString() !== 'Invalid Date' && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

// CREATE — buat 2 dokumen (outgoing + incoming)
const createLetter = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File arsip digital wajib diunggah.' });
    if (!isValidFileType(req.file.originalname)) { // Gunakan originalname dari buffer
      return res.status(400).json({ message: 'Hanya file .pdf, .docx, .xlsx, .jpg, .jpeg, .png, .txt yang diperbolehkan.' });
    }

    const {
      noUrut, noSurat, tanggalTerima, tanggalDisposisi, asalSurat,
      perihal, keterangan, tanggalDisposisiBidang, jabatan, nama, nip,
      penerimaEmail, klasifikasiId
    } = req.body;

    if (!noUrut || !noSurat || !tanggalTerima || !asalSurat || !perihal || !nama || !nip || !penerimaEmail) {
      return res.status(400).json({ message: 'Semua field wajib diisi, termasuk penerima email.' });
    }

    const parsedNoUrut = parseInt(noUrut);
    if (isNaN(parsedNoUrut) || parsedNoUrut <= 0) {
      return res.status(400).json({ message: 'Nomor urut harus berupa angka positif.' });
    }

    if (!isValidDate(tanggalTerima)) {
      return res.status(400).json({ message: 'Format tanggal terima tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisi && !isValidDate(tanggalDisposisi)) {
      return res.status(400).json({ message: 'Format tanggal disposisi tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisiBidang && !isValidDate(tanggalDisposisiBidang)) {
      return res.status(400).json({ message: 'Format tanggal disposisi bidang tidak valid. Gunakan YYYY-MM-DD.' });
    }

    if (!/^\d+$/.test(nip) || nip.length > 20 || nip.length < 9) {
      return res.status(400).json({ message: 'NIP hanya boleh berisi angka (9–20 digit).' });
    }

    if (nama.length > 100) {
      return res.status(400).json({ message: 'Nama terlalu panjang (maks 100 karakter).' });
    }

    const penerima = await User.findOne({ email: penerimaEmail });
    if (!penerima) {
      return res.status(400).json({ message: 'Penerima tidak terdaftar dalam sistem.' });
    }

    let klasifikasiIdObj = null;
    if (klasifikasiId && mongoose.Types.ObjectId.isValid(klasifikasiId)) {
      klasifikasiIdObj = new mongoose.Types.ObjectId(klasifikasiId);
    }

    const suratId = `SURAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let arsipDigitalUrl = '';

    // Upload file ke Cloudinary via axios
    if (req.file) {
      const formData = new FormData();
      // Catatan: node-fetch dan axios membutuhkan buffer untuk file dalam FormData
      // Multer di routes/letterRoutes.js harus menggunakan memoryStorage
      formData.append('file', req.file.buffer, { filename: req.file.originalname });
      formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET); // Gunakan preset yang dibuat di dashboard Cloudinary
      formData.append('folder', 'bpkad_surat');

      try {
        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData,
          {
            headers: {
              ...formData.getHeaders(), // Penting: untuk multipart/form-data
            },
            auth: {
              username: process.env.CLOUDINARY_API_KEY,
              password: process.env.CLOUDINARY_API_SECRET,
            },
          }
        );
        arsipDigitalUrl = response.data.secure_url; // Ambil URL dari respons Cloudinary
      } catch (uploadError) {
        console.error('Error uploading to Cloudinary via axios:', uploadError.response?.data || uploadError.message);
        return res.status(500).json({ message: 'Gagal mengunggah file ke Cloudinary.' });
      }
    }


    const outgoingLetter = new Letter({
      suratId,
      ownerId: req.user.id,
      type: 'outgoing',
      noSurat,
      noUrut: parsedNoUrut,
      perihal,
      asalSurat,
      keterangan,
      tanggalTerima: new Date(tanggalTerima),
      tanggalDisposisi: tanggalDisposisi ? new Date(tanggalDisposisi) : undefined,
      tanggalDisposisiBidang: tanggalDisposisiBidang ? new Date(tanggalDisposisiBidang) : undefined,
      jabatan,
      nama,
      nip,
      arsipDigital: arsipDigitalUrl, // Gunakan URL dari axios
      pengirimId: req.user.id,
      penerimaId: penerima._id,
      klasifikasiId: klasifikasiIdObj
    });

    const incomingLetter = new Letter({
      suratId,
      ownerId: penerima._id,
      type: 'incoming',
      noSurat,
      noUrut: parsedNoUrut,
      perihal,
      asalSurat,
      keterangan,
      tanggalTerima: new Date(tanggalTerima),
      tanggalDisposisi: undefined,
      tanggalDisposisiBidang: undefined,
      jabatan: '',
      nama: '',
      nip: '',
      arsipDigital: arsipDigitalUrl, // Gunakan URL dari axios
      pengirimId: req.user.id,
      penerimaId: penerima._id,
      klasifikasiId: klasifikasiIdObj
    });

    await Promise.all([outgoingLetter.save(), incomingLetter.save()]);

    await logActivity(req.user.id, 'send_letter', `Surat "${noSurat}" dikirim ke ${penerima.email}`, req);

    res.status(201).json({ 
      message: 'Surat berhasil dikirim.', 
      letter: outgoingLetter
    });
  } catch (error) {
    console.error('Error createLetter:', error);
    res.status(500).json({ message: 'Gagal mengirim surat.' });
  }
};

// READ: Surat Masuk — filter unik
const getIncomingLetters = async (req, res) => {
  try {
    const allLetters = await Letter.find({
      ownerId: req.user.id,
      type: 'incoming'
    })
      .populate('pengirimId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });

    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    const uniqueLetters = Object.values(uniqueMap);

    await logActivity(req.user.id, 'view_incoming_letters', 'User mengakses surat masuk', req);
    res.json(uniqueLetters);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil surat masuk.' });
  }
};

// READ: Surat Keluar — filter unik
const getOutgoingLetters = async (req, res) => {
  try {
    const allLetters = await Letter.find({
      ownerId: req.user.id,
      type: 'outgoing'
    })
      .populate('penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna')
      .sort({ createdAt: -1 });

    const uniqueMap = {};
    allLetters.forEach(letter => {
      if (!uniqueMap[letter.suratId] || letter.createdAt > uniqueMap[letter.suratId].createdAt) {
        uniqueMap[letter.suratId] = letter;
      }
    });
    const uniqueLetters = Object.values(uniqueMap);

    await logActivity(req.user.id, 'view_outgoing_letters', 'User mengakses surat keluar', req);
    res.json(uniqueLetters);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil surat keluar.' });
  }
};

// READ ONE — ambil dari outgoing
const getLetterById = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const outgoingLetter = await Letter.findOne({
      suratId: letter.suratId,
      type: 'outgoing'
    }).populate('pengirimId penerimaId', 'email')
      .populate('klasifikasiId', 'nama warna');

    if (!outgoingLetter) {
      return res.status(404).json({ message: 'Salinan pengirim tidak ditemukan.' });
    }

    const isSender = outgoingLetter.ownerId.toString() === req.user.id.toString();
    const isReceiver = letter.ownerId.toString() === req.user.id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    await logActivity(req.user.id, 'view_letter_detail', `User melihat detail surat "${outgoingLetter.noSurat}"`, req);
    res.json(outgoingLetter);
  } catch (error) {
    console.error('Error getLetterById:', error);
    res.status(500).json({ message: 'Gagal mengambil detail surat.' });
  }
};

// UPDATE — versi aman
const updateLetter = async (req, res) => {
  try {
    const {
      noUrut, noSurat, tanggalTerima, tanggalDisposisi, asalSurat,
      perihal, keterangan, tanggalDisposisiBidang, jabatan, nama, nip, klasifikasiId
    } = req.body;

    const letter = await Letter.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
      type: 'outgoing'
    });
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan atau tidak memiliki izin edit.' });

    // Validasi input
    if (noUrut !== undefined) {
      const parsed = parseInt(noUrut);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'Nomor urut harus berupa angka positif.' });
      }
    }
    if (tanggalTerima !== undefined && !isValidDate(tanggalTerima)) {
      return res.status(400).json({ message: 'Format tanggal terima tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisi !== undefined && !isValidDate(tanggalDisposisi)) {
      return res.status(400).json({ message: 'Format tanggal disposisi tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisiBidang !== undefined && !isValidDate(tanggalDisposisiBidang)) {
      return res.status(400).json({ message: 'Format tanggal disposisi bidang tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (nip !== undefined) {
      if (!/^\d+$/.test(nip) || nip.length > 20 || nip.length < 9) {
        return res.status(400).json({ message: 'NIP hanya boleh berisi angka (9–20 digit).' });
      }
    }
    if (nama !== undefined && nama.length > 100) {
      return res.status(400).json({ message: 'Nama terlalu panjang (maks 100 karakter).' });
    }

    let updatedArsipDigitalUrl = letter.arsipDigital; // Default ke URL lama

    // Handle upload file baru via axios
    if (req.file) {
      if (!isValidFileType(req.file.originalname)) { // Gunakan originalname dari buffer
        return res.status(400).json({ message: 'Tipe file tidak diizinkan.' });
      }

      // Hapus file lama dari filesystem lokal (TIDAK BERLAKU LAGI UNTUK CLOUDINARY)
      // if (letter.arsipDigital) {
      //   const oldPath = path.join(__dirname, '..', letter.arsipDigital);
      //   await fs.unlink(oldPath).catch(() => {});
      // }

      // Upload file baru ke Cloudinary via axios
      const formData = new FormData();
      formData.append('file', req.file.buffer, { filename: req.file.originalname });
      formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET); // Gunakan preset yang sama
      formData.append('folder', 'bpkad_surat');

      try {
        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            auth: {
              username: process.env.CLOUDINARY_API_KEY,
              password: process.env.CLOUDINARY_API_SECRET,
            },
          }
        );
        updatedArsipDigitalUrl = response.data.secure_url; // Gunakan URL baru dari axios
      } catch (uploadError) {
        console.error('Error uploading new file to Cloudinary via axios (Update):', uploadError.response?.data || uploadError.message);
        return res.status(500).json({ message: 'Gagal mengunggah file baru ke Cloudinary.' });
      }
    }


    // Konversi klasifikasiId
    if (klasifikasiId !== undefined) {
      if (klasifikasiId && mongoose.Types.ObjectId.isValid(klasifikasiId)) {
        letter.klasifikasiId = new mongoose.Types.ObjectId(klasifikasiId);
      } else if (klasifikasiId === '') {
        letter.klasifikasiId = null;
      } else {
        return res.status(400).json({ message: 'Klasifikasi ID tidak valid.' });
      }
    }

    // Update field
    Object.assign(letter, {
      noUrut: noUrut !== undefined ? parseInt(noUrut) : letter.noUrut,
      noSurat: noSurat || letter.noSurat,
      tanggalTerima: tanggalTerima ? new Date(tanggalTerima) : letter.tanggalTerima,
      tanggalDisposisi: tanggalDisposisi ? new Date(tanggalDisposisi) : letter.tanggalDisposisi,
      asalSurat: asalSurat || letter.asalSurat,
      perihal: perihal || letter.perihal,
      keterangan: keterangan || letter.keterangan,
      tanggalDisposisiBidang: tanggalDisposisiBidang ? new Date(tanggalDisposisiBidang) : letter.tanggalDisposisiBidang,
      jabatan: jabatan !== undefined ? jabatan : letter.jabatan,
      nama: nama !== undefined ? nama : letter.nama,
      nip: nip !== undefined ? nip : letter.nip,
      arsipDigital: updatedArsipDigitalUrl // Gunakan URL dari axios
    });

    await letter.save();

    await logActivity(req.user.id, 'edit_letter', `Surat "${letter.noSurat}" diedit`, req);

    res.json({ message: 'Surat berhasil diperbarui.', letter });
  } catch (error) {
    console.error('Error updateLetter:', error);
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
};

// DELETE
const deleteLetter = async (req, res) => {
  try {
    const letter = await Letter.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user.id
    });
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan atau tidak memiliki izin hapus.' });

    // Hapus file dari filesystem lokal (TIDAK BERLAKU LAGI UNTUK CLOUDINARY)
    // if (letter.arsipDigital) {
    //   const filePath = path.join(__dirname, '..', letter.arsipDigital);
    //   await fs.unlink(filePath).catch(() => {});
    // }

    // Catatan: Anda mungkin ingin menambahkan logika untuk menghapus file dari Cloudinary berdasarkan URL atau public_id di sini.

    await logActivity(req.user.id, 'delete_letter', `Surat "${letter.noSurat}" dihapus (salinan ${letter.type})`, req);
    res.json({ message: 'Surat berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
};

// ADMIN: Update
const adminUpdateLetter = async (req, res) => {
  try {
    const { noUrut, noSurat, tanggalTerima, tanggalDisposisi, asalSurat,
      perihal, keterangan, tanggalDisposisiBidang, jabatan, nama, nip, klasifikasiId } = req.body;

    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    // Validasi input (sama seperti updateLetter normal)
    if (noUrut !== undefined) {
      const parsed = parseInt(noUrut);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'Nomor urut harus berupa angka positif.' });
      }
    }
    if (tanggalTerima !== undefined && !isValidDate(tanggalTerima)) {
      return res.status(400).json({ message: 'Format tanggal terima tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisi !== undefined && !isValidDate(tanggalDisposisi)) {
      return res.status(400).json({ message: 'Format tanggal disposisi tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (tanggalDisposisiBidang !== undefined && !isValidDate(tanggalDisposisiBidang)) {
      return res.status(400).json({ message: 'Format tanggal disposisi bidang tidak valid. Gunakan YYYY-MM-DD.' });
    }
    if (nip !== undefined) {
      if (!/^\d+$/.test(nip) || nip.length > 20 || nip.length < 9) {
        return res.status(400).json({ message: 'NIP hanya boleh berisi angka (9–20 digit).' });
      }
    }
    if (nama !== undefined && nama.length > 100) {
      return res.status(400).json({ message: 'Nama terlalu panjang (maks 100 karakter).' });
    }

    let updatedArsipDigitalUrl = letter.arsipDigital; // Default ke URL lama

    if (req.file) {
      if (!isValidFileType(req.file.originalname)) { // Gunakan originalname dari buffer
        return res.status(400).json({ message: 'Tipe file tidak diizinkan.' });
      }

      // Hapus file lama dari filesystem lokal (TIDAK BERLAKU LAGI UNTUK CLOUDINARY)
      // if (letter.arsipDigital) {
      //   const oldPath = path.join(__dirname, '..', letter.arsipDigital);
      //   await fs.unlink(oldPath).catch(() => {});
      // }

      // Upload file baru ke Cloudinary via axios
      const formData = new FormData();
      formData.append('file', req.file.buffer, { filename: req.file.originalname });
      formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET); // Gunakan preset yang sama
      formData.append('folder', 'bpkad_surat');

      try {
        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            auth: {
              username: process.env.CLOUDINARY_API_KEY,
              password: process.env.CLOUDINARY_API_SECRET,
            },
          }
        );
        updatedArsipDigitalUrl = response.data.secure_url; // Gunakan URL baru dari axios
      } catch (uploadError) {
        console.error('Error uploading new file to Cloudinary via axios (Admin Update):', uploadError.response?.data || uploadError.message);
        return res.status(500).json({ message: 'Gagal mengunggah file baru ke Cloudinary.' });
      }
    }


    if (klasifikasiId !== undefined) {
      if (klasifikasiId && mongoose.Types.ObjectId.isValid(klasifikasiId)) {
        letter.klasifikasiId = new mongoose.Types.ObjectId(klasifikasiId);
      } else if (klasifikasiId === '') {
        letter.klasifikasiId = null;
      } else {
        return res.status(400).json({ message: 'Klasifikasi ID tidak valid.' });
      }
    }

    Object.assign(letter, {
      noUrut: noUrut !== undefined ? parseInt(noUrut) : letter.noUrut,
      noSurat: noSurat || letter.noSurat,
      tanggalTerima: tanggalTerima ? new Date(tanggalTerima) : letter.tanggalTerima,
      tanggalDisposisi: tanggalDisposisi ? new Date(tanggalDisposisi) : letter.tanggalDisposisi,
      asalSurat: asalSurat || letter.asalSurat,
      perihal: perihal || letter.perihal,
      keterangan: keterangan || letter.keterangan,
      tanggalDisposisiBidang: tanggalDisposisiBidang ? new Date(tanggalDisposisiBidang) : letter.tanggalDisposisiBidang,
      jabatan: jabatan !== undefined ? jabatan : letter.jabatan,
      nama: nama !== undefined ? nama : letter.nama,
      nip: nip !== undefined ? nip : letter.nip,
      arsipDigital: updatedArsipDigitalUrl // Gunakan URL dari axios
    });

    await letter.save();

    await logActivity(req.user.id, 'admin_edit_letter', `Admin mengedit surat "${letter.noSurat}"`, req);
    res.json({ message: 'Surat berhasil diperbarui oleh admin.', letter });
  } catch (error) {
    console.error('Error adminUpdateLetter:', error);
    res.status(500).json({ message: 'Gagal memperbarui surat.' });
  }
};

// ADMIN: Delete
const adminDeleteLetter = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const deletedCount = await Letter.deleteMany({ suratId: letter.suratId });

    // Hapus file dari filesystem lokal (TIDAK BERLAKU LAGI UNTUK CLOUDINARY)
    // if (letter.arsipDigital) {
    //   const filePath = path.join(__dirname, '..', letter.arsipDigital);
    //   await fs.unlink(filePath).catch(() => {});
    // }

    // Catatan: Anda mungkin ingin menambahkan logika untuk menghapus file dari Cloudinary berdasarkan URL atau public_id di sini.

    await logActivity(req.user.id, 'admin_delete_letter', `Admin menghapus surat "${letter.noSurat}"`, req);
    res.json({ message: `Surat berhasil dihapus oleh admin (${deletedCount.deletedCount} salinan dihapus).` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus surat.' });
  }
};

// DELETE PERMANEN
const deleteLetterPermanent = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Surat tidak ditemukan.' });

    const deletedCount = await Letter.deleteMany({ suratId: letter.suratId });

    // Hapus file dari filesystem lokal (TIDAK BERLAKU LAGI UNTUK CLOUDINARY)
    // if (letter.arsipDigital) {
    //   const filePath = path.join(__dirname, '..', letter.arsipDigital);
    //   await fs.unlink(filePath).catch(() => {});
    // }

    // Catatan: Anda mungkin ingin menambahkan logika untuk menghapus file dari Cloudinary berdasarkan URL atau public_id di sini.

    await logActivity(req.user.id, 'delete_letter_permanent', `User menghapus surat "${letter.noSurat}" secara permanen`, req);
    res.json({ 
      message: `Surat berhasil dihapus secara permanen (${deletedCount.deletedCount} salinan dihapus).`,
      deletedCount: deletedCount.deletedCount
    });
  } catch (error) {
    console.error('Error deleteLetterPermanent:', error);
    res.status(500).json({ message: 'Gagal menghapus surat secara permanen.' });
  }
};

module.exports = {
  createLetter,
  getIncomingLetters,
  getOutgoingLetters,
  getLetterById,
  updateLetter,
  deleteLetter,
  adminUpdateLetter,
  adminDeleteLetter,
  deleteLetterPermanent
};