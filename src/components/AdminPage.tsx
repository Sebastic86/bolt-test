import React, { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import TeamManagement from './TeamManagement';
import UserManagement from './UserManagement';

type AdminTab = 'teams' | 'users';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teams');

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <h1 className="mb-1 text-lg font-black uppercase tracking-wide text-(--color-ink)">Admin</h1>
      <p className="mb-4 text-xs text-gray-500">Manage teams and user roles.</p>

      <div className="mb-4 flex border-2 border-(--color-ink)">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide ${activeTab === 'teams' ? 'bg-(--color-ink) text-white' : 'bg-white text-gray-500'}`}
        >
          <Users className="h-4 w-4" /> Teams
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide ${activeTab === 'users' ? 'bg-(--color-ink) text-white' : 'bg-white text-gray-500'}`}
        >
          <Shield className="h-4 w-4" /> Users
        </button>
      </div>

      {activeTab === 'teams' ? <TeamManagement /> : <UserManagement />}
    </div>
  );
};

export default AdminPage;
