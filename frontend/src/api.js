// API base URL — reads from env at build time (Vite convention)
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import axios from 'axios';

// ── Auth helpers ─────────────────────────────────────────────────────────────

export const TOKEN_KEY   = 'ag_access_token';
export const REFRESH_KEY = 'ag_refresh_token';
export const USER_KEY    = 'ag_user';

export function getToken()   { return localStorage.getItem(TOKEN_KEY); }
export function getUser()    { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; }

export function setSession(data) {
  localStorage.setItem(TOKEN_KEY,   data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(USER_KEY,    JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    // If unauthorized, attempt to refresh token
    if (res.status === 401 && path !== '/api/auth/refresh') {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setSession(data);
            
            // Retry the original request with new token
            const retryHeaders = {
              ...headers,
              'Authorization': `Bearer ${data.access_token}`,
            };
            const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
            if (retryRes.ok) return retryRes.json();
          }
        } catch (err) {
          console.error("Token refresh failed:", err);
        }
      }

      // If refresh failed or no token, clear and redirect
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
         window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authAPI = {
  signup:        (email, password)  => apiFetch('/api/auth/signup',         { method: 'POST', body: JSON.stringify({ email, password }) }),
  signin:        (email, password)  => apiFetch('/api/auth/signin',         { method: 'POST', body: JSON.stringify({ email, password }) }),
  signout:       ()                 => apiFetch('/api/auth/signout',         { method: 'POST' }),
  resetPassword: (email)            => apiFetch('/api/auth/reset-password',  { method: 'POST', body: JSON.stringify({ email }) }),
  refresh:       (token)            => apiFetch('/api/auth/refresh',         { method: 'POST', body: JSON.stringify({ refresh_token: token }) }),
  updatePassword: (password)        => apiFetch('/api/auth/update-password', { method: 'POST', body: JSON.stringify({ new_password: password }) }),
  updateProfile:  (fullName)        => apiFetch('/api/auth/update-profile',  { method: 'POST', body: JSON.stringify({ full_name: fullName }) }),
  googleSignin: async () => {
    const res = await apiFetch('/api/auth/google');
    if (res.url) window.location.href = res.url;
  },
  resendVerification: (email)       => apiFetch('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
};

// ── Answer Keys API ───────────────────────────────────────────────────────────

export const keysAPI = {
  list:   ()             => apiFetch('/api/keys'),
  get:    (id)           => apiFetch(`/api/keys/${id}`),
  create: (data)         => apiFetch('/api/keys',        { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data)     => apiFetch(`/api/keys/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)           => apiFetch(`/api/keys/${id}`,  { method: 'DELETE' }),
  getShareCode: (id)     => apiFetch(`/api/keys/${id}/share`),
  importKey:    (code)   => apiFetch(`/api/keys/import?code=${code}`, { method: 'POST' }),
  scan:   async (imageFile, numQuestions = 20, choices = 4) => {
    const token = getToken();
    const form = new FormData();
    form.append('image', imageFile);
    const url = `${API_BASE}/api/keys/scan?num_questions=${numQuestions}&choices=${choices}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Scan failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

// ── OMR Check API ─────────────────────────────────────────────────────────────

export const checkAPI = {
  checkSheet: async (imageFile, keyId, studentName, studentId, classId, onProgress) => {
    const form = new FormData();
    form.append('image', imageFile);
    form.append('key_id', keyId);
    if (studentName) form.append('student_name', studentName);
    if (studentId) form.append('student_id', studentId);
    if (classId) form.append('class_id', classId);

    const token = getToken();
    try {
      const res = await axios.post(`${API_BASE}/api/check`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(pct);
          }
        }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || err.message || 'Check failed');
    }
  },

  getResult:   (id)  => apiFetch(`/api/results/${id}`),
  listResults: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/results${q ? '?' + q : ''}`);
  },
  downloadPDF: async (id, filename = 'Result.pdf') => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/results/${id}/pdf`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download PDF');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};

// ── Batch API ─────────────────────────────────────────────────────────────────

export const batchAPI = {
  batchCheck: async (imageFiles, keyId) => {
    const form = new FormData();
    for (const file of imageFiles) {
      form.append('images', file);
    }
    form.append('key_id', keyId);

    const token = getToken();
    const res = await fetch(`${API_BASE}/api/batch`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Batch check failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  digitalBatchCheck: async (payload) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/batch/digital`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Digital batch check failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  downloadBatchCsv: async (payload) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/batch/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${payload.batch_id || 'results'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

// ── Usage API ─────────────────────────────────────────────────────────────────

export const usageAPI = {
  getUsage: () => apiFetch('/api/usage'),
};

// ── Classes API ───────────────────────────────────────────────────────────────
export const classesAPI = {
  list:   ()         => apiFetch('/api/classes/'),
  create: (name)     => apiFetch('/api/classes/', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (id)       => apiFetch(`/api/classes/${id}`, { method: 'DELETE' }),
};

// ── Students API ──────────────────────────────────────────────────────────────
export const studentsAPI = {
  list:   (classId)     => apiFetch(`/api/students/${classId ? '?class_id=' + classId : ''}`),
  create: (student)     => apiFetch('/api/students/', { method: 'POST', body: JSON.stringify(student) }),
  delete: (id)          => apiFetch(`/api/students/${id}`, { method: 'DELETE' }),
};

// ── Utilities ─────────────────────────────────────────────────────────────────

export function getInitials(email = '') {
  if (!email) return 'U';
  const [local] = email.split('@');
  return local.slice(0, 2).toUpperCase();
}

export function gradeColor(grade) {
  if (grade === 'A+' || grade === 'A') return 'var(--brand)';
  if (grade === 'B')                    return '#059669';
  if (grade === 'C')                    return 'var(--warn)';
  if (grade === 'D')                    return '#EA580C';
  return 'var(--danger)';
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
