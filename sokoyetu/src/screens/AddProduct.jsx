import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Food & beverage', 'Cleaning', 'Textiles', 'Hardware', 'Other'];

export default function AddProduct() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState(false);

  const [form, setForm] = useState({
    name: '', category: 'Food & beverage', description: '',
    price: '', unit: '', moq: '', stock: '', discount: 'No discount', delivery: 'Manufacturer delivers', available: true,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const total = form.price && form.moq
    ? (parseInt(form.price) * parseInt(form.moq)).toLocaleString()
    : '—';

  const StepDot = ({ n }) => (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: step === n ? 'var(--text)' : step > n ? 'var(--green-light)' : 'var(--bg-secondary)',
      color: step === n ? 'var(--bg)' : step > n ? 'var(--green-dark)' : 'var(--text-secondary)',
      border: `1px solid ${step === n ? 'var(--text)' : step > n ? 'var(--green-light)' : 'var(--border)'}`,
    }} onClick={() => n < step && setStep(n)}>{step > n ? '✓' : n}</div>
  );

  if (published) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 16 }}>
          ✅
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Product listed!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          <strong>{form.name || 'Your product'}</strong> is now visible to retailers across Rwanda.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 32 }}>
          You will be notified when an order comes in.
        </p>
        <button className="btn-primary" onClick={() => navigate('/manufacturer')}>Go to dashboard</button>
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => { setPublished(false); setStep(1); setForm({ name: '', category: 'Food & beverage', description: '', price: '', unit: '', moq: '', stock: '', discount: 'No discount', delivery: 'Manufacturer delivers', available: true }); }}>
          Add another product
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <button className="nav-back" onClick={() => step > 1 ? setStep(step - 1) : navigate('/manufacturer')}>‹ Back</button>
        <span className="nav-title" style={{ textAlign: 'right' }}>New product</span>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <StepDot n={1} /><div style={{ flex: 1, height: 2, background: step > 1 ? 'var(--green)' : 'var(--border)', borderRadius: 1 }} />
        <StepDot n={2} /><div style={{ flex: 1, height: 2, background: step > 2 ? 'var(--green)' : 'var(--border)', borderRadius: 1 }} />
        <StepDot n={3} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>Step {step} of 3</span>
      </div>

      <div className="content">
        <div style={{ padding: 16 }}>

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <label>Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the product, quality, packaging…" />
              </div>
              <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'var(--bg-secondary)' }}>
                <span style={{ fontSize: 28 }}>📷</span>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tap to upload product photo</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>JPG or PNG, max 5MB</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Pricing & stock</p>
              <div className="row2">
                <div className="field">
                  <label>Unit price (RWF)</label>
                  <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="450" />
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
              <div className="field">
                <label>Bulk discount</label>
                <select value={form.discount} onChange={e => set('discount', e.target.value)}>
                  {['No discount', '5% off 50+ units', '10% off 100+ units', 'Custom'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Delivery options</label>
                <select value={form.delivery} onChange={e => set('delivery', e.target.value)}>
                  {['Manufacturer delivers', 'Retailer collects', 'Both available'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>Available to order</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Retailers can see and order this</p>
                </div>
                <div
                  onClick={() => set('available', !form.available)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.available ? 'var(--text)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.available ? 23 : 3, transition: 'left 0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Preview & publish</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This is how retailers will see your listing.</p>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{form.name || 'Product name'}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{form.category} · Your company</p>
                <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>
                  RWF {form.price ? parseInt(form.price).toLocaleString() : '—'} / {form.unit || 'unit'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 8 }}>Min. order: {form.moq || '—'} units</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{form.description || 'No description added.'}</p>
                <span className="badge badge-green" style={{ marginTop: 10, display: 'inline-block' }}>✓ In stock</span>
              </div>
              {form.price && form.moq && (
                <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <p style={{ fontSize: 13, color: 'var(--blue-dark)' }}>
                    Minimum order value: <strong>RWF {total}</strong> ({form.moq} units × RWF {parseInt(form.price).toLocaleString()})
                  </p>
                </div>
              )}
              <div className="field">
                <label>Notes for reviewers (optional)</label>
                <textarea placeholder="e.g. Cold chain required, refrigerate on delivery…" />
              </div>
            </div>
          )}

        </div>
        <div className="spacer" />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 10 }}>
        {step > 1 && <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3
          ? <button className="btn-primary" style={{ flex: 2 }} onClick={() => setStep(step + 1)}>
              Next {step === 2 ? '— Preview' : ''} ›
            </button>
          : <button className="btn-primary" style={{ flex: 2 }} onClick={() => setPublished(true)}>
              ✓ Publish listing
            </button>
        }
      </div>
    </div>
  );
}
