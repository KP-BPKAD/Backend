// models/Letter.js
const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema({
  // Identifikasi unik untuk surat (sama di kedua sisi)
  suratId: { 
    type: String, 
    required: true,
    index: true // agar cepat cari pasangan
  },

  // Siapa yang menyimpan salinan ini
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Jenis salinan
  type: {
    type: String,
    enum: ['incoming', 'outgoing'],
    required: true
  },

  // Informasi surat
  noSurat: { type: String, required: true },
  noUrut: { type: Number, required: true },
  perihal: { type: String, required: true },
  asalSurat: { type: String, required: true },
  keterangan: { type: String },
  tanggalTerima: { type: Date, required: true },
  tanggalDisposisi: { type: Date },
  tanggalDisposisiBidang: { type: Date },
  jabatan: { type: String },
  nama: { type: String },
  nip: { type: String },
  arsipDigital: { type: String }, // path file

  // Relasi (hanya untuk referensi, bukan populate wajib)
  pengirimId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  penerimaId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  klasifikasiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classification' },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Letter', letterSchema);