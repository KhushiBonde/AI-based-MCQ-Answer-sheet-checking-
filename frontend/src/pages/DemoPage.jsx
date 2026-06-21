import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function DemoPage() {
  const [step, setStep] = useState(0); // 0: intro, 1: scanning, 2: result
  const navigate = useNavigate();

  const steps = [
    'Image loaded',
    'Perspective correction',
    'Detecting bubbles',
    'Grading questions',
    'Finalizing report'
  ];

  useEffect(() => {
    if (step === 1) {
      let current = 0;
      const interval = setInterval(() => {
        if (current < steps.length - 1) {
          current++;
        } else {
          clearInterval(interval);
          setTimeout(() => setStep(2), 800);
        }
      }, 700);
      return () => clearInterval(interval);
    }
  }, [step]);

  return (
    <div className="demo-page" style={{ background: '#F9FAFB', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '20px 40px', background: 'white', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
           <div className="logo-mark"><svg viewBox="0 0 16 16"><path d="M8 2L14 8L8 14L2 8Z"/></svg></div>
           <span style={{ fontWeight: 800, fontSize: 18 }}>Markix Demo</span>
        </div>
        <Link to="/login" className="btn btn-primary btn-sm">Sign Up for Full Version</Link>
      </nav>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {step === 0 && (
          <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>📸</div>
            <h2 style={{ marginBottom: 12 }}>Experience the Speed</h2>
            <p style={{ color: '#6B7280', marginBottom: 24 }}>
              Click below to simulate grading a sample MCQ answer sheet. 
              See how our AI identifies bubbles in milliseconds.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => setStep(1)} style={{ width: '100%' }}>
              Check Sample Sheet
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div className="proc-preview" style={{ marginBottom: 40 }}>
               <div className="scan-line"></div>
               <div style={{ fontSize: 40, opacity: 0.5 }}>📝</div>
            </div>
            <div className="proc-steps" style={{ margin: '0 auto' }}>
              {steps.map((text, i) => {
                const isDone = i < steps.filter((_, idx) => idx <= Math.floor(i)).length; // dummy logic
                // we'll just use a simple hack for demo
                return (
                  <div key={i} className={`proc-step ${i === steps.length -1 && step === 2 ? 'done' : ''}`} style={{ opacity: 1 }}>
                     <div className="step-icon wait"></div>
                     <div className="step-lbl" style={{ color: '#6B7280' }}>{text}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: 20, color: '#059669', fontWeight: 600 }}>Simulated Analysis...</p>
          </div>
        )}

        {step === 2 && (
          <div className="card" style={{ maxWidth: 700, width: '100%', overflow: 'hidden' }}>
             <div className="result-banner">
                <div>
                   <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span className="score-num">18</span>
                      <span className="score-den">/ 20</span>
                   </div>
                   <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <span className="chip chip-correct">18 correct</span>
                      <span className="chip chip-wrong">2 wrong</span>
                   </div>
                </div>
                <div style={{ background: '#059669', width: 60, height: 60, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28, fontWeight: 800 }}>A+</div>
             </div>
             <div style={{ padding: 24 }}>
                <div className="section-label" style={{ marginBottom: 16 }}>Mock Visualization</div>
                <div className="q-grid">
                   {[...Array(20)].map((_, i) => (
                      <div key={i} className={`q-cell ${i === 4 || i === 12 ? 'wrong' : 'correct'}`}>
                         <div className="q-num">Q{i+1}</div>
                         <div className="q-ans">{i === 12 ? 'B' : 'A'}</div>
                      </div>
                   ))}
                </div>
                <div className="divider"></div>
                <div style={{ textAlign: 'center', padding: 20, background: '#ECFDF5', borderRadius: 12 }}>
                   <h3 style={{ marginBottom: 8, color: '#047857' }}>Wowed by the speed?</h3>
                   <p style={{ color: '#065F46', fontSize: 14, marginBottom: 20 }}>Sign up to start grading your own sheets for free.</p>
                   <Link to="/login" className="btn btn-primary">Create Account</Link>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
