import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from './AuthGate';
import { AuthProvider } from './state/AuthProvider';

type AuthListener = (event: string, session: Session | null) => void;

const mockAuth = vi.hoisted(() => ({
  session: null as Session | null,
  listeners: [] as Array<(event: string, session: Session | null) => void>,
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mockAuth.session } }),
      onAuthStateChange: (cb: AuthListener) => {
        mockAuth.listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: mockAuth.signInWithPassword,
      signOut: mockAuth.signOut,
    },
    // Enough of the PostgREST builder for AppProvider's initial loads: select/eq
    // chain (awaited directly for entries, or via maybeSingle for goals).
    from: () => {
      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        maybeSingle: () => Promise<{ data: null; error: null }>;
        then: (resolve: (result: { data: unknown[]; error: null }) => void) => void;
      } = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return builder;
    },
    // AppProvider also loads the weekly deficit summary via RPC on mount.
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

const fakeSession = { user: { id: 'user-1' } } as unknown as Session;

function renderGate() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockAuth.session = null;
  mockAuth.listeners.length = 0;
  mockAuth.signInWithPassword.mockReset();
});

describe('AuthGate', () => {
  it('shows only the login screen when there is no session', async () => {
    renderGate();
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Breakfast' })).toBeNull();
    // No signup path is offered
    expect(screen.queryByText(/sign up/i)).toBeNull();
  });

  it('renders the app without a login prompt when a session exists', async () => {
    mockAuth.session = fakeSession;
    renderGate();
    expect(await screen.findByRole('region', { name: 'Breakfast' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Sign in' })).toBeNull();
  });

  it('shows an error and stays on login for invalid credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    renderGate();

    const form = await screen.findByRole('form', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('swaps to the app after a successful sign-in', async () => {
    mockAuth.signInWithPassword.mockImplementation(async () => {
      // Supabase emits SIGNED_IN through onAuthStateChange after a login
      for (const cb of mockAuth.listeners) cb('SIGNED_IN', fakeSession);
      return { data: { session: fakeSession }, error: null };
    });
    renderGate();

    const form = await screen.findByRole('form', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'right' } });
    fireEvent.submit(form);

    expect(await screen.findByRole('region', { name: 'Breakfast' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Sign in' })).toBeNull();
  });
});
