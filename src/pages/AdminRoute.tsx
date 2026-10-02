import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminPage from '../components/AdminPage';

// Route guard: redirects non-admins to the dashboard instead of silently
// rendering nothing (the old app's <AdminOnly> wrapper did the latter).
export default function AdminRoute() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <AdminPage />;
}
