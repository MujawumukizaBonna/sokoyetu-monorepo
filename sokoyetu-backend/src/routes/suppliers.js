const express = require('express');
const router = express.Router();
const { getSuppliers, getSupplierById, getMySupplier, updateMySupplier } = require('../controllers/supplierController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = authMiddleware;

router.get('/', getSuppliers);
router.get('/my', authMiddleware, requireRole('manufacturer'), getMySupplier);
router.put('/my', authMiddleware, requireRole('manufacturer'), updateMySupplier);
router.get('/:id', getSupplierById);

module.exports = router;
