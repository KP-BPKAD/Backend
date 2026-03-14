// middleware/roleAuth.js
const roleAuth = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  next();
};