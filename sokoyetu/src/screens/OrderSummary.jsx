import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { products } from '../data/products';
import { suppliers } from '../data/suppliers';

export default function OrderSummary() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const product = products.find(p => p.id === parseInt(productId));
  const supplier = product ? suppliers.find(s => s.id === product.supplierId) : null;

  const [qty, setQty] = useState(product ? product.moq : 1);
  const [confirmed, setConfirmed] = useState(false);

  if (!product || !supplier) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p>Product not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/retailer')}>Go back</button>
      </div>
    );
  }

  const subtotal = qty * product.price;
  const delivery = 1500;
  const total = subtotal + delivery;

  if (confirmed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 16 }}>
          ✅
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Order confirmed!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          Your order for <strong>{product.name} × {qty}</strong> has been placed. {supplier.name} will prepare it shortly.
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 32 }}>
          Total paid: RWF {total.toLocaleString()}
        </p>
        <button className="btn-primary" onClick={() => navigate('/orders')}>
          View my orders
        </button>
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => navigate('/retailer')}>
          Continue browsing
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav">
        <button className="nav-back" onClick={() => navigate(-1)}>‹ Back</button>
        <span className="nav-title" style={{ textAlign: 'right' }}>Place order</span>
      </div>

      <div className="content">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Product</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{product.emoji}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{product.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{supplier.name}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quantity</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => setQty(Math.max(product.moq, qty - product.moq))}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 18, cursor: 'pointer' }}
              >−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 700 }}>{qty}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Min. {product.moq} units</p>
              </div>
              <button
                onClick={() => setQty(qty + product.moq)}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 18, cursor: 'pointer' }}
              >+</button>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Delivery location</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <p style={{ fontSize: 14 }}>Musanze District, Northern Province</p>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment method</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>📱</span>
              <p style={{ fontSize: 14, fontWeight: 500 }}>MTN Mobile Money</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 14 }}>
            {[
              { label: 'Unit price', value: `RWF ${product.price.toLocaleString()}` },
              { label: `Quantity`, value: `× ${qty}` },
              { label: 'Subtotal', value: `RWF ${subtotal.toLocaleString()}` },
              { label: 'Delivery', value: `RWF ${delivery.toLocaleString()}` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>{row.label}</span><span>{row.value}</span>
              </div>
            ))}
            <hr className="divider" style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
              <span>Total</span>
              <span>RWF {total.toLocaleString()}</span>
            </div>
          </div>

        </div>
        <div className="spacer" />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        <button className="btn-primary" onClick={() => setConfirmed(true)}>
          ✓ Confirm & pay via MoMo
        </button>
      </div>
    </div>
  );
}
