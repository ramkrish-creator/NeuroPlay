import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { api, type LegacyImportCredential } from '../api/client';
import type { UserProfile } from '../types';

type LegacyState = {
  profiles?: Record<string, UserProfile>;
  profile?: UserProfile | null;
  activeUserId?: string | null;
  sessions?: unknown[];
  sessionsByUser?: Record<string, unknown[]>;
  difficultyByUser?: Record<string, Record<string, unknown>>;
};

function readLegacyProfiles(): unknown[] {
  const raw = localStorage.getItem('neuroplay-store');
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Saved browser profile data is unreadable.');
  const state = 'state' in parsed ? parsed.state as LegacyState : parsed as LegacyState;
  const profiles = state.profiles ?? (state.profile ? { [state.profile.id]: state.profile } : {});
  return Object.entries(profiles).map(([id, profile]) => ({
    profile: { ...profile, id: profile.id || id },
    sessions: state.sessionsByUser?.[id] ?? (id === state.activeUserId ? state.sessions ?? [] : []),
    difficulty: state.difficultyByUser?.[id],
  }));
}

const AGE_GROUPS: UserProfile['ageGroup'][] = ['18-39', '40-59', '60-74', '75+'];
const GOALS: { id: UserProfile['goal']; label: string }[] = [
  { id: 'memory', label: 'Improve Memory' },
  { id: 'attention', label: 'Improve Attention' },
  { id: 'overall', label: 'Improve Overall Cognition' },
];

export function PlayersPage() {
  const users = useNeuroPlayStore((s) => s.adminUsers);
  const loadUsers = useNeuroPlayStore((s) => s.loadAdminUsers);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageGroup, setAgeGroup] = useState<UserProfile['ageGroup']>('40-59');
  const [goal, setGoal] = useState<UserProfile['goal']>('overall');
  const [credentials, setCredentials] = useState<LegacyImportCredential | null>(null);
  const [importedCredentials, setImportedCredentials] = useState<LegacyImportCredential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const hasLegacyData = Boolean(localStorage.getItem('neuroplay-store'));

  useEffect(() => {
    loadUsers().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load users.'));
  }, [loadUsers]);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      const result = await api.createUser({ username, displayName, ageGroup, goal });
      setCredentials({ username: result.user.username, password: result.temporaryPassword, displayName: result.user.name });
      setShowForm(false);
      setUsername('');
      setDisplayName('');
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create user.');
    } finally {
      setWorking(false);
    }
  };

  const importLegacy = async () => {
    setError(null);
    setWorking(true);
    try {
      const profiles = readLegacyProfiles();
      if (profiles.length === 0) {
        setError('No saved browser profiles were found to import.');
        return;
      }
      if (!window.confirm(`Import ${profiles.length} saved profile(s) and their session history? Browser data will be kept as a backup.`)) return;
      const result = await api.importLegacyProfiles(profiles);
      setImportedCredentials(result.credentials);
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import saved profiles.');
    } finally {
      setWorking(false);
    }
  };

  const resetPassword = async (userId: string) => {
    setError(null);
    setWorking(true);
    try {
      setCredentials(await api.resetUserPassword(userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset the user password.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-fade-in text-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3 font-display">
            <Users className="text-teal-400" /> User Accounts
          </h1>
          <p className="text-slate-400 text-sm mt-1">Create accounts and migrate existing browser profiles.</p>
        </div>
        <button onClick={() => setShowForm((visible) => !visible)} className="np-btn-primary flex items-center gap-2">
          <UserPlus size={18} /> Add New User
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-950/60 p-4 text-sm text-rose-200">{error}</p>}

      {showForm && (
        <form onSubmit={createUser} className="np-card p-6 space-y-4">
          <h2 className="np-section-title">New user account</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="np-label">Username</span>
              <input className="np-input mt-1.5" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="block">
              <span className="np-label">Display name</span>
              <input className="np-input mt-1.5" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label className="block">
              <span className="np-label">Age group</span>
              <select className="np-input mt-1.5" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as UserProfile['ageGroup'])}>
                {AGE_GROUPS.map((age) => <option key={age}>{age}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="np-label">Training goal</span>
              <select className="np-input mt-1.5" value={goal} onChange={(event) => setGoal(event.target.value as UserProfile['goal'])}>
                {GOALS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-400">A unique temporary password will be generated and must be changed at first sign-in.</p>
          <button className="np-btn-primary disabled:opacity-60" disabled={working}>
            {working ? 'Creating…' : 'Create user'}
          </button>
        </form>
      )}

      {credentials && (
        <section className="np-card p-6 space-y-3 border-teal-500/30">
          <h2 className="np-section-title flex items-center gap-2"><KeyRound size={16} /> Temporary password — show once</h2>
          <p className="text-sm text-slate-300">Share these credentials securely with {credentials.displayName}; the password will not be shown again.</p>
          <div className="rounded-lg bg-slate-950 p-4 font-mono text-sm">
            <p>Username: {credentials.username}</p>
            <p>Password: {credentials.password}</p>
          </div>
          <button className="np-btn-secondary" onClick={() => setCredentials(null)}>Close</button>
        </section>
      )}

      {hasLegacyData && (
        <section className="np-card p-6 space-y-3">
          <h2 className="np-section-title">Import saved browser profiles</h2>
          <p className="text-sm text-slate-400">
            Existing local profiles and session history will be copied to PostgreSQL. Each imported account gets a generated password that must be changed at first login. Browser data is retained as a backup.
          </p>
          <button className="np-btn-secondary" disabled={working} onClick={importLegacy}>
            {working ? 'Importing…' : 'Import legacy profiles'}
          </button>
        </section>
      )}

      {importedCredentials && (
        <section className="np-card p-6 space-y-3 border-teal-500/30">
          <h2 className="np-section-title">Imported account credentials</h2>
          <p className="text-sm text-slate-300">Copy these credentials now; temporary passwords are not stored in readable form or shown again.</p>
          {importedCredentials.length === 0
            ? <p className="text-sm text-slate-400">No new accounts were imported; these legacy profiles may already have been imported.</p>
            : importedCredentials.map((credential) => (
              <div key={credential.username} className="rounded-lg bg-slate-950 p-4 font-mono text-sm">
                <p>{credential.displayName}</p>
                <p>Username: {credential.username}</p>
                <p>Password: {credential.password}</p>
              </div>
            ))}
          <button className="np-btn-secondary" onClick={() => setImportedCredentials(null)}>Close credentials</button>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {users.map((user) => (
          <article key={user.id} className="np-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{user.name}</h3>
                <p className="text-sm text-slate-400">@{user.username}</p>
              </div>
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs text-teal-300 capitalize">{user.role}</span>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              <p>Age group: {user.ageGroup} · Goal: {user.goal}</p>
              <p>{user.sessionCount} saved session(s) · Joined {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
            {user.role === 'player' && (
              <button
                className="np-btn-secondary mt-4 text-xs"
                disabled={working}
                onClick={() => void resetPassword(user.id)}
              >
                Reset password
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
