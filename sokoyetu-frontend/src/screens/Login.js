import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role') || 'retailer';
  const { loginUser } = useAuth();

  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.phone || !form.password) {
      setError('Please enter your phone number and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await login(form);
      const userRole = res.data.user.role;

      if (userRole !== role) {
        setError(
          `This account is registered as a ${userRole}. Please go back and select ${userRole === 'retailer' ? 'Rural retailer' : 'Manufacturer'}.`
        );
        return;
      }

      loginUser(res.data.token, res.data.user);
      navigate(userRole === 'retailer' ? '/retailer' : '/manufacturer');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
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

        <div className="center-copy" style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
            {role === 'retailer' ? '🛒' : '🏭'} Welcome back
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Sign in to your {role} account
          </p>
        </div>

        <div className="stack" style={{ flex: 1 }}>
          {error && <div className="error-box">{error}</div>}

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
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Enter your password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link to={`/register?role=${role}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
