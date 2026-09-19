import { useNavigate } from 'react-router-dom';

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '48px 24px 32px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
            🏪 SokoYetu
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Connecting Kigali manufacturers with rural retailers across Rwanda.
          </p>
        </div>

        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          I am a…
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => navigate('/retailer')}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 32 }}>🛒</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 3 }}>Rural retailer</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Browse & order from Kigali manufacturers</p>
            </div>
            <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>›</span>
          </button>

          <button
            onClick={() => navigate('/manufacturer')}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 32 }}>🏭</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 3 }}>Manufacturer</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>List products & manage incoming orders</p>
            </div>
            <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>›</span>
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 32 }}>
        Made in Rwanda 🇷🇼
      </p>
    </div>
  );
}
