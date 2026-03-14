// models/History.js
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'send_letter',
      'edit_letter',
      'delete_letter',
      'view_report',
      'manage_classification',
      'manage_user',
      // 🔑 Tambahkan ini:
      'view_profile',
      'update_profile',
      'delete_account',
      'view_classifications',
      'view_incoming_letters',
      'view_outgoing_letters',
      'view_letter_detail',
      'register'
    ]
  },
  description: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('History', historySchema);