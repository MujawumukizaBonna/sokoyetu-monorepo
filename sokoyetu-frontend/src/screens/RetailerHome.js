import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSuppliers } from '../api';
import { useAuth } from '../context/AuthContext';
import RoleShell from '../components/RoleShell';

const CATEGORIES = ['All', 'Food & beverage', 'Cleaning', 'Textiles', 'Hardware'];

export default function RetailerHome() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const params = {};
    if (category !== 'All') params.category = category;
    if (search) params.search = search;
    getSuppliers(params)
      .then(res => setSuppliers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <RoleShell
      brand="SokoYetu"
      description={`Hi, ${user?.name?.split(' ')[0] || 'there'}. Browse suppliers and manage retailer orders from one place.`}
      onLogout={logoutUser}
      items={[
        { icon: '🏪', label: 'Browse suppliers', meta: 'Explore manufacturers', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
        { icon: '📦', label: 'My orders', meta: 'Track recent orders', path: '/orders', match: '/orders' },
        { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/retailer', match: '/retailer' },
      ]}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <span className="nav-title">Browse suppliers</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }} className="mobile-only">
            Hi, {user?.name?.split(' ')[0]}
          </span>
          <button
            onClick={logoutUser}
            className="mobile-only"
            style={{ border: 'none', background: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 8, whiteSpace: 'nowrap' }}
          >
            Logout
          </button>
        </div>

        <div className="content">
        <div className="page-panel" style={{ paddingTop: 12 }}>
          <div className="search-bar" style={{ marginLeft: 0, marginRight: 0 }}>
            <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers..."
            />
          </div>

          <div className="filter-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`filter-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="spinner" />
          ) : suppliers.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔍</div>
              <p>No suppliers found</p>
              <span>Try a different search or category</span>
            </div>
          ) : (
            <>
              <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} found
              </p>

              <div className="supplier-list" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {suppliers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/supplier/${s.id}`)}
                    className="surface-card"
                    style={{ borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%', border: '1px solid var(--border)' }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {s.emoji || '🏭'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.category} · {s.location}</p>
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.verified
                          ? <span className="badge badge-green">Verified</span>
                          : <span className="badge badge-amber">New</span>}
                        {s.rating > 0 && <span className="badge badge-blue">★ {s.rating}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="spacer" />
        </div>
        </div>

        <div className="bottom-nav">
        {[
          { icon: '🏪', label: 'Browse', path: '/retailer', active: true },
          { icon: '📦', label: 'Orders', path: '/orders' },
          { icon: '👤', label: 'Account', path: '/retailer' },
        ].map(item => (
          <button key={item.label} className={`bnav-item ${item.active ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        </div>
      </div>
    </RoleShell>
  );
}
