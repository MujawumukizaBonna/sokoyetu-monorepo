import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupplierById, getProducts } from '../api';
import RoleShell from '../components/RoleShell';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSupplierById(id), getProducts(id)])
      .then(([sRes, pRes]) => {
        setSupplier(sRes.data);
        setProducts(pRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!supplier) return <div className="pad">Supplier not found.</div>;

  return (
    <RoleShell
      brand="SokoYetu"
      description="Supplier details, product listings, and order flow for retailers."
      items={[
        { icon: '🏪', label: 'Browse suppliers', meta: 'Explore manufacturers', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
        { icon: '📦', label: 'My orders', meta: 'Track recent orders', path: '/orders', match: '/orders' },
        { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/retailer', match: '/retailer' },
      ]}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <button className="nav-back" onClick={() => navigate('/retailer')}>‹ Suppliers</button>
          <span className="nav-title" style={{ textAlign: 'right', fontSize: 14 }}>{supplier.name}</span>
        </div>

        <div className="content">
        <div className="page-panel">
          <div style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                {supplier.emoji || '🏭'}
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{supplier.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {supplier.category} · {supplier.location} {supplier.established && `· Est. ${supplier.established}`}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {supplier.verified
                    ? <span className="badge badge-green">Verified supplier</span>
                    : <span className="badge badge-amber">New supplier</span>}
                  {supplier.rating > 0 && (
                    <span className="badge badge-blue">★ {supplier.rating} ({supplier.reviews_count} reviews)</span>
                  )}
                </div>
              </div>
            </div>

            {supplier.description && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                {supplier.description}
              </p>
            )}
            <hr className="divider" />
          </div>

          <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>Available products ({products.length})</p>

          {products.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📦</div>
              <p>No products listed yet</p>
              <span>Check back soon</span>
            </div>
          ) : (
            <div className="product-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {products.map(product => (
                <button
                  key={product.id}
                  onClick={() => navigate(`/order/${product.id}`)}
                  className="surface-card"
                  style={{ borderRadius: 'var(--radius-lg)', padding: '14px 12px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
                >
                  <p style={{ fontSize: 30, marginBottom: 8 }}>{product.emoji || '📦'}</p>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{product.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    RWF {Number(product.price_rwf).toLocaleString()} / {product.unit || 'unit'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 500 }}>
                    Min. {product.moq} units
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="spacer" />
        </div>
        </div>

        <div className="bottom-nav">
        {[
          { icon: '🏪', label: 'Browse', path: '/retailer' },
          { icon: '📦', label: 'Orders', path: '/orders' },
          { icon: '👤', label: 'Account', path: '/retailer' },
        ].map(item => (
          <button key={item.label} className="bnav-item" onClick={() => navigate(item.path)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        </div>
      </div>
    </RoleShell>
  );
}
