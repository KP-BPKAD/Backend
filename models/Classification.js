// models/Classification.js
const mongoose = require('mongoose');

const classificationSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  deskripsi: {
    type: String,
    default: ''
  },
  warna: {
    type: String,
    default: '#007bff' // biru default
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Classification', classificationSchema);