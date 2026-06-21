import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchAPI, keysAPI, usageAPI } from '../api';
import AppLayout from '../components/AppLayout';
import * as XLSX from 'xlsx';

export default function BatchPage() {
  const [mode, setMode]           = useState('images'); // 'images' | 'csv'
  const [images, setImages]       = useState([]);
  const [csvFile, setCsvFile]     = useState(null);
  const [students, setStudents]   = useState([]); // parsed payload [{student_id, answers}]
  const [dragOver, setDragOver]   = useState(false);
  const [keys, setKeys]           = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [usage, setUsage]         = useState({ used: 0, limit: 500 });
  const [error, setError]         = useState('');
  const [processing, setProcessing]= useState(false);
  const [batchResult, setBatchResult]= useState(null);
  const fileRef                   = useRef(null);
  const csvRef                    = useRef(null);
  const navigate                  = useNavigate();

  useEffect(() => {
    keysAPI.list().then(data => setKeys(data || [])).catch(() => setKeys([]));
    usageAPI.getUsage().then(data => setUsage({ used: data.used || 0, limit: data.limit || 500 })).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const canStart = (mode === 'images' ? images.length > 0 : students.length > 0) && selectedKey && !processing;
        if (canStart) {
          e.preventDefault();
          startBatchCheck();
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [mode, images, students, selectedKey, processing, startBatchCheck]);

  function handleFiles(files) {
    const arr = Array.from(files);
    const valid = arr.filter(f => f.type.match(/^image\//) || f.name.match(/\.(heic|heif|jpg|jpeg|png)$/i));
    if (valid.length === 0) {
      setError('Please select valid image files.');
      return;
    }
    if (images.length + valid.length > 50) {
      setError('You can upload a maximum of 50 images per batch.');
      return;
    }
    setError('');
    setImages(prev => [...prev, ...valid]);
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  async function startBatchCheck() {
    if ((mode === 'images' && images.length === 0) || (mode === 'csv' && students.length === 0) || !selectedKey) return;
    setProcessing(true);
    setError('');
    setBatchResult(null);

    try {
      let res;
      if (mode === 'images') {
        res = await batchAPI.batchCheck(images, selectedKey.id);
        setImages([]); // clear images
      } else {
        res = await batchAPI.digitalBatchCheck({ key_id: selectedKey.id, students });
        setCsvFile(null);
        setStudents([]);
      }
      
      setBatchResult(res);
      usageAPI.getUsage().then(data => setUsage({ used: data.used || 0, limit: data.limit || 500 })).catch(() => {});
    } catch (err) {
      setError(err.message || 'Batch processing failed.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
      
      // Parse CSV assuming Row 1 is header (Student_ID, Q1, Q2)
      // And we look for where data starts
      const parsedStudents = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue; // blank row
        
        const qData = [];
        for (let q = 1; q < row.length; q++) {
           qData.push(row[q] ? String(row[q]).trim() : null);
        }
        
        parsedStudents.push({
           student_id: String(row[0]),
           answers: qData
        });
      }
      setStudents(parsedStudents);
    } catch (err) {
       setError("Could not parse CSV: " + err.message);
       setCsvFile(null);
    }
    if (csvRef.current) csvRef.current.value = '';
  }

  async function handleDownloadCsv() {
    if (!batchResult) return;
    try {
      await batchAPI.downloadBatchCsv({
        results: batchResult.results,
        key_name: selectedKey.name,
        batch_id: batchResult.batch_id,
      });
    } catch (err) {
      setError('Failed to download CSV: ' + err.message);
    }
  }

  return (
    <AppLayout>
      <div className="page-title">Batch Check</div>
      <div className="page-sub">Upload up to 50 answer sheets at once and download the combined results as a CSV.</div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {batchResult && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ background: 'var(--brand-light)', borderBottomColor: 'var(--brand-mid)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-dark)' }}>Batch Processing Complete</div>
                <div style={{ fontSize: 12, color: 'var(--brand-dark)' }}>Processed {batchResult.total_sheets} sheets in {batchResult.processing_ms}ms</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadCsv}>Download CSV</button>
            </div>
            <div className="card-body">
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-label">Success</div>
                  <div className="metric-val text-brand">{batchResult.ok}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Errors</div>
                  <div className="metric-val text-danger">{batchResult.errors}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Avg Percentage</div>
                  <div className="metric-val">{batchResult.avg_percentage}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Pass Rate</div>
                  <div className="metric-val">{batchResult.pass_rate}%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div style={{ fontWeight: 600 }}>Individual Results</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Student / File</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Score</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Grade</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.results.map((res, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{res.student_id || res.student_name || 'Anonymous'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{res.filename || 'digital-input'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 14 }}>{res.score} / {res.total}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{res.percentage}%</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                           <span className="plan-badge">{res.grade}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {res.id ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/result/${res.id}`)}>
                                →
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 440 }}>
        {/* Left: upload area */}
        <div style={{ padding: 28, borderRight: '1px solid var(--border)' }}>
          
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
             <button className={`btn ${mode === 'images' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setMode('images'); setBatchResult(null); }}>Folder Images</button>
             <button className={`btn ${mode === 'csv' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setMode('csv'); setBatchResult(null); }}>Student CSV File</button>
          </div>
          
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            {mode === 'images' ? `Upload answer sheets (${images.length} / 50)` : `Upload Student Answers CSV`}
          </div>

          {mode === 'images' ? (
            <>
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                style={{ padding: '30px 20px', marginBottom: 20 }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Drop multiple images here</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Or click to browse</div>
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              </div>

              {images.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 10 }}>
                  {images.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: i < images.length-1 ? '1px solid var(--surface2)' : 'none' }}>
                      <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{f.name}</span>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => removeImage(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`upload-zone`}
                style={{ padding: '30px 20px', marginBottom: 20 }}
                onClick={() => csvRef.current?.click()}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  {csvFile ? csvFile.name : `Drop student dataset here`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {students.length > 0 ? `${students.length} students loaded` : `Supported: .csv, .xlsx`}
                </div>
                <input ref={csvRef} type="file" accept=".csv, .xlsx" style={{ display: 'none' }} onChange={handleCsvUpload} />
              </div>
            </>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 20, fontSize: 14, padding: '11px 0' }}
            disabled={(mode === 'images' ? images.length === 0 : students.length === 0) || !selectedKey || processing}
            onClick={startBatchCheck}
          >
            {processing ? 'Processing batch...' : `Grade ${mode === 'images' ? images.length : students.length} records`}
          </button>
        </div>

        {/* Right: answer key selection */}
        <div style={{ padding: 22, background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Select answer key</div>
          {keys.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>No answer keys yet.</div>
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
              </div>
            ))
          )}

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>This month's usage</div>
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
