import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import { useAuthStore } from '../../../../src/store/auth.store';
import { ReportsService } from '../../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../../src/types/database.types';

export default function AuthorityReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal para cerrar sin apertura de caso
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    try {
      const { data, error } = await ReportsService.getReportDetails(id as string);
      if (!error && data) {
        setReport(data);
        // Registrar primera lectura en el audit log (Requisito I-02)
        ReportsService.logFirstOpened(data.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviado', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
      case 'closed_no_case':
        return { label: 'Cerrado sin apertura', bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
      default:
        return { label: status, bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' };
    }
  };

  // Formato: "Enviado el 29 de octubre de 2026 · 5:35 p. m."
  const formatSentDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
      ];
      const month = months[d.getMonth()] || 'octubre';
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
      hours = hours % 12 || 12;
      return `Enviado el ${day} de ${month} de ${year} · ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  // Formato: "28 de octubre de 2026, 9:00 p. m."
  const formatOccurredDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
      ];
      const month = months[d.getMonth()] || 'octubre';
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
      hours = hours % 12 || 12;
      return `${day} de ${month} de ${year}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.01) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const handleSetInProgress = async () => {
    if (!report || !profile) return;
    Alert.alert(
      'Poner en Seguimiento',
      '¿Deseás cambiar el estado a "En seguimiento"? Esto indicará que el equipo directivo ha comenzado a atender la situación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setUpdating(true);
            try {
              const { error } = await ReportsService.updateReportStatus(
                report.id,
                'in_progress',
                profile.id,
                profile.institution_id
              );
              if (error) {
                Alert.alert('Error', error);
              } else {
                Alert.alert('Éxito', 'El reporte ahora está en seguimiento.');
                loadReport();
              }
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmCloseNoCase = async () => {
    if (!report || !profile) return;
    if (!closeReason.trim() || closeReason.trim().length < 10) {
      Alert.alert(
        'Motivo insuficiente',
        'Por favor ingresá una justificación fundamentada (mínimo 10 caracteres).'
      );
      return;
    }

    setUpdating(true);
    try {
      const { error } = await ReportsService.updateReportStatus(
        report.id,
        'closed_no_case',
        profile.id,
        profile.institution_id,
        closeReason
      );
      if (error) {
        Alert.alert('Error', error);
      } else {
        setCloseModalVisible(false);
        setCloseReason('');
        Alert.alert(
          'Reporte Cerrado',
          'Se ha cerrado el reporte sin apertura de caso con la debida constancia.'
        );
        loadReport();
      }
    } finally {
      setUpdating(false);
    }
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
  const attachments = report.attachments || [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Detalle del reporte',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerNavBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Detalle de Auditoría',
                  `ID: ${report.id}\nEstado: ${report.status}\nFecha creación: ${report.created_at}`
                )
              }
              style={styles.headerNavBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-sharp" size={20} color="#BFDBFE" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
      >
        {/* CARD 1: ESTADO DEL REPORTE */}
        <Card style={styles.card}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.statusMainTitle}>Estado del reporte</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: badge.bg, borderColor: badge.border },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>
          <Text style={styles.statusDateSub}>{formatSentDate(report.created_at)}</Text>

          <View style={styles.cardDivider} />

          <Text style={styles.sectionMiniLabel}>TIPO DE SITUACIÓN</Text>
          <Text style={styles.situationTitle}>{report.situation_type}</Text>

          <View style={styles.infoAuditRow}>
            <Ionicons
              name="information-circle"
              size={15}
              color="#64748B"
              style={{ marginRight: 6, marginTop: 1 }}
            />
            <Text style={styles.infoAuditText}>
              Primera apertura registrada en el historial del sistema.
            </Text>
          </View>

          {/* Botón principal: Mensajes con el estudiante */}
          <TouchableOpacity
            style={styles.chatPrimaryBtn}
            onPress={() => router.push(`/(authority)/reports/${report.id}/chat` as any)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.chatPrimaryBtnText}>Mensajes con el estudiante</Text>
          </TouchableOpacity>

          {/* Botones de acción según el estado */}
          {report.status === 'sent' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtnFilled, updating && { opacity: 0.6 }]}
                onPress={handleSetInProgress}
                disabled={updating}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnFilledText}>Iniciar seguimiento</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtnOutline, updating && { opacity: 0.6 }]}
                onPress={() => setCloseModalVisible(true)}
                disabled={updating}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnOutlineText}>Cerrar sin apertura de caso</Text>
              </TouchableOpacity>
            </View>
          )}

          {report.status === 'in_progress' && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.actionsRow}>
                {report.case_id ? (
                  <TouchableOpacity
                    style={styles.actionBtnFilled}
                    onPress={() => router.push(`/(authority)/cases/${report.case_id}` as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="folder-open" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnFilledText}>Ver caso vinculado</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionBtnFilled}
                    onPress={() =>
                      router.push(`/(authority)/cases/new?reportId=${report.id}` as any)
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="folder-open" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnFilledText}>Abrir caso formal</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionBtnOutline}
                  onPress={() => setCloseModalVisible(true)}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnOutlineText}>Cerrar sin caso</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {report.status === 'closed_no_case' && report.close_reason && (
            <View style={styles.closedReasonBox}>
              <Text style={styles.closedReasonTitle}>Fundamento de cierre sin apertura de caso:</Text>
              <Text style={styles.closedReasonText}>{report.close_reason}</Text>
            </View>
          )}
        </Card>

        {/* CARD 2: ESTUDIANTE QUE REALIZÓ EL REPORTE */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Estudiante que realizó el reporte</Text>
          <View style={styles.studentInfoRow}>
            <View style={styles.studentAvatarBox}>
              <Ionicons name="person" size={24} color="#2563EB" />
            </View>
            <View style={styles.studentMetaBox}>
              <Text style={styles.studentFullName}>
                {report.student
                  ? `${report.student.first_name} ${report.student.last_name}`
                  : 'Estudiante'}
              </Text>
              <Text style={styles.studentMetaDetail}>
                DNI: {report.student?.dni || 'No informado'}
              </Text>
              {report.course && (
                <Text style={styles.studentMetaDetail}>
                  Curso: {report.course.year}° división "{report.course.division}" ({report.course.shift})
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* CARD 3: INFORMACIÓN DEL REPORTE */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Información del reporte</Text>

          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>LUGAR:</Text>
            <Text style={styles.fieldValue}>{report.location}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>FECHA COMUNICADA DEL INCIDENTE:</Text>
            <Text style={styles.fieldValue}>{formatOccurredDate(report.occurred_at)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>FRECUENCIA:</Text>
            <Text style={styles.fieldValue}>{report.frequency}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>PERSONAS MENCIONADAS:</Text>
            <Text style={styles.fieldValue}>{report.involved_persons}</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>RELATO DEL ESTUDIANTE:</Text>
            <Text style={styles.fieldValueDescription}>{report.description}</Text>
          </View>
        </Card>

        {/* CARD 4: ARCHIVOS ADJUNTOS */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>
            Archivos adjuntos ({attachments.length})
          </Text>

          {attachments.length === 0 ? (
            <Text style={styles.noAttachmentsText}>
              El estudiante no adjuntó imágenes ni videos en este reporte.
            </Text>
          ) : (
            <View style={styles.attachmentsList}>
              {attachments.map((att) => (
                <TouchableOpacity
                  key={att.id}
                  style={styles.attachmentCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (!att.public_url) return;
                    if (att.file_type === 'image') {
                      setPreviewImage(att.public_url);
                    } else {
                      Linking.openURL(att.public_url);
                    }
                  }}
                >
                  {/* Miniatura visual */}
                  {att.file_type === 'image' && att.public_url ? (
                    <Image
                      source={{ uri: att.public_url }}
                      style={styles.attThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.attThumbnail, styles.attPlaceholder]}>
                      <Ionicons
                        name={att.file_type === 'video' ? 'videocam' : 'image'}
                        size={24}
                        color="#2563EB"
                      />
                    </View>
                  )}

                  {/* Datos del archivo */}
                  <View style={styles.attMeta}>
                    <Text style={styles.attName} numberOfLines={1}>
                      {att.original_name}
                    </Text>
                    <Text style={styles.attSize}>
                      {formatFileSize(att.file_size_bytes)}
                    </Text>
                    <Text style={styles.attLink}>Tocar para ver</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* MODAL: VISOR DE IMAGEN EN PANTALLA COMPLETA */}
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

      {/* MODAL: CERRAR SIN APERTURA DE CASO */}
      <Modal visible={closeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cerrar sin apertura de caso</Text>
            <Text style={styles.modalSubtitle}>
              Debés dejar constancia fundamentada de por qué este reporte se concluye sin iniciar un protocolo o caso formal.
            </Text>

            <Input
              label="Fundamentación / Motivo de cierre *"
              placeholder="Ej: Se convocó a los alumnos y se constató que fue un malentendido resuelto en mediación escolar..."
              value={closeReason}
              onChangeText={setCloseReason}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setCloseModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Confirmar Cierre"
                onPress={handleConfirmCloseNoCase}
                style={styles.modalBtn}
                disabled={updating}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 14,
  },
  headerNavBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#991B1B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusMainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusDateSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  sectionMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  situationTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  infoAuditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  infoAuditText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
  chatPrimaryBtn: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  chatPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnFilled: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  actionBtnFilledText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnOutline: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  actionBtnOutlineText: {
    color: '#1E3A8A',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  closedReasonBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closedReasonTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  closedReasonText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentMetaBox: {
    flex: 1,
  },
  studentFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  studentMetaDetail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  fieldLabel: {
    width: 140,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    lineHeight: 18,
  },
  fieldValueDescription: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  noAttachmentsText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  attachmentsList: {
    gap: 10,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  attThumbnail: {
    width: 85,
    height: 65,
    borderRadius: 8,
  },
  attPlaceholder: {
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attMeta: {
    flex: 1,
  },
  attName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  attSize: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  attLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullscreenBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeFullscreenText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  fullscreenImage: {
    width: '95%',
    height: '80%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
  },
});
