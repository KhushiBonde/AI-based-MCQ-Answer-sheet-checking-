import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { studentsAPI, classesAPI } from '../api';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('class_id');
  
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newName, setNewName] = useState('');
  const [newRoll, setNewRoll] = useState('');
  const [selectedClass, setSelectedClass] = useState(classIdParam || '');

  useEffect(() => {
    fetchData();
  }, [classIdParam]);

  async function fetchData() {
    setLoading(true);
    try {
      const [sData, cData] = await Promise.all([
        studentsAPI.list(classIdParam),
        classesAPI.list()
      ]);
      setStudents(sData);
      setClasses(cData);
      if (classIdParam) setSelectedClass(classIdParam);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const student = await studentsAPI.create({
        name: newName,
        roll_number: newRoll,
        class_id: selectedClass || null
      });
      setStudents([...students, student]);
      setNewName(''); setNewRoll('');
      toast.success('Student added!');
    } catch (err) {
      toast.error('Failed to add student');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure?')) return;
    try {
      await studentsAPI.delete(id);
      setStudents(students.filter(s => s.id !== id));
      toast.success('Student removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="page-title">Students</div>
          <div className="page-sub">Manage your student roster and roll numbers.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        
        {/* Add Student Sidebar */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header"><div style={{ fontWeight: 600 }}>Add Student</div></div>
          <div className="card-body">
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="input-label">Full Name</label>
                <input type="text" className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
              </div>
              <div className="form-group">
                <label className="input-label">Roll Number (Optional)</label>
                <input type="text" className="input" value={newRoll} onChange={e => setNewRoll(e.target.value)} placeholder="e.g. 21CS01" />
              </div>
              <div className="form-group">
                <label className="input-label">Class</label>
                <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                    <option value="">No Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" type="submit">Add Student</button>
            </form>
          </div>
        </div>

        {/* Students List */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Roster {classIdParam && `(${classes.find(c => c.id === classIdParam)?.name})`}</div>
            {classIdParam && <button className="btn btn-sm" onClick={() => (window.location.href = '/students')}>Show All</button>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading students...</div>
            ) : students.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>No students found in this view.</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Roll #</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Class</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text3)' }}>{s.roll_number || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>
                            <span className="plan-badge" style={{ padding: '2px 8px' }}>{s.classes?.name || 'Unassigned'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
