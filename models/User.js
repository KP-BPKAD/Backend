// models/User.js (versi tanpa next)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// models/User.js
const userSchema = new mongoose.Schema({
    email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'user', 'pimpinan'],
    default: 'user'
  } // ← tambahkan ini
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

module.exports = mongoose.model('User', userSchema);