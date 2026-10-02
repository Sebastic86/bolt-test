/** Fake accounts for mock mode. Pick one with the MOCK panel or `?mockRole=admin|normal|none|out`. */
export const MOCK_USERS = {
  admin: { id: '00000000-0000-4000-8000-00000000a001', email: 'admin@mock.local' },
  normal: { id: '00000000-0000-4000-8000-00000000a002', email: 'player@mock.local' },
  /** Signed in but without a user_profiles row ("Account Setup Required"). */
  none: { id: '00000000-0000-4000-8000-00000000a003', email: 'norole@mock.local' },
} as const;

export type MockRole = keyof typeof MOCK_USERS | 'out';

const ROLE_KEY = 'mockRole';
const ROLES: MockRole[] = ['admin', 'normal', 'none', 'out'];

export function getMockRole(): MockRole {
  const fromUrl = new URLSearchParams(location.search).get('mockRole') as MockRole | null;
  if (fromUrl && ROLES.includes(fromUrl)) {
    sessionStorage.setItem(ROLE_KEY, fromUrl);
    return fromUrl;
  }
  const stored = sessionStorage.getItem(ROLE_KEY) as MockRole | null;
  return stored && ROLES.includes(stored) ? stored : 'admin';
}

/** Per tab (sessionStorage), so two tabs can be two different people. */
export function setMockRole(role: MockRole) {
  sessionStorage.setItem(ROLE_KEY, role);
}

export const MOCK_ROLES = ROLES;
