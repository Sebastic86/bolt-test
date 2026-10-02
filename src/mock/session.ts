import { getTable } from './db';
import { getMockRole, MOCK_USERS } from './users';

/** The signed-in mock user's id, or null when signed out (anon). */
export function currentUserId(): string | null {
  const role = getMockRole();
  return role === 'out' ? null : MOCK_USERS[role].id;
}

export function hasProfile(): boolean {
  const uid = currentUserId();
  return !!uid && getTable('user_profiles').some(p => p.id === uid);
}

export function isAdmin(): boolean {
  const uid = currentUserId();
  return !!uid && getTable('user_profiles').some(p => p.id === uid && p.role === 'admin');
}

export function currentUser() {
  const role = getMockRole();
  if (role === 'out') return null;
  const { id, email } = MOCK_USERS[role];
  return {
    id,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2025-01-01T00:00:00.000Z',
  };
}
