import { supabase } from './supabase';
import { Profile, Institution, Course } from '../types/database.types';

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
    try {
      const { profile, institution, course } = await this.getProfile(
        data.user.id,
        data.user.email
      );
      return { session: data.session, user: data.user, profile, institution, course };
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      throw err;
    }
  },

  /**
   * Obtiene el perfil de un usuario, su institución y curso asignado.
   */
  async getProfile(
    userId: string,
    userEmail?: string
  ): Promise<{ profile: Profile; institution: Institution | null; course: Course | null }> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error('No se pudo encontrar el perfil del usuario.');
    }

    // Normalizar el cargo oficial para cuentas de autoridad (Director vs Vicedirector)
    if (profile.role === 'authority') {
      let emailToCheck = userEmail?.toLowerCase() || '';
      if (!emailToCheck) {
        const { data: userData } = await supabase.auth.getUser();
        emailToCheck = userData?.user?.email?.toLowerCase() || '';
      }
      if (emailToCheck.includes('vicedirector')) {
        profile.position = 'Vicedirector';
      } else if (emailToCheck.includes('director')) {
        profile.position = 'Director';
      }
    }

    let institution: Institution | null = null;
    if (profile.institution_id) {
      const { data: instData } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();
      if (instData) {
        if (/Colegio Secundario Modelo San Mart[ií]n/i.test(instData.name)) {
          instData.name = 'Colegio Secundario Modelo de Salta';
        }
        institution = instData;
      }
    }

    let course: Course | null = null;
    if (profile.course_id) {
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', profile.course_id)
        .maybeSingle();
      course = courseData ?? null;
    }

    return { profile, institution, course };
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
