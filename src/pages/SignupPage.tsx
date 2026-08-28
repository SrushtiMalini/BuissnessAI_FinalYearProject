import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { authClient } from '../lib/authClient';
import { hydrate } from '../lib/storage';
import { Button } from '../components/ui';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('All fields are required');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const auth = await authClient.signup(form.name, form.email, form.password);
      authClient.saveSession(auth);
      await hydrate();
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Signup failed');
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
          <p className="text-white/50 mt-2">Create your restaurant account</p>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-6">
          <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Get started</h2>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)]" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Restaurant Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Shyam Dhaba"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@restaurant.com"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--color-text-secondary)] text-sm mb-1">Confirm Password *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Re-enter password"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]"
                required
              />
            </div>
            <Button type="submit" size="lg" loading={loading} className="w-full justify-center mt-2">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-white/50 text-sm mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-sunburst)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
