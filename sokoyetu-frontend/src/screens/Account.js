import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMySupplier, updateMySupplier } from '../api';
import { useAuth } from '../context/AuthContext';
import RoleShell from '../components/RoleShell';
import {
  RETAILER_NAV,
  MANUFACTURER_NAV,
  RETAILER_BOTTOM_NAV,
  MANUFACTURER_BOTTOM_NAV,
  matchesPath,
} from '../components/navItems';

const CATEGORIES = ['Food & beverage', 'Cleaning', 'Textiles', 'Hardware', 'Other'];
const SUPPLIER_EMOJIS = ['🏭', '🥛', '🧼', '🌾', '🌽', '🍚', '🧴', '🧂', '🧪', '🧵'];

const ROLE_LABEL = { retailer: 'Retailer', manufacturer: 'Manufacturer' };

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logoutUser } = useAuth();
  const isManufacturer = user?.role === 'manufacturer';

  const nav = isManufacturer ? MANUFACTURER_NAV : RETAILER_NAV;
  const bottomNav = isManufacturer ? MANUFACTURER_BOTTOM_NAV : RETAILER_BOTTOM_NAV;

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(isManufacturer);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isManufacturer) return;

    getMySupplier()
      .then(res => {
        const supplier = res.data;
        setForm({
          name: supplier.name || '',
          category: supplier.category || CATEGORIES[0],
          description: supplier.description || '',
          location: supplier.location || '',
          emoji: supplier.emoji || '🏭',
        });
      })
      .catch(err => setError(err.response?.data?.error || 'Could not load your business profile.'))
      .finally(() => setLoading(false));
  }, [isManufacturer]);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Business name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateMySupplier({
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        location: form.location,
        emoji: form.emoji,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const memberSince = formatDate(user?.created_at);

  return (
    <RoleShell
      brand={isManufacturer ? 'Manufacturer Hub' : 'SokoYetu'}
      description={
        isManufacturer
          ? 'Manage your public business profile and listings.'
          : 'Your account details and settings.'
      }
      onLogout={logoutUser}
      items={nav}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <button className="nav-back" onClick={() => navigate(isManufacturer ? '/manufacturer' : '/retailer')}>
            ‹ Back
          </button>
          <span className="nav-title" style={{ textAlign: 'right' }}>Account</span>
        </div>

        <div className="content">
          <div className="page-panel page-panel--narrow">
            <div className="spacer" />

            <div
              className="surface-card"
              style={{ borderRadius: 'var(--radius-lg)', padding: 18, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--green-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#27500A',
                  flexShrink: 0,
                }}
              >
                {initials(user?.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{user?.name || 'Your account'}</p>
                <span className="badge badge-green">{ROLE_LABEL[user?.role] || user?.role || '—'}</span>
              </div>
            </div>

            <div className="surface-card" style={{ borderRadius: 'var(--radius-lg)', padding: '4px 16px 12px', marginBottom: 16 }}>
              <DetailRow label="Full name" value={user?.name} />
              <DetailRow label="Phone number" value={user?.phone} />
              <DetailRow label="Role" value={ROLE_LABEL[user?.role] || user?.role} />
              <DetailRow label="Location" value={user?.location} />
              <DetailRow label="Member since" value={memberSince} />
            </div>

            {isManufacturer && (
              <>
                <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  Business profile
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  Retailers see this information when they browse suppliers.
                </p>

                {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}
                {saved && (
                  <div style={{ background: 'var(--green-light)', color: '#27500A', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 500 }}>
                    Business profile updated.
                  </div>
                )}

                {loading ? (
                  <div className="spinner" />
                ) : form ? (
                  <div className="stack">
                    <div className="field">
                      <label>Business name</label>
                      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kigali Dairy Works" />
                    </div>

                    <div className="field">
                      <label>Category</label>
                      <select value={form.category} onChange={e => set('category', e.target.value)}>
                        {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                      </select>
                    </div>

                    <div className="field">
                      <label>Location</label>
                      <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Kigali" />
                    </div>

                    <div className="field">
                      <label>Business icon</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {SUPPLIER_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => set('emoji', emoji)}
                            style={{
                              width: 40,
                              height: 40,
                              fontSize: 22,
                              border: `2px solid ${form.emoji === emoji ? 'var(--text)' : 'var(--border)'}`,
                              borderRadius: 8,
                              background: form.emoji === emoji ? 'var(--bg-secondary)' : 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label>About your business (optional)</label>
                      <textarea
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="What you make, your capacity, delivery areas..."
                      />
                    </div>

                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="emoji">🏭</div>
                    <p>No business profile found</p>
                    <span>Contact support if this looks wrong</span>
                  </div>
                )}
              </>
            )}

            <div className="divider" style={{ margin: '22px 0 16px' }} />

            <button className="btn-ghost" onClick={logoutUser} style={{ width: '100%' }}>
              Log out of SokoYetu
            </button>

            <div className="spacer" />
          </div>
        </div>

        <div className="bottom-nav">
          {bottomNav.map(item => (
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
