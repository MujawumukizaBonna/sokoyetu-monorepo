import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createOrder,
  createPawaPayDeposit,
  getPawaPayDepositStatus,
  getPawaPayProviders,
  getProductById,
  getSupplierById,
  predictPawaPayProvider,
} from '../api';
import { useAuth } from '../context/AuthContext';
import RoleShell from '../components/RoleShell';

const COUNTRY_CODES = {
  Rwanda: 'RWA',
  RWA: 'RWA',
  Zambia: 'ZMB',
  Ghana: 'GHA',
  Nigeria: 'NGA',
  Congo: 'COG',
  Benin: 'BEN',
  Burkina: 'BFA',
  Mozambique: 'MOZ',
  Malawi: 'MWI',
  Senegal: 'SEN',
};

const PAYMENT_METHODS = [
  { id: 'mobile_money', label: 'Mobile money', description: 'MTN, Airtel, and other supported wallets' },
];

const deriveCountryCode = (value) => {
  if (!value) return 'RWA';
  const normalized = String(value).trim();
  return COUNTRY_CODES[normalized] || COUNTRY_CODES[normalized.replace(/\s+/g, '')] || 'RWA';
};

const extractProviders = (payload) => {
  const countries = payload?.activeConfiguration?.countries || payload?.countries || [];
  const country = countries[0];
  return country?.providers || [];
};

const extractCountryPrefix = (payload) => {
  const countries = payload?.activeConfiguration?.countries || payload?.countries || [];
  return countries[0]?.prefix || '';
};

const normalizePhoneNumber = (value, prefix) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (prefix && digits.startsWith(prefix)) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `${prefix}${digits.slice(1)}`;
  }
  return prefix ? `${prefix}${digits}` : digits;
};

const paymentLabel = (status) => {
  switch (status) {
    case 'processing':
      return 'Payment pending';
    case 'completed':
      return 'Payment received';
    case 'failed':
      return 'Payment failed';
    default:
      return 'Waiting for payment';
  }
};

export default function OrderSummary() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pollingRef = useRef(null);
  const providerCodeRef = useRef('');

  const [product, setProduct] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [providerCode, setProviderCode] = useState('');
  const [providerOptions, setProviderOptions] = useState([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerMessage, setProviderMessage] = useState('');
  const [predictedProvider, setPredictedProvider] = useState('');
  const [countryPrefix, setCountryPrefix] = useState('');
  const [depositId, setDepositId] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [paymentNote, setPaymentNote] = useState('');

  const countryCode = deriveCountryCode(user?.location || 'Rwanda');

  useEffect(() => {
    providerCodeRef.current = providerCode;
  }, [providerCode]);

  useEffect(() => {
    getProductById(productId)
      .then((res) => {
        setProduct(res.data);
        setQty(res.data.moq);
        return getSupplierById(res.data.supplier_id);
      })
      .then((res) => setSupplier(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (user?.phone && !phoneNumber) {
      setPhoneNumber(user.phone);
    }
  }, [user?.phone, phoneNumber]);

  useEffect(() => {
    if (paymentMethod !== 'mobile_money') {
      return undefined;
    }

    let active = true;
    setProviderLoading(true);
    getPawaPayProviders(countryCode)
      .then((res) => {
        if (!active) return;
        setCountryPrefix(extractCountryPrefix(res.data));
        const options = extractProviders(res.data);
        setProviderOptions(options);
        setProviderMessage(options.length ? '' : 'No providers are currently available for this country.');
        if (!providerCodeRef.current && options[0]) {
          setProviderCode(options[0].provider);
        }
      })
      .catch((err) => {
        if (active) {
          setProviderMessage(err.response?.data?.error || 'Unable to load Mobile Money providers right now.');
        }
      })
      .finally(() => {
        if (active) {
          setProviderLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [countryCode, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'mobile_money' || !phoneNumber) {
      setPredictedProvider('');
      return undefined;
    }

    const timeout = setTimeout(() => {
      const normalizedPhone = normalizePhoneNumber(phoneNumber, countryPrefix);
      if (!normalizedPhone) {
        return;
      }

      predictPawaPayProvider(normalizedPhone)
        .then((res) => {
          const provider = res.data?.provider || '';
          setPredictedProvider(provider);
          if (provider && !providerCodeRef.current) {
            setProviderCode(provider);
          }
        })
        .catch(() => {
          setPredictedProvider('');
        });
    }, 500);

    return () => clearTimeout(timeout);
  }, [phoneNumber, paymentMethod, countryPrefix]);

  useEffect(() => () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  }, []);

  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const syncPaymentStatus = async (currentDepositId) => {
    const res = await getPawaPayDepositStatus(currentDepositId);
    const status = res.data?.payment?.status || 'pending';
    setPaymentStatus(status);
    setPaymentNote(res.data?.payment?.failure_reason || res.data?.gateway?.data?.failureReason?.failureMessage || '');

    if (status === 'completed') {
      clearPolling();
      setConfirmed(true);
      setSubmitting(false);
    }

    if (status === 'failed' || status === 'cancelled') {
      clearPolling();
      setError(res.data?.payment?.failure_reason || 'The payment did not complete.');
      setSubmitting(false);
    }
  };

  const startPolling = (currentDepositId) => {
    clearPolling();
    setPaymentStatus('processing');
    pollingRef.current = setInterval(() => {
      syncPaymentStatus(currentDepositId).catch(() => {});
    }, 4000);
    syncPaymentStatus(currentDepositId).catch(() => {});
  };

  const handleOrder = async () => {
    setSubmitting(true);
    setError('');
    setPaymentNote('');

    const chosenProvider = providerCode || predictedProvider || providerOptions[0]?.provider;
    const normalizedPhone = normalizePhoneNumber(phoneNumber, countryPrefix);
    if (!chosenProvider) {
      setError('Select a Mobile Money provider before continuing.');
      setSubmitting(false);
      return;
    }
    if (!normalizedPhone) {
      setError('Enter a valid Mobile Money phone number before continuing.');
      setSubmitting(false);
      return;
    }

    try {
      let orderId = currentOrderId;
      if (!orderId) {
        const orderResponse = await createOrder({
          product_id: productId,
          quantity: qty,
          delivery_location: user?.location || 'Rwanda',
        });
        orderId = orderResponse.data.order.id;
        setCurrentOrderId(orderId);
      }

      const paymentResponse = await createPawaPayDeposit({
        order_id: orderId,
        phone_number: normalizedPhone,
        provider_code: chosenProvider,
        payment_method: 'mobile_money',
        country: countryCode,
      });

      const createdPayment = paymentResponse.data.payment;
      setDepositId(createdPayment.external_id);
      setPaymentStatus(createdPayment.status);
      setSubmitting(false);
      startPolling(createdPayment.external_id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Payment failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!product) return <div className="pad">Product not found.</div>;

  const subtotal = qty * product.price_rwf;
  const delivery = 1500;
  const total = subtotal + delivery;

  if (confirmed) {
    return (
      <RoleShell
        brand="SokoYetu"
        description="Retail order checkout and tracking."
        items={[
          { icon: '🏪', label: 'Browse suppliers', meta: 'Explore manufacturers', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
          { icon: '📦', label: 'My orders', meta: 'Track recent orders', path: '/orders', match: '/orders' },
          { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/retailer', match: '/retailer' },
        ]}
      >
        <div className="confirmation-state surface-page">
          <div className="confirmation-card">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Payment confirmed</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Your order for <strong>{product.name} x {qty}</strong> has been paid successfully.
            </p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Total: RWF {total.toLocaleString()}</p>
            {depositId && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Deposit ID: {depositId}
              </p>
            )}
            <div className="modal-cta" style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={() => navigate('/orders')}>View my orders</button>
              <button className="btn-ghost" onClick={() => navigate('/retailer')}>Continue browsing</button>
            </div>
          </div>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell
      brand="SokoYetu"
      description="Retail order checkout and tracking."
      items={[
        { icon: '🏪', label: 'Browse suppliers', meta: 'Explore manufacturers', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
        { icon: '📦', label: 'My orders', meta: 'Track recent orders', path: '/orders', match: '/orders' },
        { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/retailer', match: '/retailer' },
      ]}
    >
      <div className="dashboard-layout surface-page">
        <div className="nav">
          <button className="nav-back" onClick={() => navigate(-1)}>‹ Back</button>
          <span className="nav-title" style={{ textAlign: 'right' }}>Place order</span>
        </div>

        <div className="content">
          <div className="page-panel page-panel--narrow">
            <div className="stack" style={{ paddingTop: 16 }}>
              {error && <div className="error-box">{error}</div>}

              <div className="card">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Product</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{product.emoji || '📦'}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{product.name}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{supplier?.name}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quantity</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button
                    onClick={() => setQty(Math.max(product.moq, qty - product.moq))}
                    style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 18, cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 22, fontWeight: 700 }}>{qty}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Min. {product.moq} units</p>
                  </div>
                  <button
                    onClick={() => setQty(qty + product.moq)}
                    style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 18, cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="card">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Delivery location</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <p style={{ fontSize: 14 }}>{user?.location || 'Rwanda'}</p>
                </div>
              </div>

              <div className="card">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment method</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {PAYMENT_METHODS.map((method) => (
                    <label
                      key={method.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        padding: 12,
                        borderRadius: 12,
                        border: paymentMethod === method.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: paymentMethod === method.id ? 'rgba(0,0,0,0.02)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method.id}
                        onChange={() => setPaymentMethod(method.id)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{method.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{method.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {paymentMethod === 'mobile_money' && (
                <>
                  <div className="card">
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mobile money details</p>
                    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phone number</span>
                      <input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder={countryPrefix ? `${countryPrefix}7xxxxxxx` : '2507xxxxxxx'}
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14 }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Provider</span>
                      <select
                        value={providerCode}
                        onChange={(e) => setProviderCode(e.target.value)}
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14 }}
                      >
                        {providerLoading && <option>Loading providers...</option>}
                        {!providerLoading && providerOptions.length === 0 && <option value="">No providers available</option>}
                        {providerOptions.map((provider) => (
                          <option key={provider.provider} value={provider.provider}>
                            {provider.displayName || provider.provider}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {predictedProvider && (
                        <div>Predicted provider: <strong>{predictedProvider}</strong></div>
                      )}
                      {countryPrefix && <div>Country prefix: <strong>{countryPrefix}</strong></div>}
                      {providerMessage && <div>{providerMessage}</div>}
                    </div>
                  </div>
                </>
              )}

              <div className="card">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment status</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{paymentLabel(paymentStatus)}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {paymentNote || 'After you confirm, approve the payment prompt on your Mobile Money phone.'}
                    </p>
                  </div>
                </div>
                {depositId && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                    Deposit ID: {depositId}
                  </p>
                )}
              </div>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                {[
                  ['Unit price', `RWF ${Number(product.price_rwf).toLocaleString()}`],
                  ['Quantity', `x ${qty}`],
                  ['Subtotal', `RWF ${subtotal.toLocaleString()}`],
                  ['Delivery fee', `RWF ${delivery.toLocaleString()}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    <span>{l}</span><span>{v}</span>
                  </div>
                ))}
                <hr className="divider" style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span><span>RWF {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="spacer" />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-primary" onClick={handleOrder} disabled={submitting || paymentStatus === 'processing' || providerLoading || providerOptions.length === 0}>
            {providerLoading
              ? 'Loading Mobile Money options...'
              : submitting || paymentStatus === 'processing'
                ? 'Payment in progress...'
                : providerOptions.length === 0
                  ? 'Mobile Money setup required'
                  : 'Confirm and pay via MoMo'}
          </button>
        </div>
      </div>
    </RoleShell>
  );
}
