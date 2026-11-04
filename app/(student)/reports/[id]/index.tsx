import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../src/store/auth.store';
import { ReportsService } from '../../../../src/services/reports.service';
import { supabase } from '../../../../src/services/supabase';
import { Report, ReportStatus } from '../../../../src/types/database.types';

interface LinkedCaseSummary {
  id: string;
  status: string;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
}

export default function StudentReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [report, setReport] = useState<Report | null>(null);
  const [reportCode, setReportCode] = useState<string>('REP-0001');
  const [linkedCase, setLinkedCase] = useState<LinkedCaseSummary | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [totalMessagesCount, setTotalMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await ReportsService.getReportDetails(id as string);
      if (!error && data) {
        setReport(data);

        // 1. Obtener metadatos del expediente vinculado (si existe y RLS lo permite)
        let caseInfo: LinkedCaseSummary | null = null;
        if (data.case_id) {
          const { data: cData } = await supabase
            .from('cases')
            .select('id, status, resolution_summary, created_at, updated_at')
            .eq('id', data.case_id)
            .maybeSingle();
          if (cData) caseInfo = cData as LinkedCaseSummary;
        }
        if (!caseInfo) {
          const { data: cByReport } = await supabase
            .from('cases')
            .select('id, status, resolution_summary, created_at, updated_at')
            .eq('report_id', data.id)
            .maybeSingle();
          if (cByReport) caseInfo = cByReport as LinkedCaseSummary;
        }
        setLinkedCase(caseInfo);

        // 2. Obtener estado de mensajes en el canal con autoridades
        const { data: msgsData } = await supabase
          .from('report_messages')
          .select('id, sender_id, read_at')
          .eq('report_id', data.id);

        if (msgsData) {
          setTotalMessagesCount(msgsData.length);
          if (profile?.id) {
            const unread = msgsData.filter(
              (m: any) => m.sender_id !== profile.id && !m.read_at
            ).length;
            setUnreadMessagesCount(unread);
          }
        }

        // 3. Obtener correlativo cronológico de reporte (REP-000X)
        if (profile?.id) {
          const { data: allReports } = await ReportsService.getStudentReports(profile.id);
          if (allReports && allReports.length > 0) {
            const sorted = [...allReports].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const idx = sorted.findIndex((r) => r.id === data.id);
            if (idx !== -1) {
              setReportCode(`REP-${String(idx + 1).padStart(4, '0')}`);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return {
          label: 'Enviado',
          bg: '#EFF6FF',
          text: '#2563EB',
          desc: 'El reporte fue registrado y está pendiente de revisión por el equipo directivo.',
        };
      case 'in_progress':
        return {
          label: 'En seguimiento',
          bg: '#FEF3C7',
          text: '#D97706',
          desc: 'Las autoridades escolares están evaluando y dando seguimiento a la situación.',
        };
      case 'closed_no_case':
        return {
          label: 'Cerrado sin apertura',
          bg: '#FEE2E2',
          text: '#DC2626',
          desc: 'El reporte fue evaluado y concluido sin iniciar un protocolo formal de caso.',
        };
      case 'finalized':
        return {
          label: 'Finalizado',
          bg: '#F1F5F9',
          text: '#64748B',
          desc: 'El proceso o caso vinculado a este reporte ha concluido satisfactoriamente.',
        };
      default:
        return { label: status, bg: '#F1F5F9', text: '#64748B', desc: '' };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Parser inteligente para extraer los roles de personas involucradas
  const parseInvolvedPersons = (rawText: string) => {
    let afectado = 'El estudiante que reporta (yo)';
    let agresores = 'No identificados / Se desconoce quiénes fueron';
    let testigos = 'No informados';

    if (!rawText) {
      return { afectado, agresores, testigos };
    }

    // Dividir únicamente por | o saltos de línea para preservar elementos separados por comas o punto y coma
    const parts = rawText.split(/[|\n]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.startsWith('afectado:') || lower.startsWith('afectados:')) {
        const val = part.replace(/^afectados?:/i, '').trim();
        if (val.toLowerCase().includes('propio estudiante') || val.toLowerCase().includes('estudiante que reporta')) {
          afectado = 'El estudiante que reporta (yo)';
        } else if (val) {
          afectado = val;
        }
      } else if (lower.startsWith('agresores:') || lower.startsWith('participantes:')) {
        const val = part.replace(/^(agresores|participantes):/i, '').trim();
        if (val) agresores = val;
      } else if (lower.startsWith('testigos:') || lower.startsWith('personas que presenciaron:')) {
        const val = part.replace(/^(testigos|personas que presenciaron):/i, '').trim();
        if (val) testigos = val;
      }
    }

    // Si no contiene prefijos estructurados, asignarlo a agresores/participantes
    if (parts.length === 1 && !rawText.includes(':')) {
      agresores = rawText;
    }

    return { afectado, agresores, testigos };
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No se pudo cargar el reporte.</Text>
        <Button title="Volver" onPress={() => router.back()} style={styles.backButton} />
      </View>
    );
  }

  const badge = getStatusBadge(report.status);
  const involved = parseInvolvedPersons(report.involved_persons);
  const isReceived = report.status !== 'sent';
  const hasCase = Boolean(report.case_id || linkedCase);

  // Nivel de avance de 1 a 4 para la barra de progreso institucional
  const currentStepLevel =
    report.status === 'sent'
      ? 1
      : report.status === 'in_progress' && !hasCase
      ? 2
      : report.status === 'in_progress' && hasCase
      ? 3
      : 4;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 24) + 40 },
      ]}
    >
      <Stack.Screen options={{ title: 'Detalle de Reporte', headerBackTitle: 'Reportes' }} />

      {/* 1. Tarjeta Principal de Identificación y Estado */}
      <Card style={styles.mainCard}>
        <View style={styles.mainHeaderRow}>
          <View>
            <Text style={styles.reportSmallLabel}>Reporte</Text>
            <Text style={styles.reportCodeTitle}>{reportCode}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.statusDescription}>{badge.desc}</Text>

        <View style={styles.datesContainer}>
          {/* Fecha de envío */}
          <View style={styles.infoRow}>
            <View style={styles.iconBoxBlue}>
              <Ionicons name="calendar-outline" size={16} color="#2563EB" />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Fecha de envío</Text>
              <Text style={styles.infoValue}>{formatDate(report.created_at)}</Text>
            </View>
          </View>

          {/* Última actualización */}
          <View style={styles.infoRow}>
            <View style={styles.iconBoxBlue}>
              <Ionicons name="time-outline" size={16} color="#2563EB" />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Última actualización</Text>
              <Text style={styles.infoValue}>{formatDate(report.updated_at)}</Text>
            </View>
          </View>
        </View>

        {/* Botón de acceso al Chat */}
        <TouchableOpacity
          style={styles.chatNavButton}
          activeOpacity={0.8}
          onPress={() => router.push(`/(student)/reports/${report.id}/chat` as any)}
        >
          <View style={styles.chatBtnContent}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" style={styles.chatBtnIcon} />
            <Text style={styles.chatBtnText}>
              Mensajes con las Autoridades
              {totalMessagesCount > 0 ? ` (${totalMessagesCount})` : ''}
            </Text>
          </View>
          <View style={styles.chatBtnRightRow}>
            {unreadMessagesCount > 0 && (
              <View style={styles.unreadChatBadge}>
                <Text style={styles.unreadChatBadgeText}>
                  {unreadMessagesCount} {unreadMessagesCount === 1 ? 'nuevo' : 'nuevos'}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </Card>

      {/* 1.B Tarjeta de Retroalimentación y Acompañamiento Institucional */}
      <Card style={styles.feedbackCard}>
        <View style={styles.feedbackHeaderRow}>
          <View
            style={[
              styles.feedbackIconWrap,
              report.status === 'finalized'
                ? { backgroundColor: '#DCFCE7' }
                : hasCase
                ? { backgroundColor: '#E0F2FE' }
                : report.status === 'in_progress'
                ? { backgroundColor: '#FEF3C7' }
                : report.status === 'closed_no_case'
                ? { backgroundColor: '#FEE2E2' }
                : { backgroundColor: '#EFF6FF' },
            ]}
          >
            <Ionicons
              name={
                report.status === 'finalized'
                  ? 'checkmark-done-circle'
                  : hasCase
                  ? 'shield-checkmark'
                  : report.status === 'in_progress'
                  ? 'eye'
                  : report.status === 'closed_no_case'
                  ? 'information-circle'
                  : 'paper-plane'
              }
              size={22}
              color={
                report.status === 'finalized'
                  ? '#15803D'
                  : hasCase
                  ? '#0284C7'
                  : report.status === 'in_progress'
                  ? '#D97706'
                  : report.status === 'closed_no_case'
                  ? '#DC2626'
                  : '#2563EB'
              }
            />
          </View>
          <View style={styles.feedbackHeaderTextCol}>
            <Text style={styles.feedbackEyebrow}>Seguimiento Institucional</Text>
            <Text style={styles.feedbackTitle}>
              {report.status === 'finalized'
                ? 'Intervención Institucional Concluida'
                : hasCase
                ? 'Protocolo de Convivencia Escolar Activo'
                : report.status === 'in_progress'
                ? 'El Equipo Directivo está evaluando tu reporte'
                : report.status === 'closed_no_case'
                ? 'Reporte evaluado y cerrado sin expediente'
                : 'Comunicación recibida en canal confidencial'}
            </Text>
          </View>
        </View>

        {/* Barra de Progreso de 4 Etapas */}
        <View style={styles.stepperWrap}>
          {[
            { step: 1, label: 'Enviado' },
            { step: 2, label: 'En análisis' },
            { step: 3, label: 'Protocolo' },
            { step: 4, label: 'Cierre' },
          ].map((item, idx) => {
            const reached =
              report.status === 'closed_no_case'
                ? item.step !== 3
                : currentStepLevel >= item.step;
            const isCurrent =
              (report.status === 'sent' && item.step === 1) ||
              (report.status === 'in_progress' && !hasCase && item.step === 2) ||
              (report.status === 'in_progress' && hasCase && item.step === 3) ||
              ((report.status === 'finalized' || report.status === 'closed_no_case') &&
                item.step === 4);

            return (
              <React.Fragment key={item.step}>
                <View style={styles.stepItemCol}>
                  <View
                    style={[
                      styles.stepCircle,
                      reached && styles.stepCircleReached,
                      isCurrent && styles.stepCircleCurrent,
                    ]}
                  >
                    {reached ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stepNumberText}>{item.step}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabelText,
                      reached && styles.stepLabelTextReached,
                      isCurrent && styles.stepLabelTextCurrent,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                {idx < 3 && (
                  <View
                    style={[
                      styles.stepConnectorLine,
                      currentStepLevel > item.step && styles.stepConnectorLineActive,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Mensaje explicativo personalizado para el estudiante */}
        <View style={styles.feedbackBodyBox}>
          <Text style={styles.feedbackBodyText}>
            {report.status === 'sent' &&
              'Tu reporte ya ingresó de forma segura al sistema del colegio. Una autoridad escolar lo revisará a la brevedad. Si recordás algún dato adicional, podés escribirlo en "Mensajes con las Autoridades".'}
            {report.status === 'in_progress' &&
              !hasCase &&
              'Una autoridad educativa de tu colegio ya tomó conocimiento de lo que informaste y se encuentra realizando las primeras averiguaciones preventivas con absoluta reserva.'}
            {report.status === 'in_progress' &&
              hasCase &&
              'Tu reporte dio lugar a la apertura formal de un Expediente de Convivencia Escolar. El equipo directivo está llevando adelante actuaciones institucionales (entrevistas, citaciones o acuerdos pedagógicos) para abordar la situación y cuidarte.'}
            {report.status === 'finalized' &&
              'El equipo directivo completó las actuaciones del protocolo de convivencia vinculadas a tu reporte y dio por concluida la intervención institucional.'}
            {report.status === 'closed_no_case' &&
              'El equipo directivo evaluó la situación informada y determinó su cierre administrativo sin necesidad de abrir un expediente formal de caso.'}
          </Text>
        </View>

        {/* Síntesis de resolución (si está finalizado y tiene resumen) */}
        {report.status === 'finalized' && linkedCase?.resolution_summary && (
          <View style={styles.resolutionSummaryBox}>
            <View style={styles.resolutionSummaryHeader}>
              <Ionicons name="document-text-outline" size={16} color="#15803D" />
              <Text style={styles.resolutionSummaryTitle}>
                Constancia de resolución institucional
              </Text>
            </View>
            <Text style={styles.resolutionSummaryText}>
              {linkedCase.resolution_summary}
            </Text>
          </View>
        )}

        {/* Motivo de cierre sin caso (si está cerrado sin apertura) */}
        {report.status === 'closed_no_case' && report.close_reason && (
          <View style={styles.closeReasonBox}>
            <View style={styles.resolutionSummaryHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color="#B91C1C" />
              <Text style={[styles.resolutionSummaryTitle, { color: '#B91C1C' }]}>
                Motivo informado por la autoridad escolar
              </Text>
            </View>
            <Text style={[styles.resolutionSummaryText, { color: '#7F1D1D' }]}>
              {report.close_reason}
            </Text>
          </View>
        )}

        {/* Garantía de confidencialidad cuando hay protocolo activo */}
        {hasCase && (
          <View style={styles.confidentialityGuaranteeRow}>
            <Ionicons name="shield-half-outline" size={16} color="#0369A1" />
            <Text style={styles.confidentialityGuaranteeText}>
              Por resguardo de la privacidad escolar (Ley N° 26.892), el contenido detallado de las actas firmadas con otros alumnos o familias es reservado, pero tu situación cuenta con seguimiento oficial.
            </Text>
          </View>
        )}
      </Card>

      {/* 2. Detalles de la Situación */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeaderTitle}>Detalles de la Situación</Text>

        {/* Tipo de situación */}
        <View style={styles.detailRowWithIcon}>
          <View style={styles.iconBoxRed}>
            <Ionicons name="pricetag-outline" size={18} color="#EF4444" />
          </View>
          <View style={styles.detailTextCol}>
            <Text style={styles.detailFieldLabel}>Tipo de situación</Text>
            <Text style={styles.detailFieldValue}>{report.situation_type}</Text>
          </View>
        </View>

        {/* Lugar */}
        <View style={styles.detailRowWithIcon}>
          <View style={styles.iconBoxBlue}>
            <Ionicons name="location-outline" size={18} color="#2563EB" />
          </View>
          <View style={styles.detailTextCol}>
            <Text style={styles.detailFieldLabel}>Lugar</Text>
            <Text style={styles.detailFieldValue}>{report.location}</Text>
          </View>
        </View>

        {/* Fecha informada */}
        <View style={styles.detailRowWithIcon}>
          <View style={styles.iconBoxBlue}>
            <Ionicons name="calendar-outline" size={18} color="#2563EB" />
          </View>
          <View style={styles.detailTextCol}>
            <Text style={styles.detailFieldLabel}>Fecha informada</Text>
            <Text style={styles.detailFieldValue}>{formatDate(report.occurred_at)}</Text>
          </View>
        </View>

        {/* Frecuencia */}
        <View style={styles.detailRowWithIcon}>
          <View style={styles.iconBoxGreen}>
            <Ionicons name="pulse-outline" size={18} color="#10B981" />
          </View>
          <View style={styles.detailTextCol}>
            <Text style={styles.detailFieldLabel}>Frecuencia</Text>
            <Text style={styles.detailFieldValue}>{report.frequency}</Text>
          </View>
        </View>
      </Card>

      {/* 3. Personas Involucradas */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeaderTitle}>Personas involucradas</Text>

        {/* Afectado */}
        <View style={styles.personSubCard}>
          <View style={styles.iconBoxBlueSolid}>
            <Ionicons name="person" size={16} color="#2563EB" />
          </View>
          <View style={styles.personTextCol}>
            <Text style={styles.personRoleLabel}>Afectado</Text>
            <Text style={styles.personValueText}>{involved.afectado}</Text>
          </View>
        </View>

        {/* Agresores / Participantes */}
        <View style={styles.personSubCard}>
          <View style={styles.iconBoxRedSolid}>
            <Ionicons name="people" size={16} color="#EF4444" />
          </View>
          <View style={styles.personTextCol}>
            <Text style={styles.personRoleLabel}>Agresores / Participantes</Text>
            <Text style={styles.personValueText}>{involved.agresores}</Text>
          </View>
        </View>

        {/* Testigos */}
        <View style={styles.personSubCard}>
          <View style={styles.iconBoxPurpleSolid}>
            <Ionicons name="people-outline" size={16} color="#8B5CF6" />
          </View>
          <View style={styles.personTextCol}>
            <Text style={styles.personRoleLabel}>Testigos</Text>
            <Text style={styles.personValueText}>{involved.testigos}</Text>
          </View>
        </View>
      </Card>

      {/* 4. Relato de los hechos */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeaderTitle}>Relato de los hechos</Text>
        <View style={styles.relatoContainer}>
          <Text style={styles.relatoText}>{report.description}</Text>
        </View>
      </Card>

      {/* 5. Evidencia Adjunta */}
      {report.attachments && report.attachments.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.sectionHeaderWithIcon}>
            <View style={styles.iconBoxHeaderBlue}>
              <Ionicons name="attach-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.sectionHeaderTitleWithIcon}>
              Evidencia Adjunta ({report.attachments.length})
            </Text>
          </View>

          <View style={styles.attachmentsListContainer}>
            {report.attachments.map((att) => (
              <View key={att.id} style={styles.attachmentFullCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.attachmentPreviewTouchable}
                  onPress={() => {
                    if (!att.public_url) return;
                    if (att.file_type === 'image') {
                      setPreviewImage(att.public_url);
                    } else {
                      Linking.openURL(att.public_url);
                    }
                  }}
                >
                  {att.file_type === 'image' ? (
                    <View style={styles.imageWrapper}>
                      {att.public_url ? (
                        <Image
                          source={{ uri: att.public_url }}
                          style={styles.previewImageThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.previewImageThumb, styles.placeholderThumb]}>
                          <Text style={styles.placeholderIcon}>🖼️</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.videoThumbBox}>
                      <Ionicons name="videocam" size={32} color="#FFFFFF" />
                      <Text style={styles.videoThumbText}>Video</Text>
                    </View>
                  )}
                  <Text style={styles.attachmentFileName} numberOfLines={1}>
                    {att.original_name}
                  </Text>
                  <Text style={styles.attachmentFileSize}>
                    {(att.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                  </Text>
                </TouchableOpacity>

                {/* Botón Ver Archivo */}
                <TouchableOpacity
                  style={styles.viewFileButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!att.public_url) return;
                    if (att.file_type === 'image') {
                      setPreviewImage(att.public_url);
                    } else {
                      Linking.openURL(att.public_url);
                    }
                  }}
                >
                  <Ionicons name="eye-outline" size={16} color="#2563EB" style={styles.viewFileIcon} />
                  <Text style={styles.viewFileText}>Ver archivo</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* 6. Historial del Reporte (Línea de tiempo) */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderWithIcon}>
          <View style={styles.iconBoxHeaderBlue}>
            <Ionicons name="time-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.sectionHeaderTitleWithIcon}>Historial del Reporte</Text>
        </View>

        <View style={styles.timelineContainer}>
          {/* Nodo 1: Reporte enviado */}
          <View style={styles.timelineNode}>
            <View style={styles.timelineTrack}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineLine} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineDate}>{formatDate(report.created_at)}</Text>
              <Text style={styles.timelineStepTitle}>Reporte enviado</Text>
              <Text style={styles.timelineStepDesc}>
                El reporte fue registrado por el estudiante.
              </Text>
            </View>
          </View>

          {/* Nodo 2: Reporte recibido */}
          <View style={styles.timelineNode}>
            <View style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineDot,
                  isReceived ? styles.timelineDotActive : styles.timelineDotInactive,
                ]}
              />
              <View style={styles.timelineLine} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineDate}>
                {isReceived ? formatDate(report.updated_at) : 'Pendiente'}
              </Text>
              <Text style={styles.timelineStepTitle}>Reporte recibido por el Equipo Directivo</Text>
              <Text style={styles.timelineStepDesc}>
                {isReceived
                  ? 'Una autoridad educativa abrió el reporte y tomó conocimiento de la situación.'
                  : 'Pendiente de apertura por una autoridad educativa.'}
              </Text>
            </View>
          </View>

          {/* Nodo 3: Apertura de Protocolo de Convivencia (si aplica o en seguimiento) */}
          {report.status !== 'closed_no_case' && (
            <View style={styles.timelineNode}>
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.timelineDot,
                    hasCase ? styles.timelineDotActive : styles.timelineDotInactive,
                  ]}
                />
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>
                  {hasCase
                    ? formatDate(linkedCase?.created_at || report.updated_at)
                    : report.status === 'in_progress'
                    ? 'En evaluación preliminar'
                    : 'Pendiente'}
                </Text>
                <Text style={styles.timelineStepTitle}>
                  {hasCase
                    ? 'Protocolo de Convivencia Escolar activado'
                    : 'Intervención y protocolo institucional'}
                </Text>
                <Text style={styles.timelineStepDesc}>
                  {hasCase
                    ? 'Se abrió un expediente formal de caso con actuaciones institucionales (entrevistas, citaciones y seguimiento).'
                    : 'Si la situación requiere actuaciones formales, se vinculará a un expediente de convivencia.'}
                </Text>
              </View>
            </View>
          )}

          {/* Nodo 4: Estado actual / Conclusión */}
          <View style={styles.timelineNode}>
            <View style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineDot,
                  report.status === 'finalized' || report.status === 'closed_no_case'
                    ? styles.timelineDotActive
                    : styles.timelineDotInactive,
                ]}
              />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineDate}>
                {report.status === 'finalized' || report.status === 'closed_no_case'
                  ? formatDate(linkedCase?.updated_at || report.updated_at)
                  : 'En curso'}
              </Text>
              <Text style={styles.timelineStepTitle}>
                {report.status === 'in_progress'
                  ? 'Seguimiento activo'
                  : report.status === 'closed_no_case'
                  ? 'Cerrado sin apertura de expediente'
                  : report.status === 'finalized'
                  ? 'Intervención institucional finalizada'
                  : 'Resolución institucional'}
              </Text>
              <Text style={styles.timelineStepDesc}>
                {report.status === 'in_progress'
                  ? 'El equipo directivo continúa trabajando en la situación.'
                  : report.status === 'closed_no_case'
                  ? report.close_reason
                    ? `Motivo informado: ${report.close_reason}`
                    : 'El equipo directivo evaluó y cerró el reporte sin apertura formal de caso.'
                  : report.status === 'finalized'
                  ? 'Las actuaciones y acuerdos de convivencia del caso han concluido satisfactoriamente.'
                  : 'Se actualizará cuando concluya la intervención del equipo directivo.'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 7. Información Adicional */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderWithIcon}>
          <View style={styles.iconBoxHeaderBlue}>
            <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.sectionHeaderTitleWithIcon}>Información adicional</Text>
        </View>

        <View style={styles.immutableNoticeBox}>
          <View style={styles.iconBoxPurpleNotice}>
            <Ionicons name="lock-closed" size={18} color="#7C3AED" />
          </View>
          <Text style={styles.immutableNoticeText}>
            De acuerdo con el protocolo de Centinel, este reporte es inmutable y forma parte del registro institucional confidencial.
          </Text>
        </View>
      </Card>

      {/* Visor Modal de Imagen en Pantalla Completa */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.closeFullscreenBtn}
            onPress={() => setPreviewImage(null)}
          >
            <Text style={styles.closeFullscreenText}>✕ Cerrar</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  mainCard: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportSmallLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  reportCodeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'justify',
  },
  datesContainer: {
    gap: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBoxBlue: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBoxRed: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBoxGreen: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBoxBlueSolid: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBoxRedSolid: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBoxPurpleSolid: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 1,
  },
  chatNavButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBtnIcon: {
    marginRight: 8,
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  chatBtnRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadChatBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unreadChatBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  feedbackCard: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 14,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedbackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackHeaderTextCol: {
    flex: 1,
  },
  feedbackEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stepItemCol: {
    alignItems: 'center',
    width: 62,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleReached: {
    backgroundColor: '#2563EB',
  },
  stepCircleCurrent: {
    backgroundColor: '#1E3A8A',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stepLabelText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLabelTextReached: {
    color: '#1E293B',
  },
  stepLabelTextCurrent: {
    color: '#1E3A8A',
    fontWeight: '800',
  },
  stepConnectorLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 14,
  },
  stepConnectorLineActive: {
    backgroundColor: '#2563EB',
  },
  feedbackBodyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feedbackBodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    textAlign: 'justify',
  },
  resolutionSummaryBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  closeReasonBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  resolutionSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolutionSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resolutionSummaryText: {
    fontSize: 13,
    color: '#14532D',
    lineHeight: 19,
    textAlign: 'justify',
  },
  confidentialityGuaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 8,
  },
  confidentialityGuaranteeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#0369A1',
    lineHeight: 16,
    textAlign: 'justify',
  },
  card: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  sectionHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBoxHeaderBlue: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionHeaderTitleWithIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTextCol: {
    flex: 1,
  },
  detailFieldLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailFieldValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 1,
  },
  personSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  personTextCol: {
    flex: 1,
  },
  personRoleLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  personValueText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 2,
  },
  relatoContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  relatoText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    textAlign: 'justify',
  },
  attachmentsListContainer: {
    gap: 12,
  },
  attachmentFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
  },
  attachmentPreviewTouchable: {
    alignItems: 'flex-start',
  },
  imageWrapper: {
    width: 140,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  previewImageThumb: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  videoThumbBox: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  attachmentFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
    maxWidth: 140,
  },
  attachmentFileSize: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  viewFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  viewFileIcon: {
    marginRight: 6,
  },
  viewFileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineNode: {
    flexDirection: 'row',
  },
  timelineTrack: {
    alignItems: 'center',
    width: 20,
    marginRight: 10,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineDotActive: {
    backgroundColor: '#2563EB',
  },
  timelineDotInactive: {
    backgroundColor: '#94A3B8',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineDate: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  timelineStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  timelineStepDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'justify',
  },
  immutableNoticeBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBoxPurpleNotice: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  immutableNoticeText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
    textAlign: 'justify',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  closeFullscreenBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  closeFullscreenText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
