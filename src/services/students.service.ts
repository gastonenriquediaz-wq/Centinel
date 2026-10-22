import { supabase } from './supabase';
import { Profile, AccountStatus } from '../types/database.types';

export interface StudentWithCourse extends Profile {
  course?: {
    year: number;
    division: string;
    shift: string;
    school_year: number;
  };
}

export const StudentsService = {
  /**
   * Obtiene la lista de solicitudes de registro pendientes para la institución (RF-06).
   */
  async getPendingRequests(institutionId: string): Promise<StudentWithCourse[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, course:courses(year, division, shift, school_year)')
      .eq('institution_id', institutionId)
      .eq('role', 'student')
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return (data || []) as StudentWithCourse[];
  },

  /**
   * Obtiene todos los estudiantes de la institución (aprobados, suspendidos, etc.) (RF-10).
   */
  async getStudentsByInstitution(institutionId: string): Promise<StudentWithCourse[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, course:courses(year, division, shift, school_year)')
      .eq('institution_id', institutionId)
      .eq('role', 'student')
      .order('last_name', { ascending: true });

    if (error) {
      throw error;
    }
    return (data || []) as StudentWithCourse[];
  },

  /**
   * Actualiza el estado de la cuenta de un estudiante (aprobar, rechazar, suspender, etc.) (RF-06, RF-11).
   */
  async updateAccountStatus(studentId: string, newStatus: AccountStatus): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        account_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    if (error) {
      throw error;
    }
  },
};
