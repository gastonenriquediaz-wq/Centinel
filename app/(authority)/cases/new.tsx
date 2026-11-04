import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { CasesService } from '../../../src/services/cases.service';
import { Report } from '../../../src/types/database.types';

export default function NewCaseScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { profile } = useAuthStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [initialObservation, setInitialObservation] = useState('');

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      const { data } = await ReportsService.getReportDetails(reportId as string);
      if (data) {
        setReport(data);
        // Título predeterminado según el tipo de situación del reporte
        setTitle(`Caso: ${data.situation_type}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSentDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || '';
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

  const getStatusBadge = (status?: string) => {
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
        return { label: status || 'En seguimiento', bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
    }
  };

  const getStudentText = () => {
    if (!report?.student) return 'Estudiante anónimo';
    return `${report.student.first_name} ${report.student.last_name}`;
  };

  const getCourseText = () => {
    if (!report?.course) return 'Sin curso asignado';
    const division = report.course.division ? ` ${report.course.division}` : '';
    const shift = report.course.shift ? ` · Turno ${report.course.shift.toLowerCase()}` : '';
    return `${report.course.year}.°${division}${shift}`;
  };

  const handleCreateCase = async () => {
    if (!title.trim() || title.trim().length < 5) {
      Alert.alert('Título requerido', 'Por favor ingresá un título descriptivo para la carátula del caso.');
      return;
    }

    if (!profile?.id || !profile.institution_id || !reportId) {
      Alert.alert('Error', 'Datos de sesión incompletos.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await CasesService.createCaseFromReport({
        institution_id: profile.institution_id,
        report_id: reportId as string,
        created_by: profile.id,
        title: title.trim(),
        protocol_level: 'Protocolo institucional',
        initial_observation: initialObservation.trim() || undefined,
      });

      if (error || !data) {
        Alert.alert('Error al abrir caso', error || 'No se pudo crear el caso.');
        return;
      }

      Alert.alert(
        'Caso creado con éxito',
        'Se ha iniciado el expediente formal de actuación vinculado al reporte.',
        [
          {
            text: 'Ir al Caso',
            onPress: () => router.replace(`/(authority)/cases/${data.id}` as any),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  const badge = getStatusBadge(report?.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Crear caso',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* 1. Tarjeta Reporte de Origen */}
      <View style={styles.originCard}>
        <View style={styles.originHeader}>
          <View style={styles.originIconContainer}>
            <Ionicons name="document-text-outline" size={24} color="#1E3A8A" />
          </View>
          <View style={styles.originHeaderTextContainer}>
            <Text style={styles.originTitle}>Reporte de origen</Text>
            <Text style={styles.originSituation}>{report?.situation_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.originMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={16} color="#64748B" style={styles.metaIcon} />
            <Text style={styles.metaText}>
              {getStudentText()} · {getCourseText()}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" style={styles.metaIcon} />
            <Text style={styles.metaText}>{formatSentDate(report?.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* 2. Formulario de Carátula */}
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Título del caso *</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Ej: Caso: Exclusión o aislamiento social"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.helperText}>
          Utilizá un título descriptivo sin incluir datos personales innecesarios.
        </Text>

        <Text style={[styles.inputLabel, { marginTop: 16 }]}>Observación inicial (opcional)</Text>
        <TextInput
          style={styles.textArea}
          value={initialObservation}
          onChangeText={setInitialObservation}
          placeholder="Información relevante para el seguimiento institucional..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* 3. Callout Información importante */}
      <View style={styles.infoCallout}>
        <Ionicons name="information-circle-outline" size={26} color="#1E3A8A" style={styles.calloutIcon} />
        <View style={styles.calloutTextContainer}>
          <Text style={styles.calloutTitle}>Información importante</Text>
          <Text style={styles.calloutDescription}>
            La creación del caso permite organizar las actuaciones institucionales y no implica confirmar automáticamente una situación de acoso escolar.
          </Text>
        </View>
      </View>

      {/* 4. Callout Estado inicial */}
      <View style={styles.infoCallout}>
        <Ionicons name="folder-outline" size={24} color="#1E3A8A" style={styles.calloutIcon} />
        <View style={styles.calloutTextContainer}>
          <Text style={styles.calloutTitle}>Estado inicial: Abierto</Text>
          <Text style={styles.calloutDescription}>
            El caso quedará vinculado con este reporte. Luego podrán registrarse las actuaciones, estudiantes involucrados y derivaciones correspondientes.
          </Text>
        </View>
      </View>

      {/* 5. Botón de Acción Principal */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleCreateCase}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Confirmar creación del caso</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  originCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  originHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  originIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  originHeaderTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  originTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  originSituation: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  originMeta: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    minHeight: 90,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  infoCallout: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  calloutIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  calloutTextContainer: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
