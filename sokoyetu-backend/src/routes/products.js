const express = require('express');
const router = express.Router();
const { getProducts, getMyProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = authMiddleware;

router.get('/', getProducts);
// Must be declared before '/:id' so "mine" is not swallowed as an id.
router.get('/mine', authMiddleware, requireRole('manufacturer'), getMyProducts);
router.get('/:id', getProductById);
router.post('/', authMiddleware, requireRole('manufacturer'), createProduct);
router.put('/:id', authMiddleware, requireRole('manufacturer'), updateProduct);
router.delete('/:id', authMiddleware, requireRole('manufacturer'), deleteProduct);

module.exports = router;
