import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [mode, setMode]       = useState('signin'); // signin | signup | reset
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();

  async function handleResend() {
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await authAPI.resendVerification(email);
      setSuccess('Verification email resent! Please check your inbox.');
    } catch (err) {
      setError(err.message || 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const data = await authAPI.signin(email, password);
        login(data);
        navigate('/check');

      } else if (mode === 'signup') {
        const data = await authAPI.signup(email, password);
        if (data && data.access_token) {
          login(data);
          navigate('/check');
        } else {
          // If session is not returned directly by signup, authenticate immediately
          const signinData = await authAPI.signin(email, password);
          login(signinData);
          navigate('/check');
        }

      } else if (mode === 'reset') {
        await authAPI.resetPassword(email);
        setSuccess('Password reset email sent — check your inbox.');
        setMode('signin');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Email not confirmed')) {
        setError(
          <>
            Email not verified.{' '}
            <span className="auth-link" style={{ fontWeight: 600 }} onClick={handleResend}>
              Resend verification email?
            </span>
          </>
        );
      } else {
        setError(msg || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    signin: ['Welcome back', 'Sign in to your Markix account'],
    signup: ['Create an account', 'Start checking MCQ sheets in seconds'],
    reset:  ['Reset password', "We'll send a reset link to your email"],
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-mark">
            <svg viewBox="0 0 16 16"><path d="M8 2L14 8L8 14L2 8Z" fill="white"/></svg>
          </div>
          <div>
            <div className="logo-name">Markix</div>
            <div className="logo-sub mono">OMR Check</div>
          </div>
        </div>

        <div className="auth-title">{titles[mode][0]}</div>
        <div className="auth-sub">{titles[mode][1]}</div>

        {error   && <div className="toast toast-error"   style={{ position: 'relative', bottom: 0, right: 0, marginBottom: 16 }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ position: 'relative', bottom: 0, right: 0, marginBottom: 16 }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">Email address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              required
              autoFocus
            />
          </div>

          {mode !== 'reset' && (
            <div className="form-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                required
                minLength={mode === 'signup' ? 6 : undefined}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ borderTopColor: 'white' }} /> : null}
            {loading ? 'Please wait…' :
              mode === 'signin' ? 'Sign in' :
              mode === 'signup' ? 'Create account' :
              'Send reset link'}
          </button>
        </form>

        <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)', zIndex: 1 }} />
            <span style={{ position: 'relative', zIndex: 2, background: 'var(--surface)', padding: '0 12px', fontSize: '12px', color: 'var(--text4)' }}>OR</span>
        </div>

        <button 
            className="btn" 
            style={{ width: '100%', justifyContent: 'center', background: '#fff', border: '1px solid var(--border)', color: 'var(--text)' }}
            onClick={() => authAPI.googleSignin()}
            disabled={loading}
        >
            <svg viewBox="0 0 48 48" style={{ width: 18, height: 18, marginRight: 10 }}>
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            Continue with Google
        </button>

        <div className="divider" />

        <div style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>
          {mode === 'signin' && (
            <>
              <span className="auth-link" onClick={() => { setMode('signup'); setError(''); }}>Create an account</span>
              {' · '}
              <span className="auth-link" onClick={() => { setMode('reset'); setError(''); }}>Forgot password?</span>
            </>
          )}
          {mode === 'signup' && (
            <span>Already have an account?{' '}
              <span className="auth-link" onClick={() => { setMode('signin'); setError(''); }}>Sign in</span>
            </span>
          )}
          {mode === 'reset' && (
            <span className="auth-link" onClick={() => { setMode('signin'); setError(''); }}>Back to sign in</span>
          )}
        </div>
      </div>
    </div>
  );
}
