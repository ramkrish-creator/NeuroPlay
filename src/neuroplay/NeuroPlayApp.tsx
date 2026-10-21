import { useEffect, useState } from 'react';
import { useNeuroPlayStore } from './store/useNeuroPlayStore';
import { Dashboard } from './pages/Dashboard';
import { GamesHub } from './pages/GamesHub';
import { Progress } from './pages/Progress';
import { CognitiveProfilePage } from './pages/CognitiveProfilePage';
import { History } from './pages/History';
import { PlayersPage } from './pages/PlayersPage';
import { Settings } from './pages/Settings';
import { NavBar } from './components/NavBar';
import { TrainingSessionSummary } from './components/TrainingSessionSummary';
import { WordRecall } from './games/WordRecall';
import { PatternRecall } from './games/PatternRecall';
import { SceneMemory } from './games/SceneMemory';
import { FocusFinder } from './games/FocusFinder';
import { SequenceMaster } from './games/SequenceMaster';
import { RuleSwitch } from './games/RuleSwitch';
import { QuickResponse } from './games/QuickResponse';
import type { GameId } from './types';
import { api, ApiError, type AuthenticatedUser } from './api/client';
import { LoginScreen, PasswordChangeScreen } from './components/AuthScreens';

const GAME_COMPONENTS: Record<GameId, React.ComponentType> = {
  'word-recall': WordRecall,
  'pattern-recall': PatternRecall,
  'scene-memory': SceneMemory,
  'focus-finder': FocusFinder,
  'sequence-master': SequenceMaster,
  'rule-switch': RuleSwitch,
  'quick-response': QuickResponse,
};

const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  games: GamesHub,
  progress: Progress,
  'cognitive-profile': CognitiveProfilePage,
  history: History,
  players: PlayersPage,
  settings: Settings,
};

export function NeuroPlayApp() {
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'password-change' | 'ready'>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const authUser = useNeuroPlayStore((s) => s.authUser);
  const setAuthUser = useNeuroPlayStore((s) => s.setAuthUser);
  const setUserData = useNeuroPlayStore((s) => s.setUserData);
  const clearUserData = useNeuroPlayStore((s) => s.clearUserData);
  const page = useNeuroPlayStore((s) => s.page);
  const activeGame = useNeuroPlayStore((s) => s.activeGame);
  const trainingQueue = useNeuroPlayStore((s) => s.trainingQueue);

  useEffect(() => {
    let mounted = true;
    api.currentUser()
      .then(async (user) => {
        if (!mounted) return;
        setAuthUser(user);
        if (user.mustChangePassword) {
          setAuthState('password-change');
          return;
        }
        const data = await api.loadUserData();
        if (!mounted) return;
        setUserData(data);
        setAuthState('ready');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAuthUser(null);
        setAuthState('signed-out');
        if (!(error instanceof ApiError && error.status === 401)) {
          setAuthError(error instanceof Error ? error.message : 'Unable to connect to NeuroPlay.');
        } else {
          setAuthError(null);
        }
      });
    return () => { mounted = false; };
  }, [setAuthUser, setUserData]);

  const login = async (username: string, password: string) => {
    setAuthError(null);
    try {
      const { user } = await api.login(username, password);
      setAuthUser(user);
      if (user.mustChangePassword) {
        setAuthState('password-change');
        return;
      }
      setUserData(await api.loadUserData());
      setAuthState('ready');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    }
  };

  const changePassword = async (password: string) => {
    setAuthError(null);
    try {
      await api.changePassword(password);
      const user: AuthenticatedUser | null = authUser ? { ...authUser, mustChangePassword: false } : null;
      setAuthUser(user);
      setUserData(await api.loadUserData());
      setAuthState('ready');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to change password.');
    }
  };

  const logout = async () => {
    setLogoutError(null);
    try {
      await api.logout();
      clearUserData();
      setAuthState('signed-out');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  if (authState === 'checking') {
    return (
      <div className="neuroplay fixed inset-0 w-full h-full flex items-center justify-center z-20">
        <p className="text-slate-300">Connecting to NeuroPlay…</p>
      </div>
    );
  }

  if (authState === 'signed-out' || authState === 'password-change') {
    return (
      <div className="neuroplay fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col z-20">
        {authState === 'password-change'
          ? <PasswordChangeScreen onChangePassword={changePassword} error={authError} />
          : <LoginScreen onLogin={login} error={authError} />}
      </div>
    );
  }

  const trainingFinished = trainingQueue !== null && activeGame === null;
  const GameComponent = activeGame ? GAME_COMPONENTS[activeGame] : null;
  const safePage = page === 'players' && authUser?.role !== 'admin' ? 'dashboard' : page;
  const PageComponent = PAGES[safePage] ?? Dashboard;

  return (
    <div className="neuroplay fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col z-20">
      <NavBar onLogout={logout} />
      {logoutError && (
        <div role="alert" className="fixed top-20 right-4 z-50 rounded-xl bg-rose-950/90 px-4 py-3 text-sm text-rose-200">
          {logoutError}
        </div>
      )}
      <main className="flex-1 w-full pb-16">
        {trainingFinished ? (
          <TrainingSessionSummary />
        ) : GameComponent ? (
          <GameComponent />
        ) : (
          <PageComponent />
        )}
      </main>
    </div>
  );
}
