import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAPI, formatDate } from '../api';
import AppLayout from '../components/AppLayout';

export default function HistoryPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const navigate              = useNavigate();

  useEffect(() => {
    checkAPI.listResults()
      .then(data => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = results.filter(r =>
    r.key_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.grade?.toLowerCase().includes(search.toLowerCase())
  );

  function gradeClass(g) {
    if (g === 'A+' || g === 'A') return 'badge-green';
    if (g === 'B') return 'badge-blue';
    if (g === 'C') return 'badge-amber';
    return 'badge-red';
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-title">History</div>
          <div className="page-sub">Your past answer sheet checks.</div>
        </div>
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Search by key name or grade…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">{search ? 'No matching results' : 'No checks yet'}</div>
          <div className="empty-sub">{search ? 'Try a different search term' : 'Upload and check a sheet to see it here.'}</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Answer key</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Confidence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/result/${r.id}`)}>
                  <td className="mono" style={{ color: 'var(--text3)' }}>{formatDate(r.created_at)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.student_name || '—'}</td>
                  <td style={{ fontWeight: 500 }}>{r.key_name}</td>
                  <td className="mono">{r.correct}/{r.total} ({r.percentage?.toFixed(0)}%)</td>
                  <td><span className={`badge ${gradeClass(r.grade)}`}>{r.grade}</span></td>
                  <td className="mono">{r.confidence}%</td>
                  <td>
                    <button className="btn btn-ghost btn-sm">View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
