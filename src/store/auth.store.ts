import { create } from 'zustand';
import { Profile, Institution } from '../types/database.types';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  institution: Institution | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null, institution?: Institution | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  institution: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile, institution = null) => set({ profile, institution }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ session: null, user: null, profile: null, institution: null, isLoading: false }),
}));
