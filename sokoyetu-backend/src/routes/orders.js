const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getIncomingOrders, updateOrderStatus, getStats } = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = authMiddleware;

router.post('/', authMiddleware, requireRole('retailer'), createOrder);
router.get('/my', authMiddleware, requireRole('retailer'), getMyOrders);
router.get('/incoming', authMiddleware, requireRole('manufacturer'), getIncomingOrders);
router.get('/stats', authMiddleware, requireRole('manufacturer'), getStats);
router.put('/:id/status', authMiddleware, requireRole('manufacturer'), updateOrderStatus);

module.exports = router;
