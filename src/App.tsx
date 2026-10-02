import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AllMatchesPage from './pages/AllMatchesPage';
import AdminRoute from './pages/AdminRoute';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="matches" element={<AllMatchesPage />} />
        <Route path="admin" element={<AdminRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
