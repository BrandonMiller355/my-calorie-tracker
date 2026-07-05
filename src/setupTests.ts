import '@testing-library/jest-dom/vitest';

// src/lib/supabase.ts reads these at import time and throws when missing.
// Stub them so tests never depend on (or accidentally use) .env.local values.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
