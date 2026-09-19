import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { suppliers, categories } from '../data/suppliers';

export default function RetailerHome() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = suppliers.filter(s => {
    const matchCat = activeCategory === 'All' || s.category === activeCategory;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <span className="nav-title">Browse suppliers</span>
        <span style={{ fontSize: 22, cursor: 'pointer' }}>🔔</span>
      </div>

      <div className="content">
        <div className="search-bar">
          <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers or products…"
          />
        </div>

        <div className="filter-row">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <p className="section-label">
          {filtered.length} supplier{filtered.length !== 1 ? 's' : ''} found
        </p>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(supplier => (
            <button
              key={supplier.id}
              onClick={() => navigate(`/supplier/${supplier.id}`)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: supplier.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {supplier.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{supplier.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{supplier.category} · {supplier.location}</p>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  {supplier.verified
                    ? <span className="badge badge-green">✓ Verified</span>
                    : <span className="badge badge-amber">⏳ New</span>}
                  <span className="badge badge-blue">⭐ {supplier.rating}</span>
                </div>
              </div>
              <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>›</span>
            </button>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
              <p style={{ fontWeight: 500 }}>No suppliers found</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Try a different search or category</p>
            </div>
          )}
        </div>

        <div className="spacer" />
      </div>

      <div className="bottom-nav">
        {[
          { icon: '🏪', label: 'Browse', active: true, path: '/retailer' },
          { icon: '📦', label: 'Orders', active: false, path: '/orders' },
          { icon: '❤️', label: 'Saved', active: false, path: '/retailer' },
          { icon: '👤', label: 'Account', active: false, path: '/' },
        ].map(item => (
          <button
            key={item.label}
            className={`bnav-item ${item.active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
