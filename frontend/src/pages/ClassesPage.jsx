import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { classesAPI, studentsAPI } from '../api';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    try {
      const data = await classesAPI.list();
      setClasses(data);
    } catch (err) {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    try {
      const newClass = await classesAPI.create(newClassName);
      setClasses([...classes, newClass]);
      setNewClassName('');
      toast.success('Class created!');
    } catch (err) {
      toast.error('Failed to create class');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure? This will unassign students from this class.')) return;
    try {
      await classesAPI.delete(id);
      setClasses(classes.filter(c => c.id !== id));
      toast.success('Class deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div className="page-title">Classes</div>
          <div className="page-sub">Manage your sections and student groups.</div>
        </div>
        
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input 
            type="text" 
            className="input" 
            placeholder="e.g. 10-A" 
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            style={{ width: 200 }}
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Adding...' : 'Add Class'}
          </button>
        </form>
      </div>

      <div className="grid-container">
        {loading ? (
             <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading classes...</div>
        ) : classes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏫</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>No classes yet</div>
                <div style={{ color: 'var(--text3)', marginTop: 8 }}>Create your first class to organize your students.</div>
            </div>
        ) : classes.map(cls => (
          <div className="card" key={cls.id}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(`/students?class_id=${cls.id}`)}>
                {cls.name}
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => handleDelete(cls.id)}
                style={{ color: 'var(--danger)' }}
              >
                Delete
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  View students
               </div>
               <button className="btn btn-sm" onClick={() => navigate(`/students?class_id=${cls.id}`)}>
                 Open
               </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
