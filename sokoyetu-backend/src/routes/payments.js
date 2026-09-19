const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = authMiddleware;
const {
  createDeposit,
  syncDepositStatus,
  handleDepositCallback,
  listProviders,
  predict,
} = require('../controllers/paymentController');

router.get('/pawapay/providers', authMiddleware, requireRole('retailer'), listProviders);
router.post('/pawapay/predict-provider', authMiddleware, requireRole('retailer'), predict);
router.post('/pawapay/deposit', authMiddleware, requireRole('retailer'), createDeposit);
router.get('/pawapay/deposit/:depositId', authMiddleware, requireRole('retailer'), syncDepositStatus);
router.post('/pawapay/callback/deposit', handleDepositCallback);

module.exports = router;
