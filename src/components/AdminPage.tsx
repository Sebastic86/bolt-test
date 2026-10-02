import React, { Suspense, lazy, useState } from 'react';
import { Shield, Users, Wrench } from 'lucide-react';
import TeamManagement from './TeamManagement';
import UserManagement from './UserManagement';
import { LoadingState } from './ui';

// Admin-only tooling — split into its own chunk so regular users never download it.
const DevToolsPanel = lazy(() => import('./admin/DevToolsPanel'));

type AdminTab = 'teams' | 'users' | 'tools';

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'teams', label: 'Teams', icon: <Users className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Shield className="h-4 w-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" /> },
];

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teams');
  // Once opened, keep the tools panel mounted so a long run survives tab switches.
  const [toolsOpened, setToolsOpened] = useState(false);

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === 'tools') setToolsOpened(true);
  };

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <h1 className="mb-1 text-lg font-black uppercase tracking-wide text-(--color-ink)">Admin</h1>
      <p className="mb-4 text-xs text-gray-500">Manage teams, user roles and logo tooling.</p>

      <div className="mb-4 flex border-2 border-(--color-ink)">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide ${activeTab === tab.id ? 'bg-(--color-ink) text-white' : 'bg-white text-gray-500'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'teams' && <TeamManagement />}
      {activeTab === 'users' && <UserManagement />}
      {toolsOpened && (
        <div className={activeTab === 'tools' ? '' : 'hidden'}>
          <Suspense fallback={<LoadingState label="Loading dev tools..." />}>
            <DevToolsPanel />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
