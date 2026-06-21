import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { keysAPI } from '../api';
import AppLayout from '../components/AppLayout';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const CHOICES = [4, 5];
const MAX_Q   = 50;

function ShareModal({ keyData, onClose }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    keysAPI.getShareCode(keyData.id)
      .then(res => setCode(res.share_code))
      .catch(() => toast.error('Failed to get share code'))
      .finally(() => setLoading(false));
  }, [keyData.id]);

  function copyCode() {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
         <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Share Answer Key</div>
         <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            Give this code to another teacher. They can import it in their dashboard.
         </div>
         
         <div style={{ 
            background: 'var(--surface)', 
            padding: '16px', 
            borderRadius: 12, 
            textAlign: 'center',
            border: '1px dashed var(--border)',
            marginBottom: 20
         }}>
            {loading ? (
                <div style={{ fontSize: 12, color: 'var(--text4)' }}>Generating code...</div>
            ) : (
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: 'var(--brand)', fontFamily: 'DM Mono' }}>
                    {code}
                </div>
            )}
         </div>

         <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={onClose}>Close</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyCode} disabled={!code}>
                Copy Code
            </button>
         </div>
      </div>
    </div>
  );
}

function KeyCard({ keyData, onEdit, onDelete, onShare }) {
  return (
    <div className="card" style={{ cursor: 'default' }}>
      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{keyData.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono' }}>
            {keyData.question_count} Q · {keyData.choices_per_question} choices
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" style={{ background: 'var(--surface2)', color: 'var(--text)' }} onClick={() => onShare(keyData)}>Share</button>
          <button className="btn btn-sm" onClick={() => onEdit(keyData)}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(keyData.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function KeyModal({ keyData, onClose, onSave }) {
  const [name, setName]       = useState(keyData?.name || '');
  const [numQ, setNumQ]       = useState(keyData?.question_count || 20);
  const [choices, setChoices] = useState(keyData?.choices_per_question || 4);
  const [answers, setAnswers] = useState(() => {
    if (keyData?.answers) return keyData.answers;
    return Array(keyData?.question_count || 20).fill(null);
  });
  const [sections, setSections] = useState(keyData?.sections || []);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const scanFileRef = useRef(null);

  function handleNumQ(n) {
    const count = Math.min(Math.max(1, Number(n)), MAX_Q);
    setNumQ(count);
    setAnswers(prev => {
      const next = [...prev];
      while (next.length < count) next.push(null);
      return next.slice(0, count);
    });
    setScanResult(null);
  }

  function setAnswer(i, idx) {
    setAnswers(prev => {
      const next = [...prev];
      next[i] = idx;
      return next;
    });
  }

  async function handleScanImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError('');
    setScanResult(null);
    const toastId = toast.loading('Scanning answer key image…');
    try {
      const result = await keysAPI.scan(file, numQ, choices);
      // result.answers_idx = [0, 1, null, 3, ...] (0-based ints)
      const newAnswers = (result.answers_idx || []).map(a => (a !== null && a !== undefined) ? a : null);
      // Ensure array length matches numQ
      while (newAnswers.length < numQ) newAnswers.push(null);
      setAnswers(newAnswers.slice(0, numQ));
      setScanResult(result);
      toast.success(
        `Detected ${result.detected}/${result.num_questions} answers (${result.confidence}% confidence)`,
        { id: toastId }
      );
    } catch (err) {
      setError(`Scan failed: ${err.message}`);
      toast.error(`Scan failed: ${err.message}`, { id: toastId });
    } finally {
      setScanning(false);
      if (scanFileRef.current) scanFileRef.current.value = '';
    }
  }

  function addSection() {
    setSections(prev => [...prev, { name: '', start_q: 1, end_q: numQ }]);
  }

  function removeSection(idx) {
    setSections(prev => prev.filter((_, i) => i !== idx));
  }

  function updateSection(idx, field, val) {
    setSections(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (answers.some(a => a === null)) { setError('Please fill all answers'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { 
        name: name.trim(), 
        question_count: numQ, 
        choices_per_question: choices, 
        answers,
        sections
      };
      if (keyData?.id) await keysAPI.update(keyData.id, payload);
      else await keysAPI.create(payload);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const LABELS = ['A', 'B', 'C', 'D', 'E'];
  const filledCount = answers.filter(a => a !== null).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {keyData?.id ? 'Edit answer key' : 'Create answer key'}
        </div>

        <div className="form-group">
          <label className="input-label">Key name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Class 10 — Science Test 3" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="input-label">Questions</label>
            <input className="input" type="number" min="1" max="50" value={numQ} onChange={e => handleNumQ(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Choices per question</label>
            <select className="input" value={choices} onChange={e => setChoices(Number(e.target.value))}>
              {CHOICES.map(c => <option key={c} value={c}>{c} (A–{LABELS[c-1]})</option>)}
            </select>
          </div>
        </div>

        {/* ── Sections ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Sections (Optional)</label>
                <button className="btn btn-ghost btn-sm" onClick={addSection} style={{ fontSize: 11, padding: '2px 8px' }}>+ Add Section</button>
            </div>
            {sections.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text4)', background: 'var(--surface2)', padding: '10px', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                    No sections defined. Total score will be calculated.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sections.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input 
                                className="input input-sm" 
                                style={{ flex: 2 }}
                                placeholder="Section Name" 
                                value={s.name} 
                                onChange={e => updateSection(i, 'name', e.target.value)} 
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 3 }}>
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Q</span>
                                <input 
                                    className="input input-sm" 
                                    type="number" 
                                    style={{ width: 50 }}
                                    value={s.start_q} 
                                    onChange={e => updateSection(i, 'start_q', parseInt(e.target.value))} 
                                />
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>to</span>
                                <input 
                                    className="input input-sm" 
                                    type="number" 
                                    style={{ width: 50 }}
                                    value={s.end_q} 
                                    onChange={e => updateSection(i, 'end_q', parseInt(e.target.value))} 
                                />
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeSection(i)}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* ── Scan from Image section ────────────────────────────────── */}
        <div style={{
          background: 'var(--surface2, #f0fdf4)',
          border: '1px dashed var(--brand, #059669)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="var(--brand, #059669)" strokeWidth="1.5" style={{ width: 18, height: 18, flexShrink: 0 }}>
              <path strokeLinecap="round" d="M2 5.5V3.5A1.5 1.5 0 013.5 2h2M10.5 2h2A1.5 1.5 0 0114 3.5v2M14 10.5v2a1.5 1.5 0 01-1.5 1.5h-2M5.5 14h-2A1.5 1.5 0 012 12.5v-2"/>
              <rect x="4.5" y="4.5" width="7" height="7" rx="1"/>
            </svg>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Scan from image</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Upload a photo of a filled-in bubble sheet to auto-detect answers</div>
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={scanFileRef}
            style={{ display: 'none' }}
            onChange={handleScanImage}
          />
          <button
            className="btn btn-sm"
            style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none' }}
            onClick={() => scanFileRef.current?.click()}
            disabled={scanning}
          >
            {scanning ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Scanning…
              </span>
            ) : '📷 Upload answer key image'}
          </button>

          {/* Scan result banner */}
          {scanResult && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 11,
              background: scanResult.confidence >= 70 ? 'rgba(5,150,105,.1)' : 'rgba(217,119,6,.1)',
              color: scanResult.confidence >= 70 ? 'var(--brand)' : 'var(--warn)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>✓ Detected <strong>{scanResult.detected}</strong> of {scanResult.num_questions} answers</span>
              <span style={{ fontFamily: 'DM Mono', fontWeight: 600, fontSize: 10 }}>
                {scanResult.confidence}% confidence
              </span>
            </div>
          )}
        </div>

        {/* ── Manual answers grid ────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Correct answers
          </div>
          <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'DM Mono' }}>
            {filledCount}/{numQ} filled
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
          maxHeight: 260,
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          {Array.from({ length: numQ }).map((_, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'DM Mono', marginBottom: 4 }}>Q{i + 1}</div>
              <select
                className="input"
                style={{
                  padding: '5px 4px',
                  fontSize: 12,
                  textAlign: 'center',
                  borderColor: answers[i] !== null ? 'var(--brand)' : undefined,
                  background: answers[i] !== null ? 'rgba(5,150,105,.05)' : undefined,
                }}
                value={answers[i] !== null ? answers[i] : ''}
                onChange={e => setAnswer(i, e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">—</option>
                {LABELS.slice(0, choices).map((l, idx) => <option key={idx} value={idx}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save key'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KeysPage() {
  const [keys, setKeys]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalKey, setModalKey] = useState(null); // null = closed, {} = create, {...} = edit
  const [showModal, setShowModal] = useState(false);
  const [shareKey, setShareKey] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  async function handleImportByCode() {
    const code = window.prompt('Enter 6-digit share code:');
    if (!code) return;
    try {
      const toastId = toast.loading('Importing key...');
      await keysAPI.importKey(code);
      toast.success('Key imported successfully!', { id: toastId });
      loadKeys();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    }
  }

  async function handleBulkImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const toastId = toast.loading('Reading dataset...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      let headerIdx = -1;
      let keyColIdx = -1;
      
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (!rows[i]) continue;
        for (let j = 0; j < rows[i].length; j++) {
           const cell = rows[i][j];
           if (typeof cell === 'string' && cell.trim().toLowerCase() === 'key_name') {
             headerIdx = i;
             keyColIdx = j;
             break;
           }
        }
        if (headerIdx !== -1) break;
      }

      if (headerIdx === -1) {
        throw new Error("Could not find 'key_name' header. Ensure your columns are named correctly.");
      }

      let createdCount = 0;
      const LABELS = ['A', 'B', 'C', 'D', 'E'];

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[keyColIdx]) continue;
        
        const keyName = row[keyColIdx];
        const numQ = parseInt(row[keyColIdx + 3]) || 0;
        if (numQ <= 0) continue;
        
        // Count total choices provided for this question map based on what's max 
        let maxChoice = 4; // Default to 4
        
        const answers = [];
        for (let q = 0; q < numQ; q++) {
          const cell = row[keyColIdx + 4 + q];
          if (!cell || typeof cell !== 'string') {
            answers.push(null);
          } else {
            const letter = cell.trim().toUpperCase();
            const idx = LABELS.indexOf(letter);
            answers.push(idx !== -1 ? idx : null);
          }
        }
        
        const payload = {
          name: typeof keyName === 'string' ? keyName : String(keyName),
          question_count: numQ,
          choices_per_question: maxChoice,
          answers: answers
        };
        
        await keysAPI.create(payload);
        createdCount++;
      }

      toast.success(`Successfully imported ${createdCount} answer key(s)!`, { id: toastId });
      loadKeys();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`, { id: toastId });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ''; // Reset file input
    }
  }

  async function loadKeys() {
    setLoading(true);
    try { setKeys(await keysAPI.list() || []); }
    catch (e) { setKeys([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this answer key? This cannot be undone.')) return;
    await keysAPI.delete(id).catch(() => {});
    loadKeys();
  }

  function handleEdit(key) { setModalKey(key); setShowModal(true); }
  function handleCreate()  { setModalKey({});  setShowModal(true); }
  function handleClose()   { setShowModal(false); setModalKey(null); }
  function handleSaved()   { handleClose(); loadKeys(); }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-title">Answer keys</div>
          <div className="page-sub">Manage your saved answer keys for grading.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} style={{ display: 'none' }} onChange={handleBulkImport} />
          <button className="btn" onClick={handleImportByCode}>Import by Code</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Bulk Upload'}
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>+ Create key</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : keys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔑</div>
          <div className="empty-title">No answer keys yet</div>
          <div className="empty-sub">Create your first answer key to start checking sheets.</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
             <button className="btn btn-primary" onClick={handleCreate}>Create answer key</button>
             <button className="btn" onClick={handleImportByCode}>Import using code</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {keys.map(k => (
            <KeyCard key={k.id} keyData={k} onEdit={handleEdit} onDelete={handleDelete} onShare={setShareKey} />
          ))}
        </div>
      )}

      {showModal && (
        <KeyModal keyData={modalKey} onClose={handleClose} onSave={handleSaved} />
      )}

      {shareKey && (
        <ShareModal keyData={shareKey} onClose={() => setShareKey(null)} />
      )}
    </AppLayout>
  );
}
