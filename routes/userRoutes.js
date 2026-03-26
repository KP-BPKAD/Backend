// routes/userRoutes.js
const express = require('express');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.get('/', auth, admin, getUsers);
router.post('/', auth, admin, createUser);
router.put('/:id', auth, admin, updateUser);
router.delete('/:id', auth, admin, deleteUser);

module.exports = router;