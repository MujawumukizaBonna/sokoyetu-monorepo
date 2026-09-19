import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: '🚚',
    title: 'Faster ordering',
    text: 'Retailers can find products, compare suppliers, and place orders without the back-and-forth.',
  },
  {
    icon: '🏭',
    title: 'Simple manufacturer dashboard',
    text: 'Publish products, manage stock, and respond to incoming orders from one clear workspace.',
  },
  {
    icon: '📱',
    title: 'Built for every screen',
    text: 'The layout adapts from small phones to tablets and large desktop monitors without feeling cramped.',
  },
  {
    icon: '🔒',
    title: 'Role-based access',
    text: 'Each user lands in the right experience, with sign-in and navigation tailored to their workflow.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Choose your role',
    text: 'Start as a retailer or manufacturer so the platform can show the right tools and flows.',
  },
  {
    num: '02',
    title: 'Explore or publish',
    text: 'Retailers browse suppliers and products. Manufacturers publish listings and manage orders.',
  },
  {
    num: '03',
    title: 'Keep everything in sync',
    text: 'Orders, inventory, and product updates stay in one place as your business grows.',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'retailer' ? '/retailer' : '/manufacturer');
    }
  }, [user, navigate]);

  return (
    <div className="page-shell surface-page landing-shell">
      <header className="nav">
        <span className="nav-title">SokoYetu</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-back" onClick={() => navigate('/login?role=retailer')}>Sign in</button>
          <button
            className="btn-primary"
            onClick={() => navigate('/login?role=retailer')}
            style={{ width: 'auto', minHeight: 40, padding: '10px 14px', fontSize: 13 }}
          >
            Get started
          </button>
        </div>
      </header>

      <main className="page-panel">
        <section className="landing-hero">
          <div className="landing-hero__grid">
            <div>
              <div className="hero-badge">🌍 Connecting Kigali manufacturers with retailers across Rwanda</div>
              <p className="hero-kicker">Simple supply chain, one clean workspace</p>
              <h1 className="hero-title" style={{ maxWidth: 760, marginBottom: 14 }}>
                A better way for retailers and manufacturers to work together.
              </h1>
              <p className="hero-copy" style={{ maxWidth: 620 }}>
                SokoYetu helps rural retailers discover trusted suppliers, place orders faster, and keep buying organized.
                Manufacturers can publish products, track demand, and manage incoming orders from the same responsive platform.
              </p>

              <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate('/login?role=retailer')} style={{ width: 'auto' }}>
                  I am a retailer
                </button>
                <button className="btn-ghost" onClick={() => navigate('/login?role=manufacturer')} style={{ width: 'auto' }}>
                  I am a manufacturer
                </button>
              </div>
            </div>

            <div className="hero-panel">
              <div className="hero-panel__mock">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Platform snapshot
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>One platform, two views</p>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--green-light)', display: 'grid', placeItems: 'center', fontSize: 22 }}>
                    🛍️
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ padding: 14, borderRadius: 18, background: 'white', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Retailer view</p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Browse suppliers, filter products, place orders</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Clean navigation and quick actions that stay usable on any screen size.
                    </p>
                  </div>
                  <div style={{ padding: 14, borderRadius: 18, background: 'white', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Manufacturer view</p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Track orders, publish products, see performance</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Designed to work like a dashboard on desktop and a focused app on mobile.
                    </p>
                  </div>
                </div>

                <div className="hero-panel__metrics">
                  <div className="metric">
                    <strong>Responsive</strong>
                    <span>Adapts from phone to desktop</span>
                  </div>
                  <div className="metric">
                    <strong>Fast</strong>
                    <span>Simple flows for daily work</span>
                  </div>
                  <div className="metric">
                    <strong>Clear</strong>
                    <span>Role-specific navigation</span>
                  </div>
                  <div className="metric">
                    <strong>Practical</strong>
                    <span>Built for real ordering needs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>Why teams use it</h2>
            <p>
              The app keeps the experience focused for the task at hand while still scaling up gracefully on bigger screens.
            </p>
          </div>

          <div className="feature-grid">
            {FEATURES.map(feature => (
              <article key={feature.title} className="feature-card">
                <div className="feature-card__icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>Made for both sides of the market</h2>
            <p>Retailers and manufacturers get different navigation, but the same visual language and responsive behavior.</p>
          </div>

          <div className="audience-grid">
            <article className="audience-card">
              <div className="audience-card__title">
                <div className="audience-card__icon">🏪</div>
                <div>
                  <h3>For retailers</h3>
                  <p>Find trusted suppliers, compare products, and place orders without friction.</p>
                </div>
              </div>
              <p>
                The retailer flow is built for quick browsing, fast filtering, and repeat ordering from phones, tablets, and desktop workstations.
              </p>
            </article>

            <article className="audience-card">
              <div className="audience-card__title">
                <div className="audience-card__icon">📊</div>
                <div>
                  <h3>For manufacturers</h3>
                  <p>Keep stock updated, publish listings, and respond to demand in one workspace.</p>
                </div>
              </div>
              <p>
                The manufacturer experience behaves like a dashboard on larger screens while remaining simple and touch-friendly on smaller devices.
              </p>
            </article>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>How it works</h2>
            <p>
              A straightforward flow keeps onboarding easy and avoids clutter as the platform grows.
            </p>
          </div>

          <div className="steps-grid">
            {STEPS.map(step => (
              <article key={step.num} className="step-card">
                <div className="step-card__num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" style={{ paddingBottom: 6 }}>
          <div className="hero-panel" style={{ padding: 18 }}>
            <div style={{ display: 'grid', gap: 12, alignItems: 'center' }}>
              <div>
                <p className="hero-kicker" style={{ marginBottom: 8 }}>Ready to begin?</p>
                <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', lineHeight: 1.15, letterSpacing: '-0.04em', marginBottom: 8 }}>
                  Choose your role and start using the platform in the way that fits your work.
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  We'll take you to the right experience and keep the interface readable at every screen size.
                </p>
              </div>
              <div className="hero-actions" style={{ marginTop: 6 }}>
                <button className="btn-primary" onClick={() => navigate('/login?role=retailer')} style={{ width: 'auto' }}>
                  Start as retailer
                </button>
                <button className="btn-ghost" onClick={() => navigate('/login?role=manufacturer')} style={{ width: 'auto' }}>
                  Start as manufacturer
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-footer__bar">
            <p>SokoYetu, built for modern commerce across Rwanda.</p>
            <p>Responsive by design for phones, tablets, and desktops.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
