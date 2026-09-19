import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../context/AuthContext';

const DISTRICTS = [
  'Bugesera', 'Burera', 'Gakenke', 'Gasabo', 'Gatsibo', 'Gicumbi',
  'Gisagara', 'Huye', 'Kamonyi', 'Karongi', 'Kayonza', 'Kicukiro', 'Kirehe', 'Muhanga',
  'Musanze', 'Ngoma', 'Ngororero', 'Nyabihu', 'Nyagatare', 'Nyamagabe', 'Nyamasheke',
  'Nyanza', 'Nyarugenge', 'Nyaruguru', 'Rubavu', 'Ruhango', 'Rulindo', 'Rusizi',
  'Rutsiro', 'Rwamagana'
];

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role') || 'retailer';
  const { loginUser } = useAuth();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    location: '',
    role,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.password || !form.location) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await register(form);
      loginUser(res.data.token, res.data.user);
      navigate(role === 'retailer' ? '/retailer' : '/manufacturer');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell surface-page">
      <div className="page-panel page-panel--narrow" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 32, paddingBottom: 32 }}>
        <button className="nav-back" onClick={() => navigate('/')} style={{ marginBottom: 24, alignSelf: 'flex-start' }}>
          ‹ Back
        </button>

        <div className="center-copy" style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
            {role === 'retailer' ? '🛒' : '🏭'} Create account
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Register as a {role}
          </p>
        </div>

        <div className="stack" style={{ flex: 1 }}>
          {error && <div className="error-box">{error}</div>}

          <div className="field">
            <label>{role === 'retailer' ? 'Full name' : 'Company name'}</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={role === 'retailer' ? 'e.g. Amina Uwimana' : 'e.g. Inyange Industries'}
            />
          </div>

          <div className="field">
            <label>Phone number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 0788123456"
            />
          </div>

          <div className="field">
            <label>{role === 'retailer' ? 'Your district' : 'Company location'}</label>
            <select value={form.location} onChange={e => set('location', e.target.value)}>
              <option value="">Select district...</option>
              {DISTRICTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to={`/login?role=${role}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
