import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldAlert, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

export const LoginPage: React.FC = () => {
  const { login, apiFetch } = useAuth();
  // Deliberately blank — a working product doesn't ship with a password in the box.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const showDemoAccounts =
    import.meta.env.VITE_ALLOW_DEMO_SEED !== 'false' &&
    (import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEMO_SEED === 'true');

  const demoAccounts = [
    { role: 'Owner', email: 'admin@clinic.com', pass: 'master123' },
    { role: 'Doctor', email: 'doctor@clinic.com', pass: 'doctor123' },
    { role: 'Reception', email: 'reception@clinic.com', pass: 'reception123' },
    { role: 'Nurse', email: 'nurse@clinic.com', pass: 'nurse123' },
    { role: 'Staff', email: 'staff@clinic.com', pass: 'staff123' },
    { role: 'Pharmacy', email: 'pharmacy@clinic.com', pass: 'pharmacy123' },
    { role: 'Accounts', email: 'account@clinic.com', pass: 'account123' },
    { role: 'RM', email: 'rm@clinic.com', pass: 'rm123' },
    { role: 'Platform admin', email: 'superadmin@clinic.com', pass: 'superadmin123' },
  ];

  const useDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setShowDemo(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'That email and password combination was not recognised');
      }

      login(data.accessToken, data.user);
    } catch (err: any) {
      setError(err.message || "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full pl-10 pr-3 py-2.5 rounded-md border border-border text-sm bg-surface-card text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-shadow';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] font-sans">
      {/* ---- Identity panel: who this belongs to, and what it runs ---- */}
      <aside className="relative bg-shell text-white px-8 py-10 lg:px-14 lg:py-16 flex flex-col justify-between overflow-hidden">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-24 w-full h-32 opacity-[0.14] text-brand-teal"
          preserveAspectRatio="none"
          viewBox="0 0 1200 120"
        >
          <path
            d="M0 60 H380 l14 -34 l16 68 l14 -34 h34 l10 -20 l12 40 l10 -20 H1200"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative">
          <BrandLogo variant="lockup" tone="onDark" className="h-16 lg:h-20" />
        </div>

        <div className="relative py-14 lg:py-0">
          <h1 className="font-display text-3xl lg:text-[2.6rem] font-semibold tracking-tight leading-[1.12] text-white max-w-[18ch]">
            One record, from the front desk to the ward.
          </h1>
          <p className="text-sm text-shell-muted mt-5 max-w-[46ch] leading-relaxed">
            Reception, consulting rooms, the ward, the pharmacy counter and accounts all work from the same patient
            record — so nothing is written twice and nothing is lost between desks.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-x-10 gap-y-4 pt-8 border-t border-shell-line">
          {[
            ['OPD & IPD', 'Day books and ward'],
            ['Pharmacy', 'Stock and dispensing'],
            ['Accounts', 'Billing and GST'],
          ].map(([title, sub]) => (
            <div key={title}>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-[11px] text-shell-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* ---- Sign-in ---- */}
      <main className="bg-surface-page flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-primary">Sign in</h2>
            <p className="text-sm text-ink-secondary mt-1.5">
              Use the account your clinic administrator set up for you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-start gap-2"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-ink-secondary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-3" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-ink-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-3" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-2.5 p-1 rounded text-ink-faint hover:text-ink-secondary cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts stay available but tucked away — they are scaffolding,
              not something a real user should have to look at. */}
          {showDemoAccounts && (
            <div className="mt-8 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-ink-secondary hover:text-ink-primary cursor-pointer"
                aria-expanded={showDemo}
              >
                <span className="font-medium">Demo accounts</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDemo ? 'rotate-180' : ''}`} />
              </button>

              {showDemo && (
                <div className="mt-3 border border-border rounded-md overflow-hidden divide-y divide-border/60 bg-surface-card">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => useDemoAccount(acc.email, acc.pass)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-page transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-medium text-ink-primary">{acc.role}</span>
                      <span className="text-[11px] font-mono text-ink-faint truncate">{acc.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-ink-faint mt-8 text-center">
            Forgotten your password? Ask your clinic administrator to reset it.
          </p>
        </div>
      </main>
    </div>
  );
};
