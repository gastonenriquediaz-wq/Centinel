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
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import { useAuthStore } from '../../../../src/store/auth.store';
import { ReportsService } from '../../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../../src/types/database.types';

export default function AuthorityReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        return { label: 'Enviado', bg: '#EFF6FF', text: '#2563EB' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'closed_no_case':
        return { label: 'Cerrado sin apertura', bg: '#F1F5F9', text: '#475569' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569' };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleSetInProgress = async () => {
    if (!report || !profile) return;
    Alert.alert(
      'Poner en Seguimiento',
      '¿Deseas cambiar el estado a "En seguimiento"? Esto indicará que el equipo directivo ha comenzado a atender la situación.',
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
      Alert.alert('Motivo insuficiente', 'Por favor ingresa una justificación fundamentada (mínimo 10 caracteres).');
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
        Alert.alert('Reporte Cerrado', 'Se ha cerrado el reporte sin apertura de caso con la debida constancia.');
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button
        title="← Volver al listado"
        variant="outline"
        onPress={() => router.back()}
        style={styles.backNavButton}
      />

      {/* Cabecera con Estado y Acciones de Transición */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.statusTitle}>Estado del Reporte</Text>
            <Text style={styles.reportIdText}>ID: {report.id.substring(0, 8)}...</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Botones de acción según estado */}
        {report.status === 'sent' && (
          <View style={styles.statusActionsRow}>
            <Button
              title="▶ Iniciar Seguimiento"
              onPress={handleSetInProgress}
              style={styles.actionBtn}
              disabled={updating}
            />
            <Button
              title="Cerrar sin caso"
              variant="outline"
              onPress={() => setCloseModalVisible(true)}
              style={styles.actionBtn}
              disabled={updating}
            />
          </View>
        )}

        {report.status === 'in_progress' && (
          <View style={styles.inProgressInfo}>
            <Text style={styles.inProgressText}>
              Este reporte está en etapa de seguimiento e investigación por las autoridades.
            </Text>
            <Button
              title="Cerrar sin apertura de caso"
              variant="outline"
              onPress={() => setCloseModalVisible(true)}
              style={styles.closeNoCaseBtn}
              disabled={updating}
            />
          </View>
        )}

        {report.status === 'closed_no_case' && report.close_reason && (
          <View style={styles.closedInfoBox}>
            <Text style={styles.closedInfoTitle}>Fundamento de cierre sin apertura de caso:</Text>
            <Text style={styles.closedInfoText}>{report.close_reason}</Text>
          </View>
        )}
      </Card>

      {/* Identificación del Alumno (Sin anonimato en Centinel) */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Identificación del Alumno Remitente</Text>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>
            {report.student?.first_name} {report.student?.last_name}
          </Text>
          <Text style={styles.studentField}>DNI: {report.student?.dni || 'No informado'}</Text>
          {report.course && (
            <Text style={styles.studentField}>
              Curso: {report.course.year}° división "{report.course.division}" ({report.course.shift})
            </Text>
          )}
          <Text style={styles.studentField}>
            Fecha de envío: {formatDate(report.created_at)}
          </Text>
        </View>
      </Card>

      {/* Detalles del Hecho */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Descripción de los Hechos</Text>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Tipo de situación:</Text>
          <Text style={styles.value}>{report.situation_type}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Lugar:</Text>
          <Text style={styles.value}>{report.location}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Fecha comunicada del incidente:</Text>
          <Text style={styles.value}>{formatDate(report.occurred_at)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Frecuencia:</Text>
          <Text style={styles.value}>{report.frequency}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Personas involucradas o testigos señalados:</Text>
          <Text style={styles.value}>{report.involved_persons}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Relato detallado:</Text>
        <Text style={styles.descriptionText}>{report.description}</Text>
      </Card>

      {/* Adjuntos Multimedia */}
      {report.attachments && report.attachments.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Evidencia Multimedia Adjunta ({report.attachments.length})
          </Text>
          <View style={styles.attachmentsGrid}>
            {report.attachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                {att.file_type === 'image' ? (
                  <TouchableOpacity
                    onPress={() => att.public_url && setPreviewImage(att.public_url)}
                    activeOpacity={0.8}
                  >
                    {att.public_url ? (
                      <Image
                        source={{ uri: att.public_url }}
                        style={styles.imageThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.imageThumbnail, styles.placeholderThumb]}>
                        <Text style={styles.placeholderIcon}>🖼️</Text>
                        <Text style={styles.placeholderText}>Cargando imagen...</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.videoThumbnail}
                    onPress={() => att.public_url && Linking.openURL(att.public_url)}
                  >
                    <Text style={styles.videoIcon}>🎥</Text>
                    <Text style={styles.videoText}>Abrir Video</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.fileName} numberOfLines={1}>
                  {att.original_name}
                </Text>
                <Text style={styles.fileSize}>
                  {(att.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Visor Modal de Imagen en Pantalla Completa */}
      <Modal visible={!!previewImage} transparent animationType="fade">
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

      {/* Modal para Cerrar sin apertura de caso con Justificación */}
      <Modal visible={closeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cerrar sin apertura de caso</Text>
            <Text style={styles.modalSubtitle}>
              Debes dejar constancia fundamentada de por qué este reporte se concluye sin iniciar un protocolo o caso formal.
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backNavButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButton: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  statusCard: {
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  reportIdText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
  },
  inProgressInfo: {
    gap: 8,
  },
  inProgressText: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '500',
  },
  closeNoCaseBtn: {
    marginTop: 4,
  },
  closedInfoBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  closedInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  closedInfoText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  studentDetails: {
    gap: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  studentField: {
    fontSize: 13,
    color: '#475569',
  },
  detailRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    color: '#1E293B',
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    marginTop: 4,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    alignItems: 'center',
  },
  imageThumbnail: {
    width: '100%',
    height: 110,
    borderRadius: 6,
  },
  videoThumbnail: {
    width: '100%',
    height: 110,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 32,
  },
  videoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 6,
  },
  fileSize: {
    fontSize: 11,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
  },
  placeholderThumb: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 24,
  },
  placeholderText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
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
