// routes/classificationRoutes.js
const express = require('express');
const {
  getClassifications,
  createClassification,
  updateClassification,
  deleteClassification
} = require('../controllers/classificationController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.get('/', auth, getClassifications);
router.post('/', auth, admin, createClassification);
router.put('/:id', auth, admin, updateClassification);
router.delete('/:id', auth, admin, deleteClassification);

module.exports = router;