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

  /**
   * Obtiene todos los estudiantes registrados en un curso específico.
   */
  async getStudentsByCourse(courseId: string): Promise<StudentWithCourse[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, course:courses(year, division, shift, school_year)')
      .eq('course_id', courseId)
      .eq('role', 'student')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      throw error;
    }
    return (data || []) as StudentWithCourse[];
  },

  /**
   * Verifica rigurosamente si un estudiante puede ser eliminado del sistema sin
   * comprometer la integridad de reportes, testimonios, actas o expedientes institucionales.
   */
  async checkCanDeleteStudent(studentId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // 1. Reportes emitidos
    const { count: reportCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if (reportCount && reportCount > 0) {
      return {
        canDelete: false,
        reason: `El estudiante figura como emisor de ${reportCount} reporte(s) en la institución. Por protocolo y resguardo legal, no es posible eliminar su cuenta. Podés optar por suspenderla.`,
      };
    }

    // 2. Mensajes o testimonios en el canal de comunicación
    const { count: msgCount } = await supabase
      .from('report_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', studentId);

    if (msgCount && msgCount > 0) {
      return {
        canDelete: false,
        reason: `El estudiante registra ${msgCount} mensaje(s) o testimonio(s) en el canal de comunicación del caso. Por trazabilidad institucional no puede ser eliminado. Podés optar por suspenderlo.`,
      };
    }

    // 3. Vinculación en casos escolares (audit_log o involucrado)
    const { data: student } = await supabase
      .from('profiles')
      .select('first_name, last_name, dni')
      .eq('id', studentId)
      .single();

    if (student) {
      const fullName = `${student.first_name} ${student.last_name}`.trim();
      const { data: caseAudit } = await supabase
        .from('audit_log')
        .select('id, details')
        .eq('entity_type', 'case')
        .or(`details->>student_name.ilike.%${fullName}%,details->>name.ilike.%${fullName}%`)
        .limit(1);

      if (caseAudit && caseAudit.length > 0) {
        return {
          canDelete: false,
          reason: `El estudiante se encuentra señalado o involucrado en expedientes de casos de convivencia escolar. No es posible eliminarlo; utilizá la opción de suspensión.`,
        };
      }
    }

    return { canDelete: true };
  },

  /**
   * Suspende temporalmente la cuenta de un estudiante por mal uso u observación institucional.
   */
  async suspendStudent(params: {
    studentId: string;
    performedBy: string;
    institutionId: string;
    reason?: string;
  }): Promise<void> {
    await this.updateAccountStatus(params.studentId, 'suspended');

    try {
      await supabase.from('audit_log').insert({
        institution_id: params.institutionId,
        entity_type: 'student',
        entity_id: params.studentId,
        action: 'suspend_student',
        performed_by: params.performedBy,
        details: { reason: params.reason || 'Suspensión preventiva por mal uso de la plataforma' },
      });
    } catch (e) {
      console.warn('Could not insert audit log for suspension:', e);
    }
  },

  /**
   * Reactiva una cuenta de estudiante que se encontraba suspendida.
   */
  async reactivateStudent(params: {
    studentId: string;
    performedBy: string;
    institutionId: string;
  }): Promise<void> {
    await this.updateAccountStatus(params.studentId, 'approved');

    try {
      await supabase.from('audit_log').insert({
        institution_id: params.institutionId,
        entity_type: 'student',
        entity_id: params.studentId,
        action: 'reactivate_student',
        performed_by: params.performedBy,
        details: { note: 'Reactivación de cuenta tras resolución o acuerdo institucional' },
      });
    } catch (e) {
      console.warn('Could not insert audit log for reactivation:', e);
    }
  },

  /**
   * Elimina un estudiante que no registra reportes ni antecedentes en el sistema.
   * Si las políticas RLS impiden DELETE directo en tabla profiles, desvincula y desactiva la cuenta.
   */
  async deleteStudent(params: {
    studentId: string;
    performedBy: string;
    institutionId: string;
  }): Promise<void> {
    const check = await this.checkCanDeleteStudent(params.studentId);
    if (!check.canDelete) {
      throw new Error(check.reason || 'No se puede eliminar al estudiante.');
    }

    // Registrar en auditoría antes de eliminar
    try {
      await supabase.from('audit_log').insert({
        institution_id: params.institutionId,
        entity_type: 'student',
        entity_id: params.studentId,
        action: 'delete_student',
        performed_by: params.performedBy,
        details: { note: 'Baja definitiva de usuario sin reportes asociados' },
      });
    } catch (e) {
      console.warn('Could not insert audit log for deletion:', e);
    }

    // Intentar borrado físico
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', params.studentId);

    if (deleteError) {
      // Fallback seguro si RLS no permite DELETE: desvincular del curso y marcar inactivo
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          course_id: null,
          account_status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.studentId);

      if (updateError) {
        throw updateError;
      }
    }
  },
};
