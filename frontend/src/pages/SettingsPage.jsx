import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ag_theme') === 'dark');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState({ used: 0, limit: 500 });
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || user?.full_name || '');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('ag_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('ag_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    import('../api').then(({ usageAPI }) => {
      usageAPI.getUsage().then(setUsage).catch(() => {});
    });
  }, []);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { authAPI } = await import('../api');
      const res = await authAPI.updateProfile(fullName);
      updateUser(res.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message || 'Update failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('Password too short.');
    setLoading(true);
    try {
      const { authAPI } = await import('../api');
      await authAPI.updatePassword(newPassword);
      toast.success('Password updated!');
      setNewPassword('');
    } catch (err) {
      toast.error(err.message || 'Update failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-title">Settings</div>
      <div className="page-sub">Manage your account preferences and view usage.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600 }}>Profile</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="input-label">Display Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma" 
                />
              </div>
              <div className="form-group">
                <label className="input-label">Email Address</label>
                <input type="text" className="input" value={user?.email || ''} disabled />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  Email changes are restricted in the Starter plan.
                </div>
              </div>
              <button className="btn btn-sm btn-primary" type="submit" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        </div>

        {/* Plan & Usage Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600 }}>Plan & Usage</div>
          </div>
          <div className="card-body">
            <div style={{ 
                padding: 16, 
                background: 'var(--surface)', 
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16
            }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Starter Plan</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {usage.used} / {usage.limit} sheets used this month
                    </div>
                </div>
                <div className="plan-badge">Active</div>
            </div>
            
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ 
                 height: '100%', 
                 width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`, 
                 background: 'var(--brand)' 
              }} />
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600 }}>Preferences</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Dark Mode</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Reduce eye strain in low-light environments.</div>
                </div>
                <button 
                  className={`btn btn-sm ${darkMode ? 'btn-primary' : ''}`}
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600 }}>Security</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                    <label className="input-label">Change Password</label>
                    <input 
                      type="password" 
                      className="input" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password" 
                    />
                </div>
                <button className="btn btn-sm" type="submit" disabled={loading || !newPassword} style={{ alignSelf: 'flex-start' }}>Update Password</button>
            </form>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
