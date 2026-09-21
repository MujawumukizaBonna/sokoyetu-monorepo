import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMySupplier, updateMySupplier, updateMe, changePassword, logoutAll } from '../api';
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

// Kept in step with MIN_PASSWORD_LENGTH in the backend auth controller. This
// check is only here to give faster feedback; the backend is authoritative.
const MIN_PASSWORD_LENGTH = 6;

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

function ReadOnlyRow({ label, value, hint }) {
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
      </div>
      {hint && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function SuccessNote({ children }) {
  return (
    <div style={{ background: 'var(--green-light)', color: '#27500A', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 500 }}>
      {children}
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logoutUser, updateUser, loginUser } = useAuth();
  const isManufacturer = user?.role === 'manufacturer';

  const nav = isManufacturer ? MANUFACTURER_NAV : RETAILER_NAV;
  const bottomNav = isManufacturer ? MANUFACTURER_BOTTOM_NAV : RETAILER_BOTTOM_NAV;

  const [error, setError] = useState('');

  // Personal details — editable by both roles.
  const [profile, setProfile] = useState({
    name: user?.name || '',
    location: user?.location || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Business profile — manufacturers only.
  const [business, setBusiness] = useState(null);
  const [loadingBusiness, setLoadingBusiness] = useState(isManufacturer);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savedBusiness, setSavedBusiness] = useState(false);

  // Password change — available to both roles.
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);

  // Sign out everywhere — asks for confirmation first, since it ends this session too.
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    if (!isManufacturer) return;

    getMySupplier()
      .then(res => {
        const supplier = res.data;
        setBusiness({
          name: supplier.name || '',
          category: supplier.category || CATEGORIES[0],
          description: supplier.description || '',
          location: supplier.location || '',
          emoji: supplier.emoji || '🏭',
        });
      })
      .catch(err => setError(err.response?.data?.error || 'Could not load your business profile.'))
      .finally(() => setLoadingBusiness(false));
  }, [isManufacturer]);

  const setProfileField = (key, value) => setProfile(current => ({ ...current, [key]: value }));
  const setBusinessField = (key, value) => setBusiness(current => ({ ...current, [key]: value }));

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      setError('Your name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    setError('');

    try {
      const res = await updateMe({ name: profile.name.trim(), location: profile.location });
      updateUser(res.data);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save your details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveBusiness = async () => {
    if (!business.name.trim()) {
      setError('Business name is required.');
      return;
    }

    setSavingBusiness(true);
    setError('');

    try {
      await updateMySupplier({
        name: business.name.trim(),
        category: business.category,
        description: business.description,
        location: business.location,
        emoji: business.emoji,
      });
      setSavedBusiness(true);
      setTimeout(() => setSavedBusiness(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSavingBusiness(false);
    }
  };

  const memberSince = formatDate(user?.created_at);

  const setPasswordField = (key, value) => setPasswords(current => ({ ...current, [key]: value }));

  const savePassword = async () => {
    const { current, next, confirm } = passwords;

    if (!current || !next || !confirm) {
      setError('Fill in your current password, the new password, and the confirmation.');
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('New password must be different from your current password.');
      return;
    }

    setSavingPassword(true);
    setError('');

    try {
      const res = await changePassword({ currentPassword: current, newPassword: next });

      // Changing the password revokes every token that already existed, including
      // the one this tab is using. The response carries a replacement, so store it
      // and this device stays signed in while the others are signed out.
      if (res.data?.token) loginUser(res.data.token, user);

      setPasswords({ current: '', next: '', confirm: '' });
      setSavedPassword(true);
      setTimeout(() => setSavedPassword(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    setError('');

    try {
      await logoutAll();
      // That request revoked this session along with the others, so drop the local
      // token and let the router return to sign-in.
      logoutUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not sign out of your other devices.');
    } finally {
      setSigningOutAll(false);
      setConfirmingLogoutAll(false);
    }
  };

  return (
    <RoleShell
      brand={isManufacturer ? 'Manufacturer Hub' : 'SokoYetu'}
      description={
        isManufacturer
          ? 'Manage your details, public business profile, and listings.'
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

            {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

            <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
              Your details
            </p>

            {savedProfile && <SuccessNote>Your details have been updated.</SuccessNote>}

            <div className="stack" style={{ marginBottom: 8 }}>
              <div className="field">
                <label>Full name</label>
                <input
                  value={profile.name}
                  onChange={e => setProfileField('name', e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="field">
                <label>Location</label>
                <input
                  value={profile.location}
                  onChange={e => setProfileField('location', e.target.value)}
                  placeholder="e.g. Kigali"
                />
              </div>

              <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save details'}
              </button>
            </div>

            <div className="surface-card" style={{ borderRadius: 'var(--radius-lg)', padding: '4px 16px 12px', marginTop: 8 }}>
              <ReadOnlyRow
                label="Phone number"
                value={user?.phone}
                hint="Used to sign in and cannot be changed here."
              />
              <ReadOnlyRow label="Role" value={ROLE_LABEL[user?.role] || user?.role} />
              <ReadOnlyRow label="Member since" value={memberSince} />
            </div>

            {isManufacturer && (
              <>
                <div className="divider" style={{ margin: '24px 0 18px' }} />

                <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  Business profile
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  Retailers see this information when they browse suppliers.
                </p>

                {savedBusiness && <SuccessNote>Business profile updated.</SuccessNote>}

                {loadingBusiness ? (
                  <div className="spinner" />
                ) : business ? (
                  <div className="stack">
                    <div className="field">
                      <label>Business name</label>
                      <input
                        value={business.name}
                        onChange={e => setBusinessField('name', e.target.value)}
                        placeholder="e.g. Kigali Dairy Works"
                      />
                    </div>

                    <div className="field">
                      <label>Category</label>
                      <select value={business.category} onChange={e => setBusinessField('category', e.target.value)}>
                        {CATEGORIES.map(category => <option key={category}>{category}</option>)}
                      </select>
                    </div>

                    <div className="field">
                      <label>Business location</label>
                      <input
                        value={business.location}
                        onChange={e => setBusinessField('location', e.target.value)}
                        placeholder="e.g. Kigali"
                      />
                    </div>

                    <div className="field">
                      <label>Business icon</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {SUPPLIER_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setBusinessField('emoji', emoji)}
                            style={{
                              width: 40,
                              height: 40,
                              fontSize: 22,
                              border: `2px solid ${business.emoji === emoji ? 'var(--text)' : 'var(--border)'}`,
                              borderRadius: 8,
                              background: business.emoji === emoji ? 'var(--bg-secondary)' : 'transparent',
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
                        value={business.description}
                        onChange={e => setBusinessField('description', e.target.value)}
                        placeholder="What you make, your capacity, delivery areas..."
                      />
                    </div>

                    <button className="btn-primary" onClick={saveBusiness} disabled={savingBusiness}>
                      {savingBusiness ? 'Saving...' : 'Save business profile'}
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

            <div className="divider" style={{ margin: '24px 0 18px' }} />

            <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
              Password
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Choose something at least {MIN_PASSWORD_LENGTH} characters long that you do not use elsewhere.
            </p>

            {savedPassword && <SuccessNote>Password changed. Any other devices have been signed out.</SuccessNote>}

            <div className="stack" style={{ marginBottom: 8 }}>
              <div className="field">
                <label>Current password</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={e => setPasswordField('current', e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
              </div>

              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={passwords.next}
                  onChange={e => setPasswordField('next', e.target.value)}
                  placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={e => setPasswordField('confirm', e.target.value)}
                  placeholder="Repeat the new password"
                  autoComplete="new-password"
                />
              </div>

              <button className="btn-primary" onClick={savePassword} disabled={savingPassword}>
                {savingPassword ? 'Changing...' : 'Change password'}
              </button>
            </div>

            <div className="divider" style={{ margin: '24px 0 18px' }} />

            <p className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
              Devices
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Signing out everywhere ends every session on every device, including this one. Use it if
              you think someone else has access to your account.
            </p>

            {confirmingLogoutAll ? (
              <div className="surface-card" style={{ borderRadius: 'var(--radius-md)', padding: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  Sign out of every device?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={signOutEverywhere} disabled={signingOutAll} style={{ flex: 1 }}>
                    {signingOutAll ? 'Signing out...' : 'Yes, sign out everywhere'}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmingLogoutAll(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setConfirmingLogoutAll(true)} style={{ width: '100%' }}>
                Sign out of all devices
              </button>
            )}

            <div className="divider" style={{ margin: '24px 0 16px' }} />

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
