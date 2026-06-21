import { useState, useEffect } from 'react';
import { checkAPI, classesAPI } from '../api';
import AppLayout from '../components/AppLayout';

const BRAND_COLORS = ['#059669','#1A56DB','#7C3AED','#D97706','#DC2626'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState([]);
  const [allResults, setAllResults] = useState([]);

  useEffect(() => {
    Promise.all([
        checkAPI.listResults(),
        classesAPI.list()
    ]).then(([resData, clsData]) => {
        setAllResults(resData || []);
        setClasses(clsData || []);
    }).catch(err => {
        console.error(err);
    }).finally(() => setLoading(false));
  }, []);

  const filteredByClass = selectedClass === 'all'
    ? allResults
    : allResults.filter(r => r.class_id === selectedClass);

  const keyGroups = filteredByClass.reduce((acc, r) => {
    const k = r.key_name || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  const displayResults = selectedKey === 'all'
    ? filteredByClass
    : (keyGroups[selectedKey] || []);

  // Compute stats
  const count     = displayResults.length;
  const avgPct    = count ? Math.round(displayResults.reduce((s, r) => s + (r.percentage || 0), 0) / count) : 0;
  const maxPct    = count ? Math.max(...displayResults.map(r => r.percentage || 0)) : 0;
  const minPct    = count ? Math.min(...displayResults.map(r => r.percentage || 0)) : 0;
  const passRate  = count ? Math.round((displayResults.filter(r => (r.percentage || 0) >= 50).length / count) * 100) : 0;

  // Per-question correct rates (if same total)
  const numQ = displayResults[0]?.total || 20;
  const perQCounts = Array(numQ).fill(0);
  displayResults.forEach(r => {
    if (r.per_question) {
      r.per_question.forEach((q, i) => {
        if (i < numQ && q.correct) perQCounts[i]++;
      });
    }
  });
  const perQRates = count > 0 ? perQCounts.map(c => Math.round((c / count) * 100)) : Array(numQ).fill(70);

  // Weak questions
  const weakQ = perQRates
    .map((rate, i) => ({ q: i + 1, rate }))
    .filter(({ rate }) => rate < 60)
    .sort((a, b) => a.rate - b.rate);

  function barColor(rate) {
    if (rate >= 75) return 'var(--brand)';
    if (rate >= 50) return 'var(--warn)';
    return 'var(--danger)';
  }

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Key Name', 'Percentage', 'Total Correct', 'Total Questions'];
    const rows = displayResults.map(r => [
      r.student_name || 'Unknown',
      r.key_name || 'N/A',
      r.percentage || 0,
      r.correct || 0,
      r.total || 0
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${selectedKey}.csv`);
    link.click();
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Class performance insights across all checked sheets.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="input"
            style={{ width: 140 }}
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="all">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 160 }}
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
          >
            <option value="all">All exams</option>
            {Object.keys(keyGroups).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={handleExportCSV}>Export CSV</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : count === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No data yet</div>
          <div className="empty-sub">Check some sheets first to see class analytics.</div>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Class average</div>
              <div className="metric-val" style={{ color: 'var(--brand)' }}>{avgPct}%</div>
              <div className="metric-sub">{count} students</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Highest score</div>
              <div className="metric-val">{maxPct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Lowest score</div>
              <div className="metric-val" style={{ color: 'var(--danger)' }}>{minPct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pass rate (≥50%)</div>
              <div className="metric-val" style={{ color: passRate >= 70 ? 'var(--brand)' : 'var(--warn)' }}>{passRate}%</div>
              <div className="metric-sub">{Math.round(count * passRate / 100)} of {count} students</div>
            </div>
          </div>

          {/* Per-question chart */}
          <div className="chart-area">
            <div className="chart-title">Correct rate per question (%)</div>
            <div className="bar-chart">
              {perQRates.map((rate, i) => (
                <div
                  key={i}
                  className="bc-bar"
                  style={{ height: `${rate}%`, background: barColor(rate) }}
                  title={`Q${i+1}: ${rate}%`}
                />
              ))}
            </div>
            <div className="bc-labels">
              {perQRates.map((_, i) => (
                <div key={i} className="bc-lbl">Q{i+1}</div>
              ))}
            </div>
          </div>

          {/* Weak questions */}
          {weakQ.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Questions needing re-teaching
              </div>
              <div className="card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Correct rate</th>
                      <th>Difficulty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weakQ.map(({ q, rate }) => (
                      <tr key={q}>
                        <td style={{ fontWeight: 500 }}>Q{q}</td>
                        <td className="mono">{rate}%</td>
                        <td>
                          <div style={{
                            display: 'inline-block',
                            height: 5,
                            width: `${rate}%`,
                            maxWidth: 120,
                            background: barColor(rate),
                            borderRadius: 3,
                            verticalAlign: 'middle',
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}
