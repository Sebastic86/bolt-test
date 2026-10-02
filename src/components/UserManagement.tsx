import React, { useMemo, useState } from 'react';
import { Save, Shield, User, X } from 'lucide-react';
import {
  useAdminUserListQuery,
  useAdminUserProfilesQuery,
  useCreateUserProfileMutation,
  useDeleteUserProfileMutation,
  useUpdateUserRoleMutation,
} from '../queries/userProfiles';
import { ErrorState, LoadingState, Select } from './ui';

interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'normal' | null;
}

const UserManagement: React.FC = () => {
  const usersQuery = useAdminUserListQuery();
  const profilesQuery = useAdminUserProfilesQuery();
  const createProfile = useCreateUserProfileMutation();
  const updateRole = useUpdateUserRoleMutation();
  const deleteProfile = useDeleteUserProfileMutation();

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'admin' | 'normal'>('normal');
  const [error, setError] = useState<string | null>(null);

  const users: UserRow[] = useMemo(() => {
    const authUsers = usersQuery.data ?? [];
    const profiles = profilesQuery.data ?? [];
    return authUsers.map(u => ({
      id: u.id,
      email: u.email || 'No email',
      role: profiles.find(p => p.id === u.id)?.role ?? null,
    }));
  }, [usersQuery.data, profilesQuery.data]);

  const busy = createProfile.isPending || updateRole.isPending || deleteProfile.isPending;

  if (usersQuery.isLoading || profilesQuery.isLoading) return <LoadingState label="Loading users..." />;
  if (usersQuery.error) {
    return <ErrorState message="Unable to fetch users. Make sure you have admin privileges." />;
  }
  if (profilesQuery.error) {
    return <ErrorState message={profilesQuery.error instanceof Error ? profilesQuery.error.message : 'Failed to load user profiles'} />;
  }

  const handleEditRole = (user: UserRow) => {
    setEditingUserId(user.id);
    setEditingRole(user.role ?? 'normal');
    setError(null);
  };

  const handleSaveRole = (user: UserRow) => {
    const mutation = user.role ? updateRole : createProfile;
    mutation.mutate(
      { userId: user.id, role: editingRole },
      {
        onSuccess: () => setEditingUserId(null),
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update user role'),
      }
    );
  };

  const handleDeleteProfile = (user: UserRow) => {
    if (!window.confirm(`Are you sure you want to remove the profile for ${user.email}? This will revoke their access to the application.`)) return;
    deleteProfile.mutate(user.id, {
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to remove user profile'),
    });
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {users.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No users found.</p>
      ) : (
        <div className="space-y-2.5">
          {users.map(user => {
            const isEditing = editingUserId === user.id;
            return (
              <div key={user.id} className="border-2 border-(--color-ink) bg-white p-3">
                <div className="flex items-center gap-2.5">
                  {user.role === 'admin' ? (
                    <Shield className="h-4 w-4 flex-none text-red-600" />
                  ) : user.role === 'normal' ? (
                    <User className="h-4 w-4 flex-none text-blue-600" />
                  ) : (
                    <User className="h-4 w-4 flex-none text-gray-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-(--color-ink)">{user.email}</div>
                    <div className="truncate text-[11px] text-gray-400">ID: {user.id}</div>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <Select
                        value={editingRole}
                        onChange={e => setEditingRole(e.target.value as 'admin' | 'normal')}
                        disabled={busy}
                        className="h-9 flex-1"
                      >
                        <option value="normal">Normal User</option>
                        <option value="admin">Admin</option>
                      </Select>
                      <button
                        onClick={() => handleSaveRole(user)}
                        disabled={busy}
                        className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-mid) text-white disabled:opacity-50"
                        aria-label="Save role"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        disabled={busy}
                        className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink) disabled:opacity-50"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="border border-(--color-ink) bg-gray-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)">
                        {user.role ?? 'No role'}
                      </span>
                      <button
                        onClick={() => handleEditRole(user)}
                        disabled={busy}
                        className="border-2 border-(--color-ink) bg-white px-2.5 py-1 text-xs font-bold text-(--color-ink) disabled:opacity-50"
                      >
                        {user.role ? 'Edit' : 'Add Role'}
                      </button>
                      {user.role && (
                        <button
                          onClick={() => handleDeleteProfile(user)}
                          disabled={busy}
                          className="border-2 border-red-600 bg-white px-2.5 py-1 text-xs font-bold text-red-600 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 border-2 border-blue-200 bg-blue-50 p-3">
        <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-blue-800">Instructions</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>&bull; Users must sign up first before assigning roles</li>
          <li>&bull; Admins can manage teams, matches, and users</li>
          <li>&bull; Normal users have read-only access plus adding matches</li>
          <li>&bull; Users without roles cannot access the app</li>
        </ul>
      </div>
    </div>
  );
};

export default UserManagement;
