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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { ReportsService } from '../../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../../src/types/database.types';

export default function StudentReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviado', bg: '#EFF6FF', text: '#2563EB', desc: 'El reporte fue registrado y está pendiente de revisión por el equipo directivo.' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706', desc: 'Las autoridades escolares están evaluando y dando seguimiento a la situación.' };
      case 'closed_no_case':
        return { label: 'Cerrado sin apertura', bg: '#F1F5F9', text: '#475569', desc: 'El reporte fue revisado y concluido sin iniciar un protocolo formal de caso.' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A', desc: 'El proceso o caso vinculado a este reporte ha concluido satisfactoriamente.' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569', desc: '' };
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
        title="← Volver a Mis Reportes"
        variant="outline"
        onPress={() => router.back()}
        style={styles.backNavButton}
      />

      {/* Estado del reporte */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Estado del Reporte</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.statusDescription}>{badge.desc}</Text>

        {report.status === 'closed_no_case' && report.close_reason && (
          <View style={styles.closeReasonBox}>
            <Text style={styles.closeReasonTitle}>Motivo indicado por la autoridad:</Text>
            <Text style={styles.closeReasonText}>{report.close_reason}</Text>
          </View>
        )}
      </Card>

      {/* Datos del reporte */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Detalles de la Situación</Text>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Tipo de situación:</Text>
          <Text style={styles.value}>{report.situation_type}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Lugar:</Text>
          <Text style={styles.value}>{report.location}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Fecha informada:</Text>
          <Text style={styles.value}>{formatDate(report.occurred_at)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Frecuencia:</Text>
          <Text style={styles.value}>{report.frequency}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Personas involucradas:</Text>
          <Text style={styles.value}>{report.involved_persons}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Relato de los hechos:</Text>
        <Text style={styles.descriptionText}>{report.description}</Text>
      </Card>

      {/* Evidencia Multimedia */}
      {report.attachments && report.attachments.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Evidencia Adjunta ({report.attachments.length})
          </Text>
          <View style={styles.attachmentsGrid}>
            {report.attachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                {att.file_type === 'image' && att.public_url ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(att.public_url!)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: att.public_url }} style={styles.imageThumbnail} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.videoThumbnail}
                    onPress={() => att.public_url && Linking.openURL(att.public_url)}
                  >
                    <Text style={styles.videoIcon}>🎥</Text>
                    <Text style={styles.videoText}>Reproducir Video</Text>
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

      {/* Nota de inmutabilidad */}
      <Card style={styles.footerNoteCard}>
        <Text style={styles.footerNoteText}>
          ℹ️ De acuerdo con el protocolo de Centinel, este reporte es inmutable y forma parte del registro institucional confidencial.
        </Text>
      </Card>
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
    backgroundColor: '#FFFFFF',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
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
  statusDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  closeReasonBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  closeReasonTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  closeReasonText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
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
  footerNoteCard: {
    padding: 14,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  footerNoteText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
});
