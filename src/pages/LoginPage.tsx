import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { authClient } from '../lib/authClient';
import { Button } from '../components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const auth = await authClient.login(email, password);
      authClient.saveSession(auth);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg-sidebar)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-[var(--color-unity)]/20">
            <ChefHat size={32} style={{ color: 'var(--color-sunburst)' }} />
          </div>
          <h1 className="text-[var(--color-text-inverse)] text-3xl font-semibold">BusinessIQ</h1>
          <p className="text-white/50 mt-2">Log in to your restaurant account</p>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-6">
          <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Welcome back</h2>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)]" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <Button type="submit" size="lg" loading={loading} className="w-full justify-center mt-2">
              Log In
            </Button>
          </form>
        </div>

        <p className="text-center text-white/50 text-sm mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[var(--color-sunburst)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
