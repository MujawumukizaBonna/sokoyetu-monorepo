import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProduct } from '../api';
import RoleShell from '../components/RoleShell';
import { MANUFACTURER_NAV } from '../components/navItems';

const CATEGORIES = ['Food & beverage', 'Cleaning', 'Textiles', 'Hardware', 'Other'];
const EMOJIS = ['🥛', '🧼', '🌾', '🌽', '🍚', '🧴', '🧂', '🧪', '🧵', '📦'];

export default function AddProduct() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: 'Food & beverage',
    description: '',
    emoji: '📦',
    price_rwf: '',
    unit: '',
    moq: '',
    stock: '',
    available: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePublish = async () => {
    if (!form.name || !form.price_rwf || !form.moq) {
      setError('Product name, price, and MOQ are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createProduct({
        ...form,
        price_rwf: parseInt(form.price_rwf),
        moq: parseInt(form.moq),
        stock: parseInt(form.stock) || 0,
      });
      setPublished(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product.');
    } finally {
      setLoading(false);
    }
  };

  if (published) {
    return (
      <RoleShell
        brand="Manufacturer Hub"
        description="Publish products and manage incoming retailer demand."
        items={MANUFACTURER_NAV}
      >
        <div className="confirmation-state surface-page">
          <div className="confirmation-card">
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Product listed!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong>{form.name}</strong> is now visible to retailers across Rwanda.
          </p>
          <div className="modal-cta" style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={() => navigate('/manufacturer')}>Go to dashboard</button>
            <button
              className="btn-ghost"
              onClick={() => {
                setPublished(false);
                setStep(1);
                setForm({
                  name: '',
                  category: 'Food & beverage',
                  description: '',
                  emoji: '📦',
                  price_rwf: '',
                  unit: '',
                  moq: '',
                  stock: '',
                  available: true,
                });
              }}
            >
              Add another product
            </button>
          </div>
        </div>
        </div>
      </RoleShell>
    );
  }

  const StepIndicator = () => (
    <div className="stepper">
      {[1, 2, 3].map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: n === 3 ? 0 : 1 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              cursor: n < step ? 'pointer' : 'default',
              background: step === n ? 'var(--text)' : step > n ? 'var(--green-light)' : 'var(--bg-secondary)',
              color: step === n ? 'var(--bg)' : step > n ? '#27500A' : 'var(--text-secondary)',
              flexShrink: 0,
            }}
            onClick={() => n < step && setStep(n)}
          >
            {step > n ? '✓' : n}
          </div>
          {i < 2 && <div style={{ flex: 1, height: 2, borderRadius: 1, background: step > n + 1 ? 'var(--green)' : step > n ? '#378ADD' : 'var(--border)' }} />}
        </div>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4, whiteSpace: 'nowrap' }}>Step {step} of 3</span>
    </div>
  );

  return (
    <RoleShell
      brand="Manufacturer Hub"
      description="Publish products and manage incoming retailer demand."
      items={MANUFACTURER_NAV}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <button className="nav-back" onClick={() => step > 1 ? setStep(step - 1) : navigate('/manufacturer')}>
            ‹ Back
          </button>
          <span className="nav-title" style={{ textAlign: 'right' }}>New product</span>
        </div>

        <StepIndicator />

        <div className="content">
        <div className="page-panel page-panel--narrow">
          <div style={{ paddingTop: 16 }}>
            {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

            {step === 1 && (
              <div className="stack">
                <p style={{ fontSize: 16, fontWeight: 600 }}>Product details</p>
                <div className="field">
                  <label>Product name</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fresh milk 500ml" />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Product icon</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => set('emoji', e)}
                        style={{ width: 40, height: 40, fontSize: 22, border: `2px solid ${form.emoji === e ? 'var(--text)' : 'var(--border)'}`, borderRadius: 8, background: form.emoji === e ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer' }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Description (optional)</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe quality, packaging, storage requirements..." />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="stack">
                <p style={{ fontSize: 16, fontWeight: 600 }}>Pricing and stock</p>
                <div className="row2">
                  <div className="field">
                    <label>Unit price (RWF)</label>
                    <input type="number" value={form.price_rwf} onChange={e => set('price_rwf', e.target.value)} placeholder="450" />
                  </div>
                  <div className="field">
                    <label>Unit size</label>
                    <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="500ml" />
                  </div>
                </div>
                <div className="row2">
                  <div className="field">
                    <label>Min. order (MOQ)</label>
                    <input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} placeholder="24" />
                  </div>
                  <div className="field">
                    <label>Stock available</label>
                    <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="500" />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>Available to order</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Retailers can see and order this product</p>
                  </div>
                  <div
                    onClick={() => set('available', !form.available)}
                    style={{ width: 44, height: 24, borderRadius: 12, background: form.available ? 'var(--text)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.available ? 23 : 3, transition: 'left 0.2s' }} />
                  </div>
                </div>
                {form.price_rwf && form.moq && (
                  <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <p style={{ fontSize: 13, color: 'var(--blue)' }}>
                      Min. order value: <strong>RWF {(parseInt(form.price_rwf) * parseInt(form.moq)).toLocaleString()}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="stack">
                <p style={{ fontSize: 16, fontWeight: 600 }}>Preview and publish</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This is how retailers will see your listing.</p>
                <div className="surface-card" style={{ borderRadius: 'var(--radius-lg)', padding: 16 }}>
                  <p style={{ fontSize: 30, marginBottom: 8 }}>{form.emoji}</p>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{form.name || 'Product name'}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{form.category}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>
                    RWF {form.price_rwf ? parseInt(form.price_rwf).toLocaleString() : '—'} / {form.unit || 'unit'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 8 }}>Min. order: {form.moq || '—'} units</p>
                  {form.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{form.description}</p>}
                  <span className="badge badge-green" style={{ marginTop: 10, display: 'inline-block' }}>In stock</span>
                </div>
              </div>
            )}
          </div>

          <div className="spacer" />
        </div>
        </div>

        <div className="form-actions">
        {step > 1 && <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3
          ? <button className="btn-primary" style={{ flex: 2 }} onClick={() => setStep(step + 1)}>Next ›</button>
          : <button className="btn-primary" style={{ flex: 2 }} onClick={handlePublish} disabled={loading}>
              {loading ? 'Publishing...' : 'Publish listing'}
            </button>
        }
      </div>
      </div>
    </RoleShell>
  );
}
