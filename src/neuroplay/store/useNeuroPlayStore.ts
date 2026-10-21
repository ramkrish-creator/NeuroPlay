import { create } from 'zustand';
import type { DifficultyLevel, GameId, GameSessionResult, UserProfile } from '../types';
import { api, type AdminUser, type AuthenticatedUser, type UserData } from '../api/client';

export type NavPage = 'dashboard' | 'games' | 'progress' | 'cognitive-profile' | 'history' | 'players' | 'settings';

const DEFAULT_DIFFICULTY: Record<GameId, DifficultyLevel> = {
  'word-recall': 1, 'pattern-recall': 1, 'scene-memory': 1, 'focus-finder': 1,
  'sequence-master': 1, 'rule-switch': 1, 'quick-response': 1,
};

interface NeuroPlayStore {
  authUser: AuthenticatedUser | null;
  profile: UserProfile | null;
  sessions: GameSessionResult[];
  difficultyByGame: Record<GameId, DifficultyLevel>;
  recommendedGameIds: GameId[];
  adminUsers: AdminUser[];
  page: NavPage;
  activeGame: GameId | null;
  trainingQueue: GameId[] | null;
  trainingIndex: number;
  trainingSessionIds: string[];
  setAuthUser: (user: AuthenticatedUser | null) => void;
  setUserData: (data: UserData) => void;
  clearUserData: () => void;
  loadAdminUsers: () => Promise<void>;
  setProfile: (profile: UserProfile) => Promise<void>;
  navigate: (page: NavPage) => void;
  openGame: (id: GameId) => void;
  closeGame: () => void;
  addGameSession: (session: GameSessionResult) => Promise<void>;
  clearActivePlayerData: () => Promise<void>;
  startTrainingSession: (games: GameId[]) => void;
  advanceTrainingSession: () => void;
  endTrainingSession: () => void;
}

export const useNeuroPlayStore = create<NeuroPlayStore>()((set, get) => ({
  authUser: null,
  profile: null,
  sessions: [],
  difficultyByGame: { ...DEFAULT_DIFFICULTY },
  recommendedGameIds: [],
  adminUsers: [],
  page: 'dashboard',
  activeGame: null,
  trainingQueue: null,
  trainingIndex: 0,
  trainingSessionIds: [],

  setAuthUser: (authUser) => set({ authUser }),

  setUserData: (data) => set({
    profile: data.profile,
    sessions: data.sessions,
    difficultyByGame: { ...DEFAULT_DIFFICULTY, ...data.difficultyByGame },
    recommendedGameIds: data.recommendedGameIds,
    page: 'dashboard',
    activeGame: null,
    trainingQueue: null,
    trainingIndex: 0,
    trainingSessionIds: [],
  }),

  clearUserData: () => set({
    authUser: null,
    profile: null,
    sessions: [],
    difficultyByGame: { ...DEFAULT_DIFFICULTY },
    recommendedGameIds: [],
    adminUsers: [],
    page: 'dashboard',
    activeGame: null,
    trainingQueue: null,
    trainingIndex: 0,
    trainingSessionIds: [],
  }),

  loadAdminUsers: async () => {
    const { users } = await api.listUsers();
    set({ adminUsers: users });
  },

  setProfile: async (profile) => {
    const data = await api.updateProfile(profile);
    set({
      profile: data.profile,
      sessions: data.sessions,
      difficultyByGame: { ...DEFAULT_DIFFICULTY, ...data.difficultyByGame },
      recommendedGameIds: data.recommendedGameIds,
    });
  },

  navigate: (page) => set({ page, activeGame: null, trainingQueue: null, trainingIndex: 0, trainingSessionIds: [] }),
  openGame: (id) => set({ activeGame: id }),
  closeGame: () => set({ activeGame: null, trainingQueue: null, trainingIndex: 0, trainingSessionIds: [] }),

  addGameSession: async (session) => {
    const current = get();
    const nextDifficulty = { ...current.difficultyByGame, [session.gameId]: session.difficultyEnd };
    const data = await api.saveSession(session, nextDifficulty);
    set((state) => ({
      sessions: data.sessions,
      difficultyByGame: { ...DEFAULT_DIFFICULTY, ...data.difficultyByGame },
      recommendedGameIds: data.recommendedGameIds,
      trainingSessionIds: state.trainingQueue
        ? [...state.trainingSessionIds, session.id]
        : state.trainingSessionIds,
    }));
  },

  clearActivePlayerData: async () => {
    await api.clearSessions();
    set({ sessions: [], difficultyByGame: { ...DEFAULT_DIFFICULTY }, recommendedGameIds: [] });
  },

  startTrainingSession: (games) => set({
    trainingQueue: games, trainingIndex: 0, trainingSessionIds: [], activeGame: games[0] ?? null,
  }),

  advanceTrainingSession: () => {
    const { trainingQueue, trainingIndex } = get();
    if (!trainingQueue) return;
    const next = trainingIndex + 1;
    if (next < trainingQueue.length) {
      set({ trainingIndex: next, activeGame: trainingQueue[next] });
    } else {
      set({ activeGame: null });
    }
  },

  endTrainingSession: () => set({
    trainingQueue: null, trainingIndex: 0, trainingSessionIds: [], activeGame: null,
  }),
}));
