import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/AuthProvider';

/**
 * Single-user deployment: accounts are provisioned in the Supabase dashboard
 * and public signups are disabled there, so this screen deliberately has no
 * sign-up or password-reset path.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
    // On success the auth state change swaps this screen out for the app.
  }

  return (
    <div className="login-screen">
      <h1>Cal Tracker</h1>
      <form className="goals-form login-form" onSubmit={handleSubmit} aria-label="Sign in">
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
