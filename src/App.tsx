import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AllMatchesPage from './pages/AllMatchesPage';
import AdminRoute from './pages/AdminRoute';
import { LoadingState } from './components/ui';

const NightPage = lazy(() => import('./pages/NightPage'));

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="matches" element={<AllMatchesPage />} />
        <Route
          path="night"
          element={
            <Suspense fallback={<LoadingState label="Loading game night..." />}>
              <NightPage />
            </Suspense>
          }
        />
        <Route path="admin" element={<AdminRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
