import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAPI, keysAPI, usageAPI, classesAPI, studentsAPI } from '../api';
import AppLayout from '../components/AppLayout';
import OnboardingWizard from '../components/OnboardingWizard';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

// ── States ───────────────────────────────────────────────────────────────────
const STEP = { UPLOAD: 'upload', PROCESSING: 'processing', DONE: 'done' };

// ── Icons ─────────────────────────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.5" style={{ width: 26, height: 26, stroke: 'var(--brand)', fill: 'none' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
  );
}

function CheckIcon({ style }) {
  return (
    <svg viewBox="0 0 12 12" strokeWidth="2" style={{ width: 10, height: 10, ...style }}>
      <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" stroke="white" fill="none"/>
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg viewBox="0 0 12 12" strokeWidth="2" style={{ width: 10, height: 10, stroke: 'white', fill: 'none' }}>
      <circle cx="6" cy="6" r="3" strokeDasharray="4 2">
        <animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="1s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

// ── Processing steps ──────────────────────────────────────────────────────────
const PROC_STEPS = [
  'Image loaded & validated',
  'Perspective corrected',
  'Detecting answer bubbles…',
  'Checking against answer key',
  'Generating result image',
];

function ProcessingScreen({ image, uploadPercent }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Only start animation sequence AFTER upload finishes
    if (uploadPercent < 100) return;
    
    const timings = [500, 1000, 1500, 2200];
    const timers = timings.map((t, i) =>
      setTimeout(() => setActiveStep(i + 1), t)
    );
    return () => timers.forEach(clearTimeout);
  }, [uploadPercent]);

  return (
    <div className="proc-page">
      <div className="proc-preview">
        <div className="scan-line" />
        {image && (
          <img
            src={URL.createObjectURL(image)}
            alt="sheet"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .6 }}
          />
        )}
      </div>

      <div className="proc-steps">
        {PROC_STEPS.map((label, i) => {
          let state = 'wait';
          if (uploadPercent >= 100) {
            state = i < activeStep ? 'done' : i === activeStep ? 'active' : 'wait';
          }
          return (
            <div key={i} className={`proc-step ${state}`}>
              <div className={`step-icon ${state}`}>
                {state === 'done'   && <CheckIcon />}
                {state === 'active' && <SpinIcon />}
                {state === 'wait'   && <svg viewBox="0 0 12 12" strokeWidth="1.5" style={{ width: 10, height: 10, stroke: 'white', fill: 'none' }}><circle cx="6" cy="6" r="4"/></svg>}
              </div>
              <span className={`step-lbl ${state}`}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar for Upload */}
      {uploadPercent < 100 && (
        <div style={{ marginTop: 24, padding: '0 20px', width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
            <span>Compressing & Uploading image…</span>
            <span>{uploadPercent}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadPercent}%`, background: 'var(--brand)', transition: 'width 0.2s ease-out' }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text4)' }}>
        This usually takes 1–3 seconds
      </div>
    </div>
  );
}

// ── Main Upload Page ──────────────────────────────────────────────────────────

export default function CheckPage() {
  const [step, setStep]           = useState(STEP.UPLOAD);
  const [image, setImage]         = useState(null);   // File object
  const [preview, setPreview]     = useState(null);   // URL
  const [dragOver, setDragOver]   = useState(false);
  const [keys, setKeys]           = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [usage, setUsage]         = useState({ used: 0, limit: 500 });
  const [classes, setClasses]     = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents]   = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError]         = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading]     = useState(false);
  const fileRef                   = useRef(null);
  const navigate                  = useNavigate();

  // Load answer keys + usage on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [k, u, r, c] = await Promise.all([
          keysAPI.list(),
          usageAPI.getUsage(),
          checkAPI.listResults({ limit: 1 }),
          classesAPI.list()
        ]);
        setKeys(k || []);
        setUsage({ used: u.used || 0, limit: u.limit || 500 });
        setClasses(c || []);
        
        // Detect first use
        const hasBeenOnboarded = localStorage.getItem('ag_onboarded');
        if (!hasBeenOnboarded && (k || []).length === 0 && (r || []).length === 0) {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };
    fetchData();
  }, []);

  // Fetch students when class changes
  useEffect(() => {
    if (selectedClassId) {
      studentsAPI.list(selectedClassId).then(setStudents).catch(console.error);
    } else {
      setStudents([]);
      setSelectedStudentId('');
    }
  }, [selectedClassId]);

  useEffect(() => {
    const handleKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (image && selectedKey && !loading) {
          e.preventDefault();
          startChecking();
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [image, selectedKey, loading, startChecking]);

  function handleFile(file) {
    if (!file) return;
    if (!file.type.match(/^image\//)) {
      setError('Please upload an image file (JPG, PNG, HEIC).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large — max 20 MB');
      return;
    }
    setError('');
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function startChecking() {
    if (!image || !selectedKey) return;
    setStep(STEP.PROCESSING);
    setError('');
    setUploadPercent(0);

    try {
      // 1. Compress Image (down to max 2MB)
      const options = {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(image, options);

      // 2. Upload with Progress Tracking
      const result = await checkAPI.checkSheet(
        compressedFile, 
        selectedKey.id, 
        studentName, 
        selectedStudentId, 
        selectedClassId, 
        (pct) => {
          setUploadPercent(pct);
        }
      );
      
      toast.success('Sheet graded instantly!');
      navigate(`/result/${result.id}`, { state: { result } });
    } catch (err) {
      toast.error(err.message || 'Processing failed. Please try again.');
      setError(''); // Rely on toast instead of banner for logic errors here
      setStep(STEP.UPLOAD);
    }
  }

  if (step === STEP.PROCESSING) {
    return (
      <AppLayout>
        <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="topbar" style={{ position: 'static' }}>
            <div className="topbar-left">
              <span className="brand-pill">Markix</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Processing — please wait…</div>
            <div style={{ width: 80 }} />
          </div>
          <ProcessingScreen image={image} uploadPercent={uploadPercent} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showOnboarding && <OnboardingWizard onComplete={() => {
        setShowOnboarding(false);
        localStorage.setItem('ag_onboarded', 'true');
      }} />}
      <div className="page-title">Check answer sheet</div>
      <div className="page-sub">Upload a photo of the bubble sheet and select an answer key to get instant results.</div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--danger-light)',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--r-md)',
          color: 'var(--danger)',
          fontSize: 13,
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 440 }}>
        {/* Left: upload area */}
        <div style={{ padding: 28, borderRight: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="form-group">
                <label className="input-label">Class (Optional)</label>
                <select 
                    className="input" 
                    value={selectedClassId} 
                    onChange={e => setSelectedClassId(e.target.value)}
                >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label className="input-label">Student (Optional)</label>
                <select 
                    className="input" 
                    value={selectedStudentId} 
                    onChange={e => {
                        const sid = e.target.value;
                        setSelectedStudentId(sid);
                        const s = students.find(x => x.id === sid);
                        if (s) setStudentName(s.name);
                    }}
                    disabled={!selectedClassId}
                >
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.roll_number ? `(${s.roll_number})` : ''}</option>)}
                </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Manual Name Override</label>
            <input
              type="text"
              className="input"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Upload answer sheet
          </div>

          {preview ? (
            /* Preview */
            <div style={{
              border: '2px solid var(--brand)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
              position: 'relative',
              marginBottom: 12,
            }}>
              <img src={preview} alt="preview" style={{ width: '100%', height: 240, objectFit: 'cover' }} />
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(255,255,255,.9)',
                  borderColor: 'var(--border2)',
                }}
                onClick={() => { setImage(null); setPreview(null); }}
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            /* Drop zone */
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{ padding: '60px 20px', textAlign: 'center' }}
            >
              <div style={{ fontSize: 40, marginBottom: 16, display: 'flex', justifyContent: 'center', color: 'var(--brand)' }}>
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 44, height: 44 }}>
                   <path d="M10.5 8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                   <path d="M2 4a2 2 0 012-2h1.414l.707-.707A2 2 0 017.54 1H8.46a2 2 0 011.414.586l.707.707H12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1h-2a1 1 0 00-.707-.293l-1-1A1 1 0 008.586 1h-1.17a1 1 0 00-.708.293l-1 1A1 1 0 005 3H4z"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Capture or upload sheet</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Ensure all 4 corners are visible</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Batch upload teaser */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>or use batch upload</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{
            marginTop: 10,
            background: 'var(--surface)',
            border: '1px dashed var(--border2)',
            borderRadius: 'var(--r-lg)',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Batch upload</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                Up to 500 sheets at once. Get results as CSV.
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => navigate('/batch')}>
              Upload folder
            </button>
          </div>

          {/* Check button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 20, fontSize: 14, padding: '11px 0' }}
            disabled={!image || !selectedKey}
            onClick={startChecking}
          >
            Check sheet
          </button>
          {(!image || !selectedKey) && (
            <div style={{ fontSize: 11, color: 'var(--text4)', textAlign: 'center', marginTop: 6 }}>
              {!image ? 'Upload an image' : 'Select an answer key'} to continue
            </div>
          )}
        </div>

        {/* Right: answer key selection */}
        <div style={{ padding: 22, background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Select answer key
          </div>

          {keys.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              No answer keys yet. Create one to get started.
            </div>
          ) : (
            keys.map(key => (
              <div
                key={key.id}
                className={`key-slot ${selectedKey?.id === key.id ? 'selected' : ''}`}
                onClick={() => setSelectedKey(key)}
              >
                <div>
                  <div className="key-name">{key.name}</div>
                  <div className="key-meta">{key.question_count} Q · {key.choices_per_question} choices</div>
                </div>
                {selectedKey?.id === key.id && (
                  <div className="key-check"><CheckIcon /></div>
                )}
              </div>
            ))
          )}

          <button className="btn btn-ghost btn-sm" style={{ width: '100%', borderStyle: 'dashed', borderColor: 'var(--border2)', marginTop: 4 }}
            onClick={() => navigate('/keys/new')}>
            + Create new answer key
          </button>

          {/* Usage */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              This month's usage
            </div>
            <div className="usage-bar-wrap">
              <div className="usage-bar-fill" style={{ width: `${(usage.used / usage.limit) * 100}%` }} />
            </div>
            <div className="usage-text">
              <span>{usage.used} of {usage.limit} sheets used</span>
              <span>{Math.round((usage.used / usage.limit) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
