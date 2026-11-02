import { supabase } from './supabase';
import { Report, ReportAttachment, ReportStatus } from '../types/database.types';
import { migrateReport, migrateReports } from '../utils/textMigration';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface CreateReportInput {
  institution_id: string;
  course_id: string | null;
  student_id: string;
  situation_type: string;
  location: string;
  occurred_at: string;
  frequency: string;
  involved_persons: string;
  description: string;
}

export interface AttachmentInput {
  uri: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

export const ReportsService = {
  /**
   * Crea un reporte en la base de datos y sube los archivos adjuntos a Supabase Storage
   */
  async createReport(
    data: CreateReportInput,
    attachments: AttachmentInput[]
  ): Promise<{ data: Report | null; error: string | null }> {
    try {
      // 1. Validaciones de negocio (Tesis: max 5 fotos <= 25MB, max 1 video <= 40MB, total <= 65MB)
      const images = attachments.filter((a) => a.type === 'image');
      const videos = attachments.filter((a) => a.type === 'video');

      if (images.length > 5) {
        return { data: null, error: 'No se pueden adjuntar más de 5 imágenes.' };
      }
      if (videos.length > 1) {
        return { data: null, error: 'No se puede adjuntar más de 1 video.' };
      }

      const totalImageSize = images.reduce((acc, curr) => acc + curr.size, 0);
      const totalVideoSize = videos.reduce((acc, curr) => acc + curr.size, 0);
      const totalSize = totalImageSize + totalVideoSize;

      if (totalImageSize > 25 * 1024 * 1024) {
        return { data: null, error: 'El tamaño total de las imágenes supera el límite de 25 MB.' };
      }
      if (totalVideoSize > 40 * 1024 * 1024) {
        return { data: null, error: 'El tamaño del video supera el límite de 40 MB.' };
      }
      if (totalSize > 65 * 1024 * 1024) {
        return { data: null, error: 'El tamaño total de los adjuntos supera los 65 MB.' };
      }

      // 2. Insertar el reporte en la tabla reports
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          institution_id: data.institution_id,
          course_id: data.course_id,
          student_id: data.student_id,
          situation_type: data.situation_type,
          location: data.location,
          occurred_at: data.occurred_at,
          frequency: data.frequency,
          involved_persons: data.involved_persons,
          description: data.description,
          status: 'sent',
        })
        .select()
        .single();

      if (reportError || !reportData) {
        return { data: null, error: reportError?.message || 'Error al guardar el reporte.' };
      }

      const reportId = reportData.id;

      // 3. Subir adjuntos si existen
      const attachmentWarnings: string[] = [];
      for (const attachment of attachments) {
        try {
          const extension = (attachment.name.split('.').pop() || (attachment.type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
          const filePath = `${data.institution_id}/${reportId}/${fileName}`;

          // 1. Leer archivo de forma nativa con File.bytes() (Uint8Array) o fallback a fetch().arrayBuffer()
          let fileBytes: Uint8Array | ArrayBuffer;
          try {
            const fileObj = new File(attachment.uri);
            fileBytes = await fileObj.bytes();
          } catch {
            const response = await fetch(attachment.uri);
            fileBytes = await response.arrayBuffer();
          }

          const mimeType =
            attachment.type === 'video'
              ? `video/${extension === 'mov' ? 'quicktime' : 'mp4'}`
              : `image/${extension === 'jpg' ? 'jpeg' : extension}`;

          const { error: uploadError } = await supabase.storage
            .from('report-attachments')
            .upload(filePath, fileBytes, {
              contentType: mimeType,
              upsert: true,
            });

          if (uploadError) {
            console.error('Error subiendo archivo a Supabase Storage:', uploadError);
            attachmentWarnings.push(`Error subiendo ${attachment.name}: ${uploadError.message}`);
            continue;
          }

          // 2. Guardar registro en la tabla report_attachments
          const { error: dbAttError } = await supabase.from('report_attachments').insert({
            report_id: reportId,
            storage_path: filePath,
            file_type: attachment.type,
            file_size_bytes: attachment.size,
            original_name: attachment.name,
          });

          if (dbAttError) {
            console.error('Error guardando registro en report_attachments:', dbAttError);
            attachmentWarnings.push(`Error registrando ${attachment.name}: ${dbAttError.message}`);
          }
        } catch (uploadErr: any) {
          console.error('Excepción al procesar adjunto:', uploadErr);
          attachmentWarnings.push(`Excepción en ${attachment.name}: ${uploadErr.message}`);
        }
      }

      // 4. Registrar en Audit Log la creación
      await supabase.from('audit_log').insert({
        institution_id: data.institution_id,
        entity_type: 'report',
        entity_id: reportId,
        action: 'created',
        performed_by: data.student_id,
        details: {
          situation_type: data.situation_type,
          attachments_count: attachments.length,
        },
      });

      return { data: reportData as Report, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error inesperado al crear el reporte.' };
    }
  },

  /**
   * Obtiene los reportes creados por un estudiante
   */
  async getStudentReports(studentId: string): Promise<{ data: Report[]; error: string | null }> {
    try {
      // 1. Obtener reportes
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          attachments:report_attachments(*)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      const reportsList = (data as Report[]) || [];

      // Generar signed URLs para las miniaturas en la lista
      for (const rep of reportsList) {
        if (rep.attachments && rep.attachments.length > 0) {
          for (const att of rep.attachments) {
            const { data: urlData } = await supabase.storage
              .from('report-attachments')
              .createSignedUrl(att.storage_path, 3600);
            if (urlData) {
              att.public_url = urlData.signedUrl;
            }
          }
        }
      }

      return { data: migrateReports(reportsList), error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Obtiene los reportes de una institución para las autoridades
   */
  async getInstitutionReports(
    institutionId: string,
    statusFilter?: ReportStatus
  ): Promise<{ data: Report[]; error: string | null }> {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          student:profiles!reports_student_id_fkey(*),
          course:courses(*),
          attachments:report_attachments(*)
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

      const reportsList = (data as Report[]) || [];

      // Generar signed URLs para las autoridades
      for (const rep of reportsList) {
        if (rep.attachments && rep.attachments.length > 0) {
          for (const att of rep.attachments) {
            const { data: urlData } = await supabase.storage
              .from('report-attachments')
              .createSignedUrl(att.storage_path, 3600);
            if (urlData) {
              att.public_url = urlData.signedUrl;
            }
          }
        }
      }

      return { data: migrateReports(reportsList), error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Obtiene el detalle de un reporte por ID con sus adjuntos y URLs firmadas
   */
  async getReportDetails(reportId: string): Promise<{ data: Report | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          student:profiles!reports_student_id_fkey(*),
          course:courses(*),
          attachments:report_attachments(*)
        `)
        .eq('id', reportId)
        .single();

      if (error || !data) {
        return { data: null, error: error?.message || 'Reporte no encontrado.' };
      }

      const report = data as Report;

      // Obtener signed URLs temporales para los adjuntos
      if (report.attachments && report.attachments.length > 0) {
        for (const att of report.attachments) {
          const { data: urlData } = await supabase.storage
            .from('report-attachments')
            .createSignedUrl(att.storage_path, 3600); // 1 hora de validez

          if (urlData) {
            att.public_url = urlData.signedUrl;
          }
        }
      }

      return { data: migrateReport(report), error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Cambia el estado del reporte a 'in_progress' o 'closed_no_case'
   */
  async updateReportStatus(
    reportId: string,
    newStatus: 'in_progress' | 'closed_no_case',
    authorityId: string,
    institutionId: string,
    closeReason?: string
  ): Promise<{ error: string | null }> {
    try {
      if (newStatus === 'closed_no_case' && (!closeReason || closeReason.trim().length === 0)) {
        return { error: 'Debe especificar el motivo de cierre sin apertura de caso.' };
      }

      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'closed_no_case') {
        updatePayload.close_reason = closeReason?.trim();
      }

      const { error } = await supabase
        .from('reports')
        .update(updatePayload)
        .eq('id', reportId);

      if (error) {
        return { error: error.message };
      }

      // Registrar auditoría
      await supabase.from('audit_log').insert({
        institution_id: institutionId,
        entity_type: 'report',
        entity_id: reportId,
        action: 'status_changed',
        performed_by: authorityId,
        details: {
          new_status: newStatus,
          close_reason: closeReason || null,
        },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  /**
   * Registra la primera apertura de un reporte por parte de una autoridad (RPC).
   * Retorna true si es la primera vez que se abre en el sistema, o false si ya fue abierto previamente.
   */
  async logFirstOpened(reportId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('log_report_first_opened', { p_report_id: reportId });
      if (error) {
        console.log('Error en RPC log_report_first_opened:', error.message);
        return false;
      }
      return data === true;
    } catch (err) {
      console.log('Auditoría logFirstOpened omitida o ya registrada:', err);
      return false;
    }
  },

  /**
   * Obtiene los IDs de los reportes que ya fueron abiertos e inspeccionados por autoridades
   */
  async getOpenedReportIds(institutionId: string): Promise<Set<string>> {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('entity_id')
        .eq('institution_id', institutionId)
        .eq('entity_type', 'report')
        .eq('action', 'first_opened');

      if (error || !data) {
        return new Set();
      }

      return new Set(data.map((item: any) => item.entity_id as string));
    } catch {
      return new Set();
    }
  },
};
