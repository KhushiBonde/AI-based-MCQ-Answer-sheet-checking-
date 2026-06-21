import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { checkAPI, gradeColor, formatDate } from '../api';
import AppLayout from '../components/AppLayout';

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E'];

function GradeBadge({ grade }) {
  return (
    <div className="grade-badge" style={{ background: gradeColor(grade) }}>{grade}</div>
  );
}

export default function ResultPage() {
  const { id }                  = useParams();
  const location                = useLocation();
  const navigate                = useNavigate();
  const [result, setResult]     = useState(location.state?.result || null);
  const [loading, setLoading]   = useState(!result);
  const [error, setError]       = useState('');
  const [override, setOverride] = useState(null); // { qIdx, newAnswer }
  const [toast, setToast]       = useState('');

  useEffect(() => {
    if (!result && id) {
      checkAPI.getResult(id)
        .then(setResult)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleWhatsApp() {
    const text = `I graded an exam using Markix! 🚀\nScore: ${result.correct}/${result.total} (${result.percentage?.toFixed(1)}%)\nGrade: ${result.grade}\nKey: ${result.key_name || 'N/A'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function handleShare() {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Link copied to clipboard');
  }

  async function handleDownloadPDF() {
    try {
      showToast('Preparing PDF...');
      const filename = `Markix_Result_${result.key_name ? result.key_name.replace(/\\s+/g, '_') : 'OMR'}.pdf`;
      await checkAPI.downloadPDF(id, filename);
    } catch (e) {
      showToast('Error downloading PDF: ' + e.message);
    }
  }

  function handleCheckNext() {
    navigate('/check');
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        </div>
      </AppLayout>
    );
  }

  if (error || !result) {
    return (
      <AppLayout>
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <div className="empty-title">Result not found</div>
          <div className="empty-sub">{error || 'This result may have been deleted.'}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/check')}>
            Check a new sheet
          </button>
        </div>
      </AppLayout>
    );
  }

  const { score, total, correct, wrong, unattempted, percentage, grade, confidence, per_question, sections } = result;

  return (
    <AppLayout>
      <div className="card">
        {/* Topbar */}
        <div className="card-header">
          <div className="topbar-left">
            <span className="brand-pill">Markix</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Result — {result.student_name ? <strong>{result.student_name}</strong> : 'Anonymous Student'} — {result.key_name || 'Answer Key'}
            </span>
          </div>
          <div className="topbar-right">
            <button className="btn btn-sm btn-ghost" onClick={handleWhatsApp} title="Share on WhatsApp">
               <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.031c0 2.122.541 4.191 1.572 6.014L0 24l6.101-1.6c1.801.98 3.843 1.498 5.922 1.5h.005c6.634 0 12.032-5.394 12.05-12.033a11.85 11.85 0 00-3.526-8.498"/></svg>
            </button>
            <button className="btn btn-sm" onClick={handleShare}>Share Link</button>
            <button className="btn btn-sm" onClick={handleDownloadPDF}>Download PDF</button>
            <button className="btn btn-primary btn-sm" onClick={handleCheckNext}>Check next sheet</button>
          </div>
        </div>

        {/* Score banner */}
        <div className="result-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="score-num">{correct}</span>
              <span className="score-den">/ {total}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip chip-correct">{correct} correct</span>
              <span className="chip chip-wrong">{wrong} wrong</span>
              <span className="chip chip-skip">{unattempted} skipped</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <GradeBadge grade={grade} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{percentage?.toFixed(1)}%</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px' }}>
          {/* Left: question grid */}
          <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border)' }}>
            {/* Annotated image */}
            {result.annotated_image_url && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Graded sheet</div>
                <img
                  src={result.annotated_image_url}
                  alt="Annotated answer sheet"
                  style={{
                    width: '100%',
                    maxHeight: 320,
                    objectFit: 'contain',
                    borderRadius: 'var(--r-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                />
              </div>
            )}

            <div className="section-label" style={{ marginBottom: 14 }}>Question breakdown</div>
            <div className="q-grid">
              {(per_question || []).map((q, i) => {
                const state = q.correct ? 'correct' : q.student_answer === null ? 'skip' : 'wrong';
                const label = q.student_answer !== null ? ANSWER_LABELS[q.student_answer] : '—';
                return (
                  <div key={i} className={`q-cell ${state}`} title={q.correct ? 'Correct' : q.student_answer === null ? 'Unattempted' : `Wrong (correct: ${ANSWER_LABELS[q.correct_answer]})`}>
                    <div className="q-num">Q{i + 1}</div>
                    <div className="q-ans">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: sections + confidence */}
          <div style={{ padding: 20 }}>
            {sections && sections.length > 0 && (
              <>
                <div className="section-label" style={{ marginBottom: 10 }}>Score by section</div>
                {sections.map((s, i) => (
                  <div key={i} className="bar-row">
                    <div className="bar-label">{s.name}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${(s.correct / s.total) * 100}%`,
                        background: s.correct / s.total >= .75 ? 'var(--brand)' : s.correct / s.total >= .5 ? 'var(--warn)' : 'var(--danger)',
                      }} />
                    </div>
                    <div className="bar-val">{s.correct}/{s.total}</div>
                  </div>
                ))}
                <div className="divider" />
              </>
            )}

            <div className="section-label" style={{ marginBottom: 8 }}>Confidence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div className="bar-track" style={{ flex: 1 }}>
                <div className="bar-fill" style={{ width: `${confidence || 0}%`, background: 'var(--brand)' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono', minWidth: 32 }}>
                {confidence || 0}%
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {confidence >= 90 ? 'High confidence — clear photo, all bubbles detected.' :
               confidence >= 70 ? 'Medium confidence — some bubbles unclear.' :
               'Low confidence — consider retaking with better lighting.'}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast toast-success">{toast}</div>}
    </AppLayout>
  );
}
