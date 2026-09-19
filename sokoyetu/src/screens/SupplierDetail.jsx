import { useNavigate, useParams } from 'react-router-dom';
import { suppliers } from '../data/suppliers';
import { products } from '../data/products';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const supplier = suppliers.find(s => s.id === parseInt(id));
  const supplierProducts = products.filter(p => p.supplierId === parseInt(id));

  if (!supplier) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p>Supplier not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/retailer')}>Go back</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <button className="nav-back" onClick={() => navigate('/retailer')}>
          ‹ Suppliers
        </button>
        <span className="nav-title" style={{ textAlign: 'right', fontSize: 14 }}>{supplier.name}</span>
      </div>

      <div className="content">
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: supplier.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, flexShrink: 0,
            }}>
              {supplier.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{supplier.name}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {supplier.category} · {supplier.location} · Est. {supplier.established}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {supplier.verified
                  ? <span className="badge badge-green">✓ Verified supplier</span>
                  : <span className="badge badge-amber">⏳ New supplier</span>}
                <span className="badge badge-blue">⭐ {supplier.rating} ({supplier.reviews} reviews)</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
            {supplier.description}
          </p>
          <hr className="divider" />
        </div>

        <p className="section-label">Available products</p>

        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {supplierProducts.map(product => (
            <button
              key={product.id}
              onClick={() => navigate(`/order/${product.id}`)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <p style={{ fontSize: 30, marginBottom: 8 }}>{product.emoji}</p>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{product.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                RWF {product.price.toLocaleString()} / {product.unit}
              </p>
              <p style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 500 }}>
                Min. {product.moq} units
              </p>
            </button>
          ))}
        </div>

        <div className="spacer" />
      </div>

      <div className="bottom-nav">
        {[
          { icon: '🏪', label: 'Browse', path: '/retailer' },
          { icon: '📦', label: 'Orders', path: '/orders' },
          { icon: '❤️', label: 'Saved', path: '/retailer' },
          { icon: '👤', label: 'Account', path: '/' },
        ].map(item => (
          <button key={item.label} className="bnav-item" onClick={() => navigate(item.path)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
