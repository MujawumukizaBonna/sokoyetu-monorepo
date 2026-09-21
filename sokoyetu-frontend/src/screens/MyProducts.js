import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMyProducts, updateProduct, deleteProduct } from '../api';
import { useAuth } from '../context/AuthContext';
import RoleShell from '../components/RoleShell';
import { MANUFACTURER_NAV, MANUFACTURER_BOTTOM_NAV, matchesPath } from '../components/navItems';

const CATEGORIES = ['Food & beverage', 'Cleaning', 'Textiles', 'Hardware', 'Other'];
const EMOJIS = ['🥛', '🧼', '🌾', '🌽', '🍚', '🧴', '🧂', '🧪', '🧵', '📦'];

const toDraft = (product) => ({
  name: product.name || '',
  emoji: product.emoji || '📦',
  price_rwf: product.price_rwf == null ? '' : String(product.price_rwf),
  unit: product.unit || '',
  moq: product.moq == null ? '' : String(product.moq),
  stock: product.stock == null ? '' : String(product.stock),
  category: product.category || CATEGORIES[0],
  description: product.description || '',
});

export default function MyProducts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logoutUser } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getMyProducts()
      .then(res => setProducts(res.data))
      .catch(err => setError(err.response?.data?.error || 'Could not load your products.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));

  const startEdit = (product) => {
    setEditingId(product.id);
    setDraft(toDraft(product));
    setError('');
    setNotice('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setError('');
  };

  const saveEdit = async (id) => {
    const price = parseInt(draft.price_rwf, 10);
    const moq = parseInt(draft.moq, 10);
    const stock = parseInt(draft.stock, 10);

    if (!draft.name.trim()) return setError('Product name is required.');
    if (!Number.isInteger(price) || price <= 0) return setError('Unit price must be a positive number.');
    if (!Number.isInteger(moq) || moq <= 0) return setError('Minimum order quantity must be a positive number.');
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock cannot be negative.');

    setBusyId(id);
    setError('');

    try {
      const res = await updateProduct(id, {
        name: draft.name.trim(),
        emoji: draft.emoji,
        price_rwf: price,
        unit: draft.unit,
        moq,
        stock,
        category: draft.category,
        description: draft.description,
      });
      setProducts(prev => prev.map(p => (p.id === id ? res.data : p)));
      setEditingId(null);
      setDraft(null);
      setNotice('Product updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update product.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleAvailable = async (product) => {
    setBusyId(product.id);
    setError('');
    setNotice('');

    try {
      if (product.available) {
        await deleteProduct(product.id);
        setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, available: false } : p)));
        setNotice(`"${product.name}" is hidden from retailers. You can make it live again any time.`);
      } else {
        const res = await updateProduct(product.id, { available: true });
        setProducts(prev => prev.map(p => (p.id === product.id ? res.data : p)));
        setNotice(`"${product.name}" is live again.`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change availability.');
    } finally {
      setBusyId(null);
    }
  };

  const liveCount = products.filter(p => p.available).length;

  return (
    <RoleShell
      brand="Manufacturer Hub"
      description="Edit your listings, adjust stock, and control what retailers can see."
      onLogout={logoutUser}
      items={MANUFACTURER_NAV}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <button className="nav-back" onClick={() => navigate('/manufacturer')}>‹ Back</button>
          <span className="nav-title" style={{ textAlign: 'right' }}>My products</span>
        </div>

        <div className="content">
          <div className="page-panel">
            <div className="spacer" />

            {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}
            {notice && (
              <div style={{ background: 'var(--green-light)', color: '#27500A', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 500 }}>
                {notice}
              </div>
            )}

            {loading ? (
              <div className="spinner" />
            ) : products.length === 0 ? (
              <div className="empty-state">
                <div className="emoji">📦</div>
                <p>No products yet</p>
                <span>Publish your first listing to start receiving orders</span>
              </div>
            ) : (
              <>
                <div className="stats-grid" style={{ marginBottom: 4 }}>
                  <div className="surface-card section-card">
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Total listings</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{products.length}</p>
                  </div>
                  <div className="surface-card section-card">
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Live</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{liveCount}</p>
                  </div>
                  <div className="surface-card section-card">
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Hidden</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{products.length - liveCount}</p>
                  </div>
                </div>

                <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  All listings ({products.length})
                </p>

                <div className="stack">
                  {products.map(product => {
                    const editing = editingId === product.id;
                    const busy = busyId === product.id;

                    return (
                      <div key={product.id} className="card">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {product.emoji || '📦'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{product.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              {product.category || 'General'} · {product.unit || 'unit'}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {product.available
                                  ? <span className="badge badge-green">Live</span>
                                  : <span className="badge badge-amber">Hidden</span>}
                                <span className="badge badge-blue">Stock {product.stock ?? 0}</span>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>
                                RWF {Number(product.price_rwf).toLocaleString()}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                              Min. order {product.moq} units
                            </p>
                          </div>
                        </div>

                        {editing ? (
                          <div className="stack" style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            <div className="field">
                              <label>Product name</label>
                              <input value={draft.name} onChange={e => set('name', e.target.value)} />
                            </div>

                            <div className="field">
                              <label>Category</label>
                              <select value={draft.category} onChange={e => set('category', e.target.value)}>
                                {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                              </select>
                            </div>

                            <div className="field">
                              <label>Product icon</label>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                {EMOJIS.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => set('emoji', emoji)}
                                    style={{
                                      width: 38,
                                      height: 38,
                                      fontSize: 20,
                                      border: `2px solid ${draft.emoji === emoji ? 'var(--text)' : 'var(--border)'}`,
                                      borderRadius: 8,
                                      background: draft.emoji === emoji ? 'var(--bg-secondary)' : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="row2">
                              <div className="field">
                                <label>Unit price (RWF)</label>
                                <input type="number" value={draft.price_rwf} onChange={e => set('price_rwf', e.target.value)} />
                              </div>
                              <div className="field">
                                <label>Unit size</label>
                                <input value={draft.unit} onChange={e => set('unit', e.target.value)} placeholder="500ml" />
                              </div>
                            </div>

                            <div className="row2">
                              <div className="field">
                                <label>Min. order (MOQ)</label>
                                <input type="number" value={draft.moq} onChange={e => set('moq', e.target.value)} />
                              </div>
                              <div className="field">
                                <label>Stock available</label>
                                <input type="number" value={draft.stock} onChange={e => set('stock', e.target.value)} />
                              </div>
                            </div>

                            <div className="field">
                              <label>Description (optional)</label>
                              <textarea value={draft.description} onChange={e => set('description', e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                              <button className="btn-ghost" style={{ flex: 1 }} onClick={cancelEdit} disabled={busy}>
                                Cancel
                              </button>
                              <button className="btn-primary" style={{ flex: 2 }} onClick={() => saveEdit(product.id)} disabled={busy}>
                                {busy ? 'Saving...' : 'Save changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button
                              onClick={() => startEdit(product)}
                              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleAvailable(product)}
                              disabled={busy}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${product.available ? 'var(--border)' : 'var(--green)'}`,
                                background: product.available ? 'transparent' : 'var(--green-light)',
                                color: product.available ? 'var(--red)' : '#27500A',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: busy ? 'default' : 'pointer',
                              }}
                            >
                              {busy ? 'Working...' : product.available ? 'Hide from retailers' : 'Make live'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ padding: '16px 0 0' }}>
              <button className="btn-primary" onClick={() => navigate('/manufacturer/add-product')}>
                + Add new product listing
              </button>
            </div>

            <div className="spacer" />
          </div>
        </div>

        <div className="bottom-nav">
          {MANUFACTURER_BOTTOM_NAV.map(item => (
            <button
              key={item.label}
              className={`bnav-item ${matchesPath(location.pathname, item.match) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </RoleShell>
  );
}
