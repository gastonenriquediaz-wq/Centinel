import { supabase } from './supabase';
import { Profile, Institution } from '../types/database.types';

export const AuthService = {
  /**
   * Inicia sesión con correo y contraseña.
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw error;
    }

    // Obtener el perfil asociado en public.profiles
    const { profile, institution } = await this.getProfile(data.user.id);
    return { session: data.session, user: data.user, profile, institution };
  },

  /**
   * Obtiene el perfil de un usuario y los datos de su institución.
   */
  async getProfile(userId: string): Promise<{ profile: Profile; institution: Institution | null }> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error('No se pudo encontrar el perfil del usuario.');
    }

    let institution: Institution | null = null;
    if (profile.institution_id) {
      const { data: instData } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();
      institution = instData ?? null;
    }

    return { profile, institution };
  },

  /**
   * Envía un correo para restablecer la contraseña (RF-09).
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    if (error) {
      throw error;
    }
  },

  /**
   * Cierra la sesión activa.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  },

  /**
   * Obtiene la sesión actual persistida si existe.
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    return data.session;
  },
};
