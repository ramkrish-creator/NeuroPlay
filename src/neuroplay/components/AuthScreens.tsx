import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn } from 'lucide-react';

export function LoginScreen({ onLogin, error }: {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Sign in to NeuroPlay" subtitle="Use the username and password provided to you.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="np-label">Username</span>
          <input className="np-input mt-1.5" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="block">
          <span className="np-label">Password</span>
          <input className="np-input mt-1.5" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button className="np-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" disabled={submitting}>
          <LogIn size={16} /> {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}

export function PasswordChangeScreen({ onChangePassword, error }: {
  onChangePassword: (password: string) => Promise<void>;
  error: string | null;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mismatch = confirmation.length > 0 && password !== confirmation;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation || password.length < 12) return;
    setSubmitting(true);
    try {
      await onChangePassword(password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" subtitle="For your security, change your temporary password before continuing.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="np-label">New password</span>
          <input className="np-input mt-1.5" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="block">
          <span className="np-label">Confirm new password</span>
          <input className="np-input mt-1.5" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <p className={`text-xs ${mismatch ? 'text-rose-300' : 'text-slate-400'}`}>
          {mismatch ? 'Passwords do not match.' : 'Use at least 12 characters.'}
        </p>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button className="np-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" disabled={submitting || password.length < 12 || password !== confirmation}>
          <KeyRound size={16} /> {submitting ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    </AuthCard>
  );
}

function AuthCard({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex items-center justify-center p-6 my-auto">
      <div className="np-card max-w-lg w-full p-8 md:p-10 shadow-2xl border border-slate-700/60">
        <p className="text-sm uppercase tracking-widest text-teal-400 font-semibold mb-1">NeuroPlay</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mb-2 font-display">{title}</h1>
        <p className="text-slate-400 mb-6 text-sm">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
