import { supabase } from './supabase';
import { ReportMessage, UserRole } from '../types/database.types';

export const MessagesService = {
  /**
   * Obtiene todos los mensajes de un reporte ordenados cronológicamente
   */
  async getMessages(reportId: string): Promise<{ data: ReportMessage[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('report_messages')
        .select(`
          *,
          sender:profiles!report_messages_sender_id_fkey(*)
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as ReportMessage[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Envía un nuevo mensaje dentro del reporte
   */
  async sendMessage(
    reportId: string,
    senderId: string,
    senderRole: UserRole,
    content: string
  ): Promise<{ data: ReportMessage | null; error: string | null }> {
    try {
      if (!content.trim()) {
        return { data: null, error: 'El contenido del mensaje no puede estar vacío.' };
      }

      const { data, error } = await supabase
        .from('report_messages')
        .insert({
          report_id: reportId,
          sender_id: senderId,
          sender_role: senderRole,
          content: content.trim(),
        })
        .select(`
          *,
          sender:profiles!report_messages_sender_id_fkey(*)
        `)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as ReportMessage, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Marca como leídos los mensajes enviados por la otra parte
   */
  async markMessagesAsRead(reportId: string, currentUserId: string): Promise<void> {
    try {
      await supabase
        .from('report_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('report_id', reportId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
    } catch (err) {
      console.log('Error silenciado marcando mensajes leídos:', err);
    }
  },

  /**
   * Obtiene la cantidad de mensajes no leídos para un reporte y usuario determinado
   */
  async getUnreadCount(reportId: string, currentUserId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('report_messages')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (error || count === null) return 0;
      return count;
    } catch {
      return 0;
    }
  },

  /**
   * Obtiene la cantidad de usuarios (estudiantes) que han enviado mensajes no leídos a la autoridad
   */
  async getUnreadStudentChatsCount(institutionId?: string): Promise<number> {
    try {
      let query = supabase
        .from('report_messages')
        .select(
          institutionId
            ? 'sender_id, report_id, reports!inner(institution_id)'
            : 'sender_id, report_id'
        )
        .eq('sender_role', 'student')
        .is('read_at', null);

      if (institutionId) {
        query = query.eq('reports.institution_id', institutionId);
      }

      const { data: messages, error } = await query;

      if (error || !messages || messages.length === 0) {
        return 0;
      }

      // Estudiantes únicos que enviaron mensajes no leídos
      const uniqueStudents = new Set((messages as any[]).map((m) => m.sender_id));
      return uniqueStudents.size;
    } catch {
      return 0;
    }
  },

  /**
   * Obtiene estadísticas de chat (total de mensajes y mensajes no leídos del estudiante)
   * agrupados por report_id para los reportes de la institución
   */
  async getReportsChatStats(): Promise<{
    unreadCounts: Record<string, number>;
    totalCounts: Record<string, number>;
  }> {
    try {
      const { data: messages, error } = await supabase
        .from('report_messages')
        .select('id, report_id, sender_role, read_at');

      if (error || !messages) {
        return { unreadCounts: {}, totalCounts: {} };
      }

      const unreadCounts: Record<string, number> = {};
      const totalCounts: Record<string, number> = {};

      for (const msg of messages) {
        if (!msg.report_id) continue;
        totalCounts[msg.report_id] = (totalCounts[msg.report_id] || 0) + 1;
        if (msg.sender_role === 'student' && !msg.read_at) {
          unreadCounts[msg.report_id] = (unreadCounts[msg.report_id] || 0) + 1;
        }
      }

      return { unreadCounts, totalCounts };
    } catch {
      return { unreadCounts: {}, totalCounts: {} };
    }
  },

  /**
   * Suscripción en tiempo real a nuevos mensajes del reporte
   */
  subscribeToMessages(
    reportId: string,
    onNewMessage: (message: ReportMessage) => void
  ) {
    const channel = supabase
      .channel(`report-chat-${reportId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_messages',
          filter: `report_id=eq.${reportId}`,
        },
        async (payload) => {
          // Obtener los datos del remitente para poblar el mensaje completo
          const newMsg = payload.new as ReportMessage;
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          if (senderProfile) {
            newMsg.sender = senderProfile;
          }

          onNewMessage(newMsg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
