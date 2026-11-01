import { supabase } from './supabase';
import { Case, CaseAct, CaseStatus, ActType } from '../types/database.types';

export interface CreateCaseInput {
  institution_id: string;
  report_id: string;
  created_by: string;
  title: string;
  protocol_level: string;
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
          protocol_level: input.protocol_level,
          status: 'open',
        })
        .select()
        .single();

      if (caseError || !caseData) {
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
          protocol_level: input.protocol_level,
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
          creator:profiles!cases_created_by_fkey(*)
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

      return { data: (data as Case[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Obtiene el detalle de un caso por ID con todas sus actas y reporte
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
      
            // Obtener todos los reportes vinculados al caso
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
      // Ordenar actas cronológicamente
      if (caseItem.acts) {
        caseItem.acts.sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        );
      }

      return { data: caseItem, error: null };
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
        },
      });

      return { data: data as CaseAct, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
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
