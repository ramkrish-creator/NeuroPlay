import { LayoutDashboard, Gamepad2, TrendingUp, Brain, History, Settings, LogOut, Users } from 'lucide-react';
import { useNeuroPlayStore, type NavPage } from '../store/useNeuroPlayStore';

const ITEMS: { id: NavPage; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'cognitive-profile', label: 'Cognitive Profile', icon: Brain },
  { id: 'history', label: 'History', icon: History },
  { id: 'players', label: 'Users', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function NavBar({ onLogout }: { onLogout: () => void }) {
  const page = useNeuroPlayStore((s) => s.page);
  const navigate = useNeuroPlayStore((s) => s.navigate);
  const profile = useNeuroPlayStore((s) => s.profile);
  const authUser = useNeuroPlayStore((s) => s.authUser);

  return (
    <nav className="np-navbar">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg text-slate-50 tracking-tight font-display">NeuroPlay</span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {ITEMS.filter((item) => !item.adminOnly || authUser?.role === 'admin').map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`np-nav-item ${page === id ? 'np-nav-item-active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={16} />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-300 max-w-36 truncate">
          {profile?.name}{authUser?.role === 'admin' ? ' · Admin' : ''}
        </span>
        <button className="np-exit-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
