import { useNavigate } from 'react-router-dom';
import { orders } from '../data/products';

const statusColor = { 'Confirmed': 'badge-green', 'In transit': 'badge-amber', 'Delivered': 'badge-blue' };

export default function ManufacturerHome() {
  const navigate = useNavigate();

  const stats = [
    { label: 'Active retailers', value: '34' },
    { label: 'Orders this week', value: '12' },
    { label: 'Revenue (RWF)', value: '482K' },
    { label: 'Pending delivery', value: '3' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <span className="nav-title">Manufacturer dashboard</span>
        <span style={{ fontSize: 22, cursor: 'pointer' }}>🔔</span>
      </div>

      <div className="content">
        <div className="spacer" />

        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <p className="section-label">Recent orders</p>

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
                    Qty {order.qty} · {order.date}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${statusColor[order.status] || 'badge-blue'}`}>{order.status}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>RWF {order.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 16px 0' }}>
          <button className="btn-primary" onClick={() => navigate('/manufacturer/add-product')}>
            + Add new product listing
          </button>
        </div>

        <div className="spacer" />
      </div>

      <div className="bottom-nav">
        {[
          { icon: '📊', label: 'Overview', active: true, path: '/manufacturer' },
          { icon: '📦', label: 'Products', path: '/manufacturer' },
          { icon: '🚚', label: 'Orders', path: '/manufacturer' },
          { icon: '⚙️', label: 'Settings', path: '/' },
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
