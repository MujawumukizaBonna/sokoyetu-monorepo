const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = authMiddleware;

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', authMiddleware, requireRole('manufacturer'), createProduct);
router.put('/:id', authMiddleware, requireRole('manufacturer'), updateProduct);
router.delete('/:id', authMiddleware, requireRole('manufacturer'), deleteProduct);

module.exports = router;
