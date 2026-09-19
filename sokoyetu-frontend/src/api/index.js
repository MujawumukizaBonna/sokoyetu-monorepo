import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

// Attach token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── AUTH ──────────────────────────────────────────
export const register = (data) => API.post('/api/auth/register', data);
export const login = (data) => API.post('/api/auth/login', data);
export const getMe = () => API.get('/api/auth/me');

// ── SUPPLIERS ─────────────────────────────────────
export const getSuppliers = (params) => API.get('/api/suppliers', { params });
export const getSupplierById = (id) => API.get(`/api/suppliers/${id}`);
export const getMySupplier = () => API.get('/api/suppliers/my');
export const updateMySupplier = (data) => API.put('/api/suppliers/my', data);

// ── PRODUCTS ──────────────────────────────────────
export const getProducts = (supplierId) =>
  API.get('/api/products', { params: { supplier_id: supplierId } });
export const getProductById = (id) => API.get(`/api/products/${id}`);
export const createProduct = (data) => API.post('/api/products', data);
export const updateProduct = (id, data) => API.put(`/api/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/api/products/${id}`);

// ── ORDERS ────────────────────────────────────────
export const createOrder = (data) => API.post('/api/orders', data);
export const getMyOrders = () => API.get('/api/orders/my');
export const getIncomingOrders = () => API.get('/api/orders/incoming');
export const updateOrderStatus = (id, status) =>
  API.put(`/api/orders/${id}/status`, { status });
export const getStats = () => API.get('/api/orders/stats');

// â”€â”€ PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getPawaPayProviders = (country = 'RWA') =>
  API.get('/api/payments/pawapay/providers', { params: { country } });
export const predictPawaPayProvider = (phoneNumber) =>
  API.post('/api/payments/pawapay/predict-provider', { phoneNumber });
export const createPawaPayDeposit = (data) =>
  API.post('/api/payments/pawapay/deposit', data);
export const getPawaPayDepositStatus = (depositId) =>
  API.get(`/api/payments/pawapay/deposit/${depositId}`);

export default API;
