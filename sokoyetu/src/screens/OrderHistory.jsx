import { useNavigate } from 'react-router-dom';
import { orders } from '../data/products';

const statusColor = {
  'Confirmed': 'badge-green',
  'In transit': 'badge-amber',
  'Delivered': 'badge-blue',
};

export default function OrderHistory() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <button className="nav-back" onClick={() => navigate('/retailer')}>‹ Back</button>
        <span className="nav-title" style={{ textAlign: 'right' }}>My orders</span>
      </div>

      <div className="content">
        <div className="spacer" />

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
            <p style={{ fontWeight: 600, fontSize: 16 }}>No orders yet</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Browse suppliers to place your first order</p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/retailer')}>
              Browse suppliers
            </button>
          </div>
        ) : (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(order => (
              <div key={order.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    📦
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{order.productName}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {order.supplierName} · Qty {order.qty}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${statusColor[order.status] || 'badge-blue'}`}>{order.status}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>RWF {order.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10 }}>{order.date}</p>
              </div>
            ))}
          </div>
        )}

        <div className="spacer" />
      </div>

      <div className="bottom-nav">
        {[
          { icon: '🏪', label: 'Browse', path: '/retailer' },
          { icon: '📦', label: 'Orders', path: '/orders', active: true },
          { icon: '❤️', label: 'Saved', path: '/retailer' },
          { icon: '👤', label: 'Account', path: '/' },
        ].map(item => (
          <button key={item.label} className={`bnav-item ${item.active ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
