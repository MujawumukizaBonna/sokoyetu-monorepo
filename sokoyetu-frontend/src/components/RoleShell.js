import { useLocation, useNavigate } from 'react-router-dom';

function matchesPath(pathname, match) {
  if (Array.isArray(match)) {
    return match.some(pattern => matchesPath(pathname, pattern));
  }

  if (typeof match === 'function') {
    return match(pathname);
  }

  return pathname === match || pathname.startsWith(`${match}/`);
}

export default function RoleShell({ brand, description, items, onLogout, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <div className="role-sidebar__brand">
          <h1>{brand}</h1>
          <p>{description}</p>
        </div>

        <nav className="role-nav-group" aria-label={`${brand} navigation`}>
          {items.map(item => {
            const active = matchesPath(location.pathname, item.match);
            return (
              <button
                key={item.label}
                className={`role-nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="role-nav-item__icon">{item.icon}</span>
                <span className="role-nav-item__content">
                  <span className="role-nav-item__title">{item.label}</span>
                  <span className="role-nav-item__meta">{item.meta}</span>
                </span>
                <span style={{ fontSize: 18, opacity: 0.65 }}>›</span>
              </button>
            );
          })}
        </nav>

        <div className="role-sidebar__footer">
          <button className="role-sidebar__logout" onClick={onLogout}>
            Logout
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 4px' }}>
            Built for phones, tablets, and desktop workstations.
          </p>
        </div>
      </aside>

      <div className="role-main">
        {children}
      </div>
    </div>
  );
}
