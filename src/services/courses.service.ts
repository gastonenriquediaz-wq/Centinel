import { supabase } from './supabase';
import { Course, QRCode, QRValidationResult, ShiftType } from '../types/database.types';

export const CoursesService = {
  /**
   * Obtiene todos los cursos de la institución correspondiente.
   */
  async getCourses(institutionId: string): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('institution_id', institutionId)
      .order('year', { ascending: true })
      .order('division', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  },

  /**
   * Obtiene un curso por su ID.
   */
  async getCourseById(courseId: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) {
      return null;
    }
    return data;
  },

  /**
   * Crea un nuevo curso asociado a la institución de la autoridad (RF-03).
   */
  async createCourse(params: {
    institutionId: string;
    year: number;
    division: string;
    shift: ShiftType;
    schoolYear: number;
    estimatedStudents: number;
  }): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        institution_id: params.institutionId,
        year: params.year,
        division: params.division.trim().toUpperCase(),
        shift: params.shift,
        school_year: params.schoolYear,
        estimated_students: params.estimatedStudents,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe un curso registrado con el mismo año, división, turno y ciclo lectivo.');
      }
      throw error;
    }
    return data;
  },

  /**
   * Genera un código QR temporal con vigencia de 5 minutos para un curso (RF-04).
   */
  async generateCourseQR(params: {
    courseId: string;
    institutionId: string;
    userId: string;
  }): Promise<QRCode> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos exactos

    const { data, error } = await supabase
      .from('qr_codes')
      .insert({
        course_id: params.courseId,
        institution_id: params.institutionId,
        created_by: params.userId,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }
    return data;
  },

  /**
   * Valida un token QR leído por el estudiante en el backend.
   */
  async validateQRToken(token: string): Promise<QRValidationResult> {
    const { data, error } = await supabase.rpc('validate_qr_token', {
      p_token: token,
    });

    if (error) {
      return { valid: false, error: 'No se pudo conectar con el servidor para validar el código.' };
    }
    return data as QRValidationResult;
  },

  /**
   * Completa el registro del estudiante a través del backend de forma atómica.
   */
  async completeRegistration(params: {
    userId: string;
    token: string;
    firstName: string;
    lastName: string;
    dni: string;
    birthDate: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('complete_student_registration', {
      p_user_id: params.userId,
      p_token: params.token,
      p_first_name: params.firstName,
      p_last_name: params.lastName,
      p_dni: params.dni,
      p_birth_date: params.birthDate,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data as { success: boolean; error?: string };
  },
};
