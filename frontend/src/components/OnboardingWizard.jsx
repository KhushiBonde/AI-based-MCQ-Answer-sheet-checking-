import { useState } from 'react';

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "Welcome to Markix!",
      text: "Let's get you set up to grade your first batch of MCQ sheets in seconds.",
      image: "🏠"
    },
    {
      title: "Step 1: Create an Answer Key",
      text: "First, you need to define the correct answers. Head to the 'Answer Keys' section to create one.",
      image: "🔑"
    },
    {
      title: "Step 2: Upload Sheet",
      text: "Once you have a key, come back here and upload a photo of your student's bubble sheet.",
      image: "📸"
    },
    {
      title: "Step 3: Instant Grading",
      text: "Our AI detects the bubbles and calculates the score instantly. You can then download a PDF report.",
      image: "📊"
    }
  ];

  const current = steps[step - 1];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 0, overflow: 'hidden' }}>
        <div style={{ 
          height: 120, 
          background: 'var(--brand-light)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 64
        }}>
          {current.image}
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            {current.title}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 24 }}>
            {current.text}
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            {step > 1 && (
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, background: 'none', border: '1px solid var(--border)' }}
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            <button 
              className="btn btn-primary btn-sm" 
              style={{ flex: step > 1 ? 2 : 1 }}
              onClick={() => {
                if (step < steps.length) setStep(step + 1);
                else onComplete();
              }}
            >
              {step < steps.length ? 'Next' : 'Get Started'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            {steps.map((_, i) => (
              <div 
                key={i} 
                style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  background: (i + 1) === step ? 'var(--brand)' : 'var(--border)' 
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
