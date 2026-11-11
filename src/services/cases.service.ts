import { supabase } from './supabase';
import { Case, CaseAct, CaseStatus, ActType, CaseInvolvedStudent } from '../types/database.types';
import { migrateCase, migrateCases } from '../utils/textMigration';

export interface CreateCaseInput {
  institution_id: string;
  report_id: string;
  created_by: string;
  title: string;
  protocol_level?: string;
  initial_observation?: string;
}

export interface CreateCaseActInput {
  case_id: string;
  institution_id: string;
  created_by: string;
  act_type: ActType;
  title: string;
  participants: string;
  content: string;
  occurred_at: string;
}

export interface AddStudentToCaseInput {
  institution_id: string;
  case_id: string;
  performed_by: string;
  name: string;
  role: string;
  course?: string;
  notes?: string;
}

/**
 * Función auxiliar para consolidar y normalizar la lista de estudiantes involucrados
 */
export function extractInvolvedStudents(
  caseItem: Case,
  manualLogs: any[] = []
): CaseInvolvedStudent[] {
  const studentsMap = new Map<string, CaseInvolvedStudent>();

  // 1. Estudiante del reporte de origen
  if (caseItem.report?.student) {
    const s = caseItem.report.student;
    const name = `${s.first_name} ${s.last_name}`.trim();
    const courseStr = caseItem.report.course
      ? `${caseItem.report.course.year}° "${caseItem.report.course.division}" (${caseItem.report.course.shift})`
      : undefined;
    studentsMap.set(name.toLowerCase(), {
      id: `rep_student_${s.id}`,
      name,
      role: 'Estudiante afectado',
      course: courseStr,
      source: 'report_reporter',
    });
  }

  // 2. Estudiantes de reportes vinculados
  if (caseItem.linked_reports) {
    for (const lr of caseItem.linked_reports) {
      if (lr.student) {
        const name = `${lr.student.first_name} ${lr.student.last_name}`.trim();
        const courseStr = lr.course
          ? `${lr.course.year}° "${lr.course.division}" (${lr.course.shift})`
          : undefined;
        if (!studentsMap.has(name.toLowerCase())) {
          studentsMap.set(name.toLowerCase(), {
            id: `rep_student_${lr.student.id}`,
            name,
            role: 'Estudiante afectado',
            course: courseStr,
            source: 'report_reporter',
          });
        }
      }
    }
  }

  // 3. Parsear texto de personas involucradas de los reportes
  const allReports = [
    caseItem.report,
    ...(caseItem.linked_reports || []),
  ].filter(Boolean);

  for (const rep of allReports) {
    const raw = rep?.involved_persons || '';
    if (!raw.trim()) continue;

    // Buscar "Agresores: ..."
    const parts = raw.split('|').map((p) => p.trim());
    for (const part of parts) {
      if (part.toLowerCase().startsWith('agresores:')) {
        const content = part.substring(10).trim();
        if (
          !content.toLowerCase().includes('no identificados') &&
          !content.toLowerCase().includes('se desconoce')
        ) {
          const names = content.split(';');
          for (const item of names) {
            const clean = item.trim();
            if (!clean) continue;
            // Verificar si tiene curso entre paréntesis ej: Lucas Fernández (3.° B)
            const match = clean.match(/^(.*?)(?:\((.*?)\))?$/);
            const studentName = (match ? match[1] : clean).trim();
            const studentCourse = match && match[2] ? match[2].trim() : undefined;

            if (studentName && !studentsMap.has(studentName.toLowerCase())) {
              studentsMap.set(studentName.toLowerCase(), {
                id: `aggr_${studentName.toLowerCase()}`,
                name: studentName,
                role: 'Estudiante señalado por la agresión',
                course: studentCourse,
                source: 'report_aggressor',
              });
            }
          }
        }
      } else if (part.toLowerCase().startsWith('afectados:') || part.toLowerCase().startsWith('afectado:')) {
        // e.g. Afectados: El estudiante que reporta y otra persona (Nombre)
        const match = part.match(/\((.*?)\)/);
        if (match && match[1]) {
          const studentName = match[1].trim();
          if (studentName && !studentsMap.has(studentName.toLowerCase())) {
            studentsMap.set(studentName.toLowerCase(), {
              id: `aff_${studentName.toLowerCase()}`,
              name: studentName,
              role: 'Estudiante afectado',
              source: 'report_reporter',
            });
          }
        }
      }
    }

    // Si no contenía separador '|' pero es un nombre directo (formato previo)
    if (!raw.includes('|') && !raw.includes(':') && raw.trim().length > 2) {
      const studentName = raw.trim();
      if (!studentsMap.has(studentName.toLowerCase())) {
        studentsMap.set(studentName.toLowerCase(), {
          id: `raw_${studentName.toLowerCase()}`,
          name: studentName,
          role: 'Estudiante señalado por la agresión',
          source: 'report_aggressor',
        });
      }
    }
  }

  // 4. Agregar estudiantes incorporados manualmente desde el historial
  for (const log of manualLogs) {
    const details = log.details || {};
    const name = details.student_name || details.name;
    if (name && name.trim()) {
      const studentName = name.trim();
      studentsMap.set(studentName.toLowerCase(), {
        id: `manual_${log.id}`,
        name: studentName,
        role: details.role || 'Estudiante involucrado',
        course: details.course || undefined,
        notes: details.notes || undefined,
        source: 'manual',
        addedAt: log.created_at,
      });
    }
  }

  return Array.from(studentsMap.values());
}

export const CasesService = {
  /**
   * Promueve un reporte y crea un nuevo caso formal de actuación
   */
  async createCaseFromReport(
    input: CreateCaseInput
  ): Promise<{ data: Case | null; error: string | null }> {
    try {
      // 1. Insertar el caso
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert({
          institution_id: input.institution_id,
          report_id: input.report_id,
          created_by: input.created_by,
          title: input.title.trim(),
          protocol_level: input.protocol_level?.trim() || 'Protocolo institucional',
          status: 'open',
        })
        .select()
        .single();

      if (caseError || !caseData) {
        if (caseError?.code === '23505') {
          return {
            data: null,
            error: 'Este reporte ya cuenta con un expediente de caso abierto o vinculado.',
          };
        }
        return { data: null, error: caseError?.message || 'Error al crear el caso formal.' };
      }

      // 2. Vincular el case_id en la tabla reports y asegurarse de ponerlo en 'in_progress'
      await supabase
        .from('reports')
        .update({
          case_id: caseData.id,
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.report_id);

      // 3. Registrar en Audit Log
      await supabase.from('audit_log').insert({
        institution_id: input.institution_id,
        entity_type: 'case',
        entity_id: caseData.id,
        action: 'case_opened',
        performed_by: input.created_by,
        details: {
          report_id: input.report_id,
          protocol_level: input.protocol_level?.trim() || 'Protocolo institucional',
          initial_observation: input.initial_observation?.trim() || null,
        },
      });

      return { data: caseData as Case, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error inesperado al abrir caso.' };
    }
  },

  /**
   * Obtiene los casos de una institución para las autoridades
   */
  async getInstitutionCases(
    institutionId: string,
    statusFilter?: CaseStatus
  ): Promise<{ data: Case[]; error: string | null }> {
    try {
      let query = supabase
        .from('cases')
        .select(`
          *,
          report:reports!cases_report_id_fkey(
            *,
            student:profiles!reports_student_id_fkey(*),
            course:courses(*)
          ),
          creator:profiles!cases_created_by_fkey(*),
          acts:case_acts(id)
        `)
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: migrateCases((data as Case[]) || []), error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Obtiene el detalle de un caso por ID con todas sus actas, reportes y estudiantes involucrados
   */
  async getCaseDetails(caseId: string): Promise<{ data: Case | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          report:reports!cases_report_id_fkey(
            *,
            student:profiles!reports_student_id_fkey(*),
            course:courses(*),
            attachments:report_attachments(*)
          ),
          creator:profiles!cases_created_by_fkey(*),
          acts:case_acts(
            *,
            creator:profiles!case_acts_created_by_fkey(*)
          )
        `)
        .eq('id', caseId)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Caso no encontrado.' };
      }

      const caseItem = data as Case;

      // 1. Obtener todos los reportes vinculados al caso
      const { data: linkedReports } = await supabase
        .from('reports')
        .select(`
          *,
          student:profiles!reports_student_id_fkey(*),
          course:courses(*),
          attachments:report_attachments(*)
        `)
        .or(`id.eq.${caseItem.report_id},case_id.eq.${caseId}`)
        .order('created_at', { ascending: true });

      if (linkedReports && linkedReports.length > 0) {
        caseItem.linked_reports = linkedReports as any;
      }

      // 2. Ordenar actas cronológicamente
      if (caseItem.acts) {
        caseItem.acts.sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        );
      }

      // 3. Obtener logs de estudiantes agregados manualmente
      const { data: studentLogs } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', 'case')
        .eq('entity_id', caseId)
        .eq('action', 'student_added')
        .order('created_at', { ascending: true });

      caseItem.involved_students = extractInvolvedStudents(caseItem, studentLogs || []);

      return { data: migrateCase(caseItem), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Obtiene el detalle de un acta digital específica
   */
  async getCaseActDetails(actId: string): Promise<{ data: CaseAct | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('case_acts')
        .select(`
          *,
          creator:profiles!case_acts_created_by_fkey(*)
        `)
        .eq('id', actId)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Acta no encontrada.' };
      }

      return { data: data as CaseAct, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Agrega un acta digital de actuación (entrevista, mediación, etc.)
   */
  async addCaseAct(
    input: CreateCaseActInput
  ): Promise<{ data: CaseAct | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('case_acts')
        .insert({
          case_id: input.case_id,
          institution_id: input.institution_id,
          created_by: input.created_by,
          act_type: input.act_type,
          title: input.title.trim(),
          participants: input.participants.trim(),
          content: input.content.trim(),
          occurred_at: input.occurred_at,
        })
        .select(`
          *,
          creator:profiles!case_acts_created_by_fkey(*)
        `)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Error al guardar el acta.' };
      }

      // Si el caso estaba en 'open', mover automáticamente a 'under_investigation'
      await supabase
        .from('cases')
        .update({
          status: 'under_investigation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.case_id)
        .eq('status', 'open');

      // Registrar en Audit Log
      await supabase.from('audit_log').insert({
        institution_id: input.institution_id,
        entity_type: 'case_act',
        entity_id: data.id,
        action: 'act_created',
        performed_by: input.created_by,
        details: {
          case_id: input.case_id,
          act_type: input.act_type,
          title: input.title.trim(),
          participants: input.participants.trim(),
        },
      });

      return { data: data as CaseAct, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Agrega un estudiante involucrado de forma manual al expediente del caso
   * y lo registra en el historial de operaciones (audit_log)
   */
  async addInvolvedStudentToCase(
    input: AddStudentToCaseInput
  ): Promise<{ error: string | null }> {
    try {
      if (!input.name.trim()) {
        return { error: 'El nombre del estudiante es obligatorio.' };
      }

      const { error } = await supabase.from('audit_log').insert({
        institution_id: input.institution_id,
        entity_type: 'case',
        entity_id: input.case_id,
        action: 'student_added',
        performed_by: input.performed_by,
        details: {
          student_name: input.name.trim(),
          role: input.role.trim(),
          course: input.course?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Error al agregar estudiante al expediente.' };
    }
  },

  /**
   * Obtiene el historial completo de operaciones de un caso
   */
  async getCaseHistory(
    caseId: string,
    actIds: string[] = [],
    reportIds: string[] = []
  ): Promise<{ data: any[]; error: string | null }> {
    try {
      const allIds = Array.from(new Set([caseId, ...actIds, ...reportIds])).filter(Boolean);

      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          performer:profiles!audit_log_performed_by_fkey(*)
        `)
        .in('entity_id', allIds)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback por si la relación de foreign key difiere
        const fallback = await supabase
          .from('audit_log')
          .select(`
            *,
            performer:profiles(*)
          `)
          .in('entity_id', allIds)
          .order('created_at', { ascending: false });

        if (fallback.error) {
          const plain = await supabase
            .from('audit_log')
            .select('*')
            .in('entity_id', allIds)
            .order('created_at', { ascending: false });
          return { data: plain.data || [], error: plain.error?.message || null };
        }
        return { data: fallback.data || [], error: null };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Cierra/Resuelve un caso formal y actualiza el reporte a 'finalized'
   */
  async resolveCase(
    caseId: string,
    reportId: string,
    resolutionSummary: string,
    authorityId: string,
    institutionId: string
  ): Promise<{ error: string | null }> {
    try {
      if (!resolutionSummary.trim() || resolutionSummary.trim().length < 15) {
        return { error: 'Debe ingresar un resumen de resolución fundamentado (mínimo 15 caracteres).' };
      }

      // 1. Actualizar caso a 'resolved'
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'resolved',
          resolution_summary: resolutionSummary.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseId);

      if (caseError) {
        return { error: caseError.message };
      }

      // 2. Finalizar el reporte principal y todos los reportes vinculados al caso
      await supabase
        .from('reports')
        .update({
          status: 'finalized',
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${reportId},case_id.eq.${caseId}`);

      // 3. Registrar en Audit Log
      await supabase.from('audit_log').insert({
        institution_id: institutionId,
        entity_type: 'case',
        entity_id: caseId,
        action: 'case_resolved',
        performed_by: authorityId,
        details: {
          report_id: reportId,
          resolution_summary: resolutionSummary.trim(),
        },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  /**
   * Vincula un reporte existente a un caso formal existente
   */
  async linkReportToCase(
    reportId: string,
    caseId: string,
    performedBy: string,
    institutionId: string
  ): Promise<{ error: string | null }> {
    try {
      // 1. Actualizar el reporte con case_id y status 'in_progress'
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          case_id: caseId,
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (updateError) {
        return { error: updateError.message };
      }

      // 2. Registrar en Audit Log
      await supabase.from('audit_log').insert({
        institution_id: institutionId,
        entity_type: 'case',
        entity_id: caseId,
        action: 'report_linked_to_case',
        performed_by: performedBy,
        details: {
          report_id: reportId,
        },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Error al vincular el reporte al caso.' };
    }
  },
};
