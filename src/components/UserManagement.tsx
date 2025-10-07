import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { Users, Shield, User, RefreshCw, Save, X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserWithProfile {
  id: string;
  email: string;
  profile: UserProfile | null;
}

const UserManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'admin' | 'normal'>('normal');
  const [saving, setSaving] = useState(false);

  // Don't render if not admin
  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-red-800 mb-2">
          Access Denied
        </h2>
        <p className="text-sm text-red-700">
          You don't have permission to access user management. Administrator access is required.
        </p>
      </div>
    );
  }

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all users using the admin_list_users function
      const { data: authUsers, error: authError } = await supabase.rpc('admin_list_users');
      
      if (authError) {
        throw new Error('Unable to fetch users. Make sure you have admin privileges.');
      }

      // Fetch all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');

      if (profilesError) {
        throw profilesError;
      }

      // Combine auth users with their profiles
      const usersWithProfiles: UserWithProfile[] = (authUsers || []).map(user => ({
        id: user.id,
        email: user.email || 'No email',
        profile: profiles?.find(p => p.id === user.id) || null,
      }));

      setUsers(usersWithProfiles);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditRole = (userId: string, currentRole: 'admin' | 'normal' | null) => {
    setEditingUserId(userId);
    setEditingRole(currentRole || 'normal');
  };

  const handleSaveRole = async (userId: string) => {
    setSaving(true);
    try {
      const userProfile = users.find(u => u.id === userId)?.profile;
      
      if (userProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('user_profiles')
          .update({ role: editingRole, updated_at: new Date().toISOString() })
          .eq('id', userId);
        
        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('user_profiles')
          .insert({ id: userId, role: editingRole });
        
        if (error) throw error;
      }

      // Refresh users list
      await fetchUsers();
      setEditingUserId(null);
    } catch (err: any) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  const handleDeleteProfile = async (userId: string, userEmail: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove the profile for ${userEmail}? This will revoke their access to the application.`
    );
    
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      await fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user profile:', err);
      alert('Failed to delete user profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-medium mr-2" />
          <span>Loading users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-6 h-6 text-brand-dark" />
          <h2 className="text-2xl font-semibold text-gray-700">User Management</h2>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading || saving}
          className="p-2 text-gray-500 hover:text-brand-dark disabled:opacity-50"
          title="Refresh users"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {users.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No users found.</p>
      ) : (
        <div className="space-y-4">
          {users.map(user => (
            <div key={user.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {user.profile?.role === 'admin' ? (
                      <Shield className="w-5 h-5 text-red-600" />
                    ) : user.profile?.role === 'normal' ? (
                      <User className="w-5 h-5 text-blue-600" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.email}</p>
                    <p className="text-sm text-gray-500">ID: {user.id}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {editingUserId === user.id ? (
                    <>
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value as 'admin' | 'normal')}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                        disabled={saving}
                      >
                        <option value="normal">Normal User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleSaveRole(user.id)}
                        disabled={saving}
                        className="p-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        title="Save role"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="p-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.profile?.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : user.profile?.role === 'normal'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.profile?.role || 'No Role'}
                      </span>
                      <button
                        onClick={() => handleEditRole(user.id, user.profile?.role || null)}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50"
                      >
                        {user.profile ? 'Edit Role' : 'Add Role'}
                      </button>
                      {user.profile && (
                        <button
                          onClick={() => handleDeleteProfile(user.id, user.email)}
                          disabled={saving}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-medium text-blue-800 mb-2">Instructions:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Users must sign up through the application first before you can assign roles</li>
          <li>• Admin users can manage teams, matches, and other users</li>
          <li>• Normal users have read-only access to the application</li>
          <li>• Users without roles cannot access the application</li>
        </ul>
      </div>
    </div>
  );
};

export default UserManagement;