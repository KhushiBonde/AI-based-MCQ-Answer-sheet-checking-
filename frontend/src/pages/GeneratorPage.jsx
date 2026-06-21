import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { apiFetch } from '../api';
import toast from 'react-hot-toast';

export default function GeneratorPage() {
  const [config, setConfig] = useState({
    title: 'OMR Answer Sheet',
    schoolName: '',
    qCount: 50,
    choices: 4
  });
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        title: config.title,
        school_name: config.schoolName,
        q_count: config.qCount,
        choices: config.choices
      });

      // We use windows.location for direct download or fetch with blob
      const token = localStorage.getItem('token');
      const url = `http://127.0.0.1:8000/api/generator/omr?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Generation failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Markix_Sheet_${config.qCount}Q.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Sheet generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate sheet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Sheet Generator</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Create perfectly calibrated OMR sheets for your exams. Print them on standard A4 paper.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-24">
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>Configuration</h3>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Exam Title</label>
              <input 
                type="text" 
                className="form-input" 
                value={config.title}
                onChange={e => setConfig({...config, title: e.target.value})}
                placeholder="e.g. Mid-term Science"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">School Name (Optional)</label>
              <input 
                type="text" 
                className="form-input" 
                value={config.schoolName}
                onChange={e => setConfig({...config, schoolName: e.target.value})}
                placeholder="e.g.Public School"
              />
            </div>

            <div className="grid grid-cols-2 gap-16">
              <div className="form-group">
                <label className="form-label">Questions</label>
                <select 
                  className="form-select"
                  value={config.qCount}
                  onChange={e => setConfig({...config, qCount: parseInt(e.target.value)})}
                >
                  <option value={20}>20 Questions</option>
                  <option value={50}>50 Questions</option>
                  <option value={100}>100 Questions</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Choices</label>
                <select 
                  className="form-select"
                  value={config.choices}
                  onChange={e => setConfig({...config, choices: parseInt(e.target.value)})}
                >
                  <option value={4}>4 (A-D)</option>
                  <option value={5}>5 (A-E)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={handleDownload}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Download Printable PDF'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div className="card" style={{ padding: 24, background: '#F9FAFB', borderStyle: 'dashed' }}>
                <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Preview</h3>
                <div style={{ background: 'white', borderRadius: 8, height: 300, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: 20 }}>
                   <div style={{ height: 4, width: '40%', background: '#E5E7EB', marginBottom: 8, margin: '0 auto' }}></div>
                   <div style={{ height: 3, width: '25%', background: '#F3F4F6', marginBottom: 20, margin: '0 auto' }}></div>
                   
                   {[...Array(8)].map((_, i) => (
                     <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                        <div style={{ width: 10, fontSize: 6, color: '#9CA3AF' }}>{i+1}</div>
                        {[...Array(config.choices)].map((_, j) => (
                          <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #E5E7EB' }}></div>
                        ))}
                     </div>
                   ))}
                   <div style={{ flex: 1 }}></div>
                   <div style={{ height: 4, width: 4, background: 'black', position: 'absolute', bottom: 10, left: 10 }}></div>
                </div>
                <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Layout will be optimized for {config.qCount} questions.
                </p>
             </div>

             <div className="alert alert-info">
                <strong>Tip:</strong> Print on high-quality A4 paper for best OMR results. Ensure the corner marks are fully visible when scanning.
             </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
