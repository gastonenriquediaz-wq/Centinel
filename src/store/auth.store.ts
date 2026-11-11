import { create } from 'zustand';
import { Profile, Institution, Course } from '../types/database.types';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  institution: Institution | null;
  course: Course | null;
  isLoading: boolean;
  sessionTimeoutMessage: string | null;
  isNativeDialogOpen: boolean;
  suppressAutoLogoutUntil: number;
  setSession: (session: Session | null) => void;
  setProfile: (
    profile: Profile | null,
    institution?: Institution | null,
    course?: Course | null
  ) => void;
  setLoading: (loading: boolean) => void;
  setSessionTimeoutMessage: (msg: string | null) => void;
  setNativeDialogOpen: (open: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  institution: null,
  course: null,
  isLoading: true,
  sessionTimeoutMessage: null,
  isNativeDialogOpen: false,
  suppressAutoLogoutUntil: 0,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile, institution = null, course = null) =>
    set({ profile, institution, course }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionTimeoutMessage: (sessionTimeoutMessage) => set({ sessionTimeoutMessage }),
  setNativeDialogOpen: (open) =>
    set({
      isNativeDialogOpen: open,
      suppressAutoLogoutUntil: open ? Date.now() + 60000 : Date.now() + 3000,
    }),
  reset: () =>
    set({
      session: null,
      user: null,
      profile: null,
      institution: null,
      course: null,
      isLoading: false,
      isNativeDialogOpen: false,
      suppressAutoLogoutUntil: 0,
    }),
}));
