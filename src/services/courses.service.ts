import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { Course, QRCode, QRValidationResult, ShiftType } from '../types/database.types';

// Alfabeto Base32 de 32 caracteres (Excluye O, I, 0 y 1 para evitar confusiones)
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Genera un código alfanumérico de 10 caracteres utilizando aleatoriedad criptográficamente segura.
 */
export function generateSecureAlphanumericCode(length = 10): string {
  const bytes = new Uint8Array(length);
  Crypto.getRandomValues(bytes);

  let code = '';
  for (let i = 0; i < length; i++) {
    // 256 es múltiplo exacto de 32, distribución 100% uniforme sin sesgo (3.125% c/u)
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Verifica si una cadena contiene exclusivamente caracteres válidos del alfabeto de códigos.
 */
export function isValidCodeChars(code: string): boolean {
  for (let i = 0; i < code.length; i++) {
    if (!CODE_ALPHABET.includes(code[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Convierte de manera biyectiva y determinista un código de 10 caracteres (Base32) a un UUID válido
 * para almacenamiento y validación atómica en Supabase (campo code_token uuid).
 */
export function codeToUUID(rawCode: string): string | null {
  const clean = rawCode.replace(/[\s-]/g, '').toUpperCase();
  if (clean.length !== 10 || !isValidCodeChars(clean)) {
    return null;
  }

  let num = 0n;
  for (let i = 0; i < clean.length; i++) {
    const idx = BigInt(CODE_ALPHABET.indexOf(clean[i]));
    num = num * 32n + idx;
  }

  const hex = num.toString(16).padStart(16, '0');
  // Estructura de UUID estándar (32 caracteres hexadecimales: 8-4-4-4-12)
  const p1 = 'a1fa' + hex.substring(0, 4);
  const p2 = hex.substring(4, 8);
  const p3 = '4000';
  const p4 = '8000';
  const p5 = hex.substring(8, 16) + '0000';
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * Convierte un UUID generado a partir de un código de 10 caracteres a su forma alfanumérica original.
 */
export function uuidToCode(uuid: string): string | null {
  const clean = uuid.replace(/-/g, '').toLowerCase();
  if (!clean.startsWith('a1fa') || clean.substring(12, 20) !== '40008000') {
    return null;
  }

  const hex = clean.substring(4, 8) + clean.substring(8, 12) + clean.substring(20, 28);
  let num = BigInt('0x' + hex);
  const chars: string[] = [];

  for (let i = 0; i < 10; i++) {
    const rem = num % 32n;
    chars.unshift(CODE_ALPHABET[Number(rem)]);
    num = num / 32n;
  }

  return chars.join('');
}

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
   * Actualiza los datos de un curso existente (ano, division, turno, ciclo o capacidad).
   */
  async updateCourse(
    courseId: string,
    params: {
      estimatedStudents?: number;
      division?: string;
      shift?: ShiftType;
      year?: number;
      schoolYear?: number;
    }
  ): Promise<Course> {
    const updatePayload: any = {};
    if (params.estimatedStudents !== undefined) updatePayload.estimated_students = params.estimatedStudents;
    if (params.division !== undefined) updatePayload.division = params.division.trim().toUpperCase();
    if (params.shift !== undefined) updatePayload.shift = params.shift;
    if (params.year !== undefined) updatePayload.year = params.year;
    if (params.schoolYear !== undefined) updatePayload.school_year = params.schoolYear;

    const { data, error } = await supabase
      .from('courses')
      .update(updatePayload)
      .eq('id', courseId)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe otro curso registrado con el mismo año, división, turno y ciclo lectivo.');
      }
      throw error;
    }
    return data;
  },

  /**
   * Elimina un curso de forma segura verificando previamente que no tenga estudiantes registrados.
   */
  async deleteCourse(courseId: string): Promise<{ success: boolean; error?: string }> {
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId);

    if (countError) {
      throw countError;
    }

    if (count && count > 0) {
      return {
        success: false,
        error: 'No se puede eliminar este curso porque ya cuenta con ' + count + ' estudiantes registrados. Primero debes reasignar a los alumnos a otro curso.',
      };
    }

    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (deleteError) {
      throw deleteError;
    }

    return { success: true };
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
   * Genera un código alfanumérico seguro de 10 caracteres con vigencia de 5 minutos.
   * Evita duplicados vigentes y permite que varios estudiantes se registren con él.
   */
  async generateCourseCode(params: {
    courseId: string;
    institutionId: string;
    userId: string;
  }): Promise<{ code: string; qrData: QRCode }> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos exactos

    let code = '';
    let tokenUUID = '';
    let isUnique = false;

    // Generar código con aleatoriedad criptosegura garantizando ausencia de duplicados vigentes
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateSecureAlphanumericCode(10);
      const candidateUUID = codeToUUID(code);
      if (!candidateUUID) continue;

      tokenUUID = candidateUUID;

      // Verificar que no exista un código idéntico vigente en la base de datos
      const { data: existing } = await supabase
        .from('qr_codes')
        .select('id')
        .eq('code_token', tokenUUID)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!existing) {
        isUnique = true;
        break;
      }
    }

    if (!isUnique) {
      throw new Error('No se pudo generar un código único en este momento. Reintentá.');
    }

    const { data, error } = await supabase
      .from('qr_codes')
      .insert({
        course_id: params.courseId,
        institution_id: params.institutionId,
        created_by: params.userId,
        code_token: tokenUUID,
        short_code: code,
        expires_at: expiresAt,
      } as any)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return { code, qrData: data };
  },

  /**
   * Valida un token (sea código QR o código alfanumérico) en el backend.
   */
  async validateQRToken(token: string): Promise<QRValidationResult & { token_for_registration?: string }> {
    const trimmed = token.trim();
    const cleanAlpha = trimmed.replace(/[\s-]/g, '').toUpperCase();
    let tokenToValidate = trimmed;

    // Si es un código alfanumérico de 10 caracteres del alfabeto permitido, convertir a UUID
    if (cleanAlpha.length === 10 && isValidCodeChars(cleanAlpha)) {
      const derivedUUID = codeToUUID(cleanAlpha);
      if (derivedUUID) {
        tokenToValidate = derivedUUID;
      }
    }

    // Intentar primero con la RPC validate_registration_code
    let { data, error } = await supabase.rpc('validate_registration_code', {
      p_code: tokenToValidate,
    });

    if (error) {
      // Fallback a validate_qr_token
      const fallback = await supabase.rpc('validate_qr_token', {
        p_token: tokenToValidate,
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return { valid: false, error: 'No se pudo conectar con el servidor para validar el código.' };
    }

    const res = data as QRValidationResult & { token_for_registration?: string; code_token?: string };
    return {
      ...res,
      token_for_registration: res.token_for_registration || res.code_token || tokenToValidate,
    };
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
    const trimmed = params.token.trim();
    const cleanAlpha = trimmed.replace(/[\s-]/g, '').toUpperCase();
    let tokenUUID = trimmed;

    if (cleanAlpha.length === 10 && isValidCodeChars(cleanAlpha)) {
      const derivedUUID = codeToUUID(cleanAlpha);
      if (derivedUUID) {
        tokenUUID = derivedUUID;
      }
    }

    const { data, error } = await supabase.rpc('complete_student_registration', {
      p_user_id: params.userId,
      p_token: tokenUUID,
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
