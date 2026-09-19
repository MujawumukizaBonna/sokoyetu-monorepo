import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './screens/RoleSelect';
import RetailerHome from './screens/RetailerHome';
import SupplierDetail from './screens/SupplierDetail';
import OrderSummary from './screens/OrderSummary';
import OrderHistory from './screens/OrderHistory';
import ManufacturerHome from './screens/ManufacturerHome';
import AddProduct from './screens/AddProduct';

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/retailer" element={<RetailerHome />} />
          <Route path="/supplier/:id" element={<SupplierDetail />} />
          <Route path="/order/:productId" element={<OrderSummary />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/manufacturer" element={<ManufacturerHome />} />
          <Route path="/manufacturer/add-product" element={<AddProduct />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
