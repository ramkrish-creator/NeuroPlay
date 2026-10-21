import { useState } from 'react';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { api } from '../api/client';
import { Disclaimer } from '../components/Disclaimer';
import type { UserProfile } from '../types';
import { Users, UserCheck } from 'lucide-react';

const GOALS: { id: UserProfile['goal']; label: string }[] = [
  { id: 'memory', label: 'Improve Memory' },
  { id: 'attention', label: 'Improve Attention' },
  { id: 'overall', label: 'Improve Overall Cognition' },
];

export function Settings() {
  const profile = useNeuroPlayStore((s) => s.profile);
  const setProfile = useNeuroPlayStore((s) => s.setProfile);
  const clearActivePlayerData = useNeuroPlayStore((s) => s.clearActivePlayerData);
  const navigate = useNeuroPlayStore((s) => s.navigate);
  const authUser = useNeuroPlayStore((s) => s.authUser);

  const [confirmClearActive, setConfirmClearActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(profile?.name ?? '');
  const [draftGoal, setDraftGoal] = useState<UserProfile['goal']>(profile?.goal ?? 'overall');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const updateProfile = async () => {
    setError(null);
    try {
      await setProfile({ ...profile!, name: draftName.trim(), goal: draftGoal });
      setDraftName(draftName.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save profile changes.');
    }
  };

  const resetHistory = async () => {
    setError(null);
    try {
      await clearActivePlayerData();
      setConfirmClearActive(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset session history.');
    }
  };

  const changePassword = async () => {
    setError(null);
    setPasswordSaved(false);
    try {
      await api.changePassword(newPassword);
      setNewPassword('');
      setPasswordConfirmation('');
      setPasswordSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change password.');
    }
  };

  if (!profile) return null;

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto w-full space-y-6 animate-fade-in text-slate-100">
      <h1 className="text-3xl font-bold text-slate-50 mb-2 font-display">Settings</h1>
      {error && <p role="alert" className="rounded-xl bg-rose-950/60 p-4 text-sm text-rose-200">{error}</p>}

      {/* Active Player Profile Settings */}
      <section className="np-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="np-section-title">Account Profile</p>
          {authUser?.role === 'admin' && (
            <button
              onClick={() => navigate('players')}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5"
            >
              <Users size={14} /> Manage Users
            </button>
          )}
        </div>

        <label className="block">
          <span className="np-label">Player Name</span>
          <input
            className="np-input mt-1.5"
            value={draftName}
            maxLength={100}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </label>

        <div>
          <span className="np-label">Training Goal</span>
          <div className="flex flex-col gap-2 mt-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                className={`np-choice-row ${draftGoal === g.id ? 'np-choice-active' : ''}`}
                onClick={() => setDraftGoal(g.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold">{g.label}</span>
                  {draftGoal === g.id && <UserCheck size={16} className="text-teal-400" />}
                </div>
              </button>
            ))}
          </div>
        </div>
        <button className="np-btn-primary" disabled={!draftName.trim()} onClick={() => void updateProfile()}>
          Save Profile
        </button>
      </section>

      {/* Data Management Section */}
      <section className="np-card p-6 space-y-4">
        <p className="np-section-title">Account &amp; Session History</p>
        <p className="text-sm text-slate-400 leading-relaxed">
          Your session history and profile are saved to your NeuroPlay account on the server.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {!confirmClearActive ? (
            <button className="np-btn-secondary" onClick={() => setConfirmClearActive(true)}>
              Reset my History
            </button>
          ) : (
            <button
              className="np-btn-danger"
              onClick={() => void resetHistory()}
            >
              Confirm: Erase My Sessions
            </button>
          )}
        </div>
      </section>

      <section className="np-card p-6 space-y-4">
        <p className="np-section-title">Change Password</p>
        <label className="block">
          <span className="np-label">New password (at least 12 characters)</span>
          <input className="np-input mt-1.5" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label className="block">
          <span className="np-label">Confirm new password</span>
          <input className="np-input mt-1.5" type="password" autoComplete="new-password" minLength={12} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
        </label>
        {passwordSaved && <p role="status" className="text-sm text-teal-300">Password updated.</p>}
        <button
          className="np-btn-secondary"
          disabled={newPassword.length < 12 || newPassword !== passwordConfirmation}
          onClick={() => void changePassword()}
        >
          Change Password
        </button>
      </section>

      <section className="np-card p-6">
        <p className="np-section-title mb-3">About the Adaptive Engine</p>
        <p className="text-sm text-slate-400 leading-relaxed">
          NeuroPlay uses the <strong className="text-slate-200">Adaptive Engine</strong> to evaluate rolling accuracy, reaction times, and cognitive consistency per player profile, personalizing challenge level to each participant.
        </p>
      </section>

      <section className="np-card p-6">
        <p className="np-section-title mb-3">About &amp; Disclaimer</p>
        <Disclaimer />
      </section>
    </div>
  );
}
