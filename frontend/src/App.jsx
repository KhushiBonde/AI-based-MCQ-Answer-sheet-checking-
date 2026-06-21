import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage     from './pages/LoginPage';
import LandingPage   from './pages/LandingPage';
import DemoPage      from './pages/DemoPage';
import CheckPage     from './pages/CheckPage';
import ResultPage    from './pages/ResultPage';
import KeysPage      from './pages/KeysPage';
import BatchPage     from './pages/BatchPage';
import HistoryPage   from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GeneratorPage from './pages/GeneratorPage';
import SettingsPage  from './pages/SettingsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ClassesPage   from './pages/ClassesPage';
import StudentsPage  from './pages/StudentsPage';

import { I18nProvider } from './context/I18nContext';

// ── Protected route wrapper ───────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── App shell ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <I18nProvider>
          <Routes>
            {/* Public */}
            <Route path="/"      element={<LandingPage />} />
            <Route path="/demo"  element={<DemoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected */}
            <Route path="/check"        element={<PrivateRoute><CheckPage /></PrivateRoute>} />
            <Route path="/result/:id"   element={<PrivateRoute><ResultPage /></PrivateRoute>} />
            <Route path="/keys"         element={<PrivateRoute><KeysPage /></PrivateRoute>} />
            <Route path="/keys/new"     element={<PrivateRoute><KeysPage createOnMount /></PrivateRoute>} />
            <Route path="/batch"        element={<PrivateRoute><BatchPage /></PrivateRoute>} />
            <Route path="/history"      element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
            <Route path="/analytics"    element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
            <Route path="/generator"    element={<PrivateRoute><GeneratorPage /></PrivateRoute>} />
            <Route path="/settings"     element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/classes"      element={<PrivateRoute><ClassesPage /></PrivateRoute>} />
            <Route path="/students"     element={<PrivateRoute><StudentsPage /></PrivateRoute>} />
            <Route path="/dashboard"    element={<Navigate to="/check" replace />} />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
