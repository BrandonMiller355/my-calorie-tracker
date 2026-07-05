import { useMemo } from 'react';
import App from './App';
import { LoginScreen } from './screens/LoginScreen';
import { useAuth } from './state/AuthProvider';
import { createRepository } from './storage';

export function AuthGate() {
  const { session, restoring } = useAuth();
  // Keyed on the user, not the session object, so token refreshes don't
  // recreate the repository (which would refetch everything).
  const userId = session?.user.id ?? null;
  const repository = useMemo(() => (userId ? createRepository() : null), [userId]);

  if (restoring) return <p className="loading">Loading…</p>;
  if (!repository) return <LoginScreen />;
  return <App repository={repository} />;
}
