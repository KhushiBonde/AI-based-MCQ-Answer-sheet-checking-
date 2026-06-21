import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../api';
import { Toaster } from 'react-hot-toast';
import { useI18n } from '../context/I18nContext';

const NAV_ITEMS = [
  { path: '/check',     label: 'Check sheet' },
  { path: '/keys',      label: 'Answer Keys' },
  { path: '/batch',     label: 'Batch Mode' },
  { path: '/generator', label: 'Sheet Gen' },
  { path: '/history',   label: 'History' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/classes',   label: 'Classes' },
  { path: '/students',  label: 'Students' },
  { path: '/settings',  label: 'Settings' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [usage, setUsage] = useState({ used: 0, limit: 500, percentage: 0 }); 

  useEffect(() => {
    if (user) {
      import('../api').then(({ usageAPI }) => {
        usageAPI.getUsage().then(setUsage).catch(() => {});
      });
    }
  }, [user]);

  return (
    <div className="app-layout">
      <Toaster position="top-center" />
      
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="logo" style={{ padding: '24px 20px', fontSize: 20, fontWeight: 800 }}>Markix</div>

        <div className="nav-section" style={{ padding: '0 20px 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>
            {t('common.workspace')}
        </div>
        
        <div className="nav-links">
            {NAV_ITEMS.map((item) => (
                <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                style={{ display: 'block', padding: '10px 20px', textDecoration: 'none', color: 'inherit' }}
                onClick={() => setMobileOpen(false)}
                >
                {t(`nav.${item.path.split('/')[1]}`)}
                </Link>
            ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '20px', borderTop: '1px solid #E5E7EB' }}>
            <div style={{ marginBottom: 10, fontSize: 13 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <button className="btn btn-sm" onClick={() => setLang('en')}>EN</button>
                <button className="btn btn-sm" onClick={() => setLang('hi')}>हिन्दी</button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>
                {t('common.signout')}
            </button>
        </div>
      </nav>

      <main className="main-content" style={{ flex: 1 }}>
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: 'white', borderBottom: '1px solid #E5E7EB' }}>
            <button onClick={() => setMobileOpen(!mobileOpen)} style={{ marginRight: 15 }}>☰</button>
            <span style={{ fontWeight: 700 }}>Markix</span>
        </header>
        <div className="page-content" style={{ padding: 24 }}>
            {children}
        </div>
      </main>
    </div>
  );
}
