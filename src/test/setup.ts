import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// src/lib/supabaseClient.ts throws at import time if these are missing, and
// any test that transitively imports a component pulling in supabaseClient
// (directly or via a hook/service) needs them stubbed before that happens.
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
