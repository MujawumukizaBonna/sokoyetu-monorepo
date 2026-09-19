import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import RoleSelect from './screens/RoleSelect';
import Login from './screens/Login';
import Register from './screens/Register';
import RetailerHome from './screens/RetailerHome';
import SupplierDetail from './screens/SupplierDetail';
import OrderSummary from './screens/OrderSummary';
import OrderHistory from './screens/OrderHistory';
import ManufacturerHome from './screens/ManufacturerHome';
import AddProduct from './screens/AddProduct';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Retailer routes */}
      <Route path="/retailer" element={
        <PrivateRoute role="retailer"><RetailerHome /></PrivateRoute>
      } />
      <Route path="/supplier/:id" element={
        <PrivateRoute role="retailer"><SupplierDetail /></PrivateRoute>
      } />
      <Route path="/order/:productId" element={
        <PrivateRoute role="retailer"><OrderSummary /></PrivateRoute>
      } />
      <Route path="/orders" element={
        <PrivateRoute role="retailer"><OrderHistory /></PrivateRoute>
      } />

      {/* Manufacturer routes */}
      <Route path="/manufacturer" element={
        <PrivateRoute role="manufacturer"><ManufacturerHome /></PrivateRoute>
      } />
      <Route path="/manufacturer/add-product" element={
        <PrivateRoute role="manufacturer"><AddProduct /></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
