import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="logo-mark"><svg viewBox="0 0 16 16"><path d="M8 2L14 8L8 14L2 8Z"/></svg></div>
          <span className="logo-name">Markix</span>
        </div>
        <div className="nav-links">
          {isAuthenticated ? (
            <Link to="/check" className="btn btn-primary btn-sm">Go to Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/login" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <div className="badge badge-green" style={{ marginBottom: 16 }}>Available for Indian Schools</div>
          <h1 className="hero-title">Grading made <span className="text-brand">Instant.</span></h1>
          <p className="hero-sub">
            The world's fastest OMR checker. Grade hundreds of sheets in seconds using just your smartphone camera.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-lg">Start Grading Now</Link>
            <Link to="/demo" className="btn btn-ghost btn-lg">Try Demo →</Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-val">1.2s</div>
              <div className="stat-lbl">Per sheet</div>
            </div>
            <div className="stat">
              <div className="stat-val">99.8%</div>
              <div className="stat-lbl">Accuracy</div>
            </div>
            <div className="stat">
              <div className="stat-val">₹0</div>
              <div className="stat-lbl">Initial cost</div>
            </div>
          </div>
        </div>
        <div className="hero-viz">
           <div className="viz-card">
              <div className="viz-header">
                 <span>Sheet Analysis</span>
                 <span className="text-brand">Live</span>
              </div>
              <div className="viz-body">
                 <div className="viz-scan-line"></div>
                 <div className="bubble-grid">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className={`bubble ${i % 3 === 0 ? 'filled' : ''}`}></div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </main>

      <section className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">📸</div>
          <h3>Snap & Grade</h3>
          <p>Use any smartphone. No expensive scanners or specialized equipment needed.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Deep Analytics</h3>
          <p>Get per-student reports and class-wide trends automatically.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Batch Processing</h3>
          <p>Upload a folder or ZIP of 50 sheets and process them all in one go.</p>
        </div>
      </section>

      <style>{`
        .landing-page {
          background: #fff;
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #111827;
        }
        .landing-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .landing-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hero-section {
          padding: 80px 40px;
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .hero-title {
          font-size: 64px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
        }
        .hero-sub {
          font-size: 20px;
          color: #6B7280;
          margin-bottom: 40px;
          line-height: 1.6;
        }
        .hero-actions {
          display: flex;
          gap: 16px;
          margin-bottom: 60px;
        }
        .hero-stats {
          display: flex;
          gap: 40px;
        }
        .stat-val {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
        }
        .stat-lbl {
          font-size: 14px;
          color: #6B7280;
        }
        .hero-viz {
          background: #F9FAFB;
          border-radius: 24px;
          padding: 40px;
          border: 1px solid #E5E7EB;
          position: relative;
          overflow: hidden;
        }
        .viz-card {
           background: white;
           border-radius: 16px;
           padding: 20px;
           box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
           border: 1px solid #E5E7EB;
        }
        .viz-header {
           display: flex;
           justify-content: space-between;
           font-size: 12px;
           font-weight: 600;
           margin-bottom: 16px;
        }
        .viz-body {
           height: 120px;
           background: #F3F4F6;
           border-radius: 8px;
           position: relative;
        }
        .viz-scan-line {
           position: absolute;
           top: 0; left: 0; right: 0;
           height: 2px;
           background: #059669;
           animation: scan 2s linear infinite;
        }
        @keyframes scan {
           from { top: 0; }
           to { top: 118px; }
        }
        .bubble-grid {
           display: grid;
           grid-template-columns: repeat(4, 1fr);
           gap: 12px;
           padding: 20px;
        }
        .bubble {
           width: 12px;
           height: 12px;
           border-radius: 50%;
           border: 1.5px solid #E5E7EB;
           background: white;
        }
        .bubble.filled {
           background: #059669;
           border-color: #059669;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          padding: 80px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .feature-card {
          padding: 32px;
          border-radius: 20px;
          border: 1px solid #E5E7EB;
          transition: transform 0.2s ease;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: #059669;
        }
        .feature-icon {
          font-size: 32px;
          margin-bottom: 20px;
        }
        .feature-card h3 {
          margin-bottom: 12px;
          font-weight: 700;
        }
        .feature-card p {
          color: #6B7280;
          font-size: 15px;
          line-height: 1.6;
        }
        @media (max-width: 768px) {
          .hero-section { grid-template-columns: 1fr; text-align: center; }
          .hero-actions { justify-content: center; }
          .hero-stats { justify-content: center; }
          .hero-viz { display: none; }
          .features-grid { grid-template-columns: 1fr; }
          .hero-title { font-size: 44px; }
        }
      `}</style>
    </div>
  );
}
