import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { CasesService } from '../../../../src/services/cases.service';
import { Case, CaseStatus } from '../../../../src/types/database.types';

export default function AuthorityCaseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const { data: caseData } = await CasesService.getCaseDetails(id as string);
      if (caseData) {
        setCaseItem(caseData);
        const actIds = caseData.acts?.map((a) => a.id) || [];
        const reportIds = [
          caseData.report_id,
          ...(caseData.linked_reports?.map((r) => r.id) || []),
        ].filter(Boolean);

        const { data: historyLogs } = await CasesService.getCaseHistory(
          caseData.id,
          actIds,
          reportIds
        );

        let finalLogs = historyLogs || [];

        // Si no hubiera logs aún en la base de datos para casos antiguos, generamos un evento sintético de apertura
        if (finalLogs.length === 0) {
          finalLogs = [
            {
              id: 'initial_open',
              action: 'case_opened',
              created_at: caseData.created_at,
              performer: caseData.creator,
              details: {
                initial_observation: 'Apertura inicial del expediente formal.',
              },
            },
          ];
        }

        setLogs(finalLogs);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status?: CaseStatus) => {
    switch (status) {
      case 'open':
        return { label: 'Abierto', bg: '#EFF6FF', text: '#2563EB' };
      case 'under_investigation':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'resolved':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { label: status || 'Abierto', bg: '#F1F5F9', text: '#475569' };
    }
  };

  const getActionConfig = (log: any) => {
    switch (log.action) {
      case 'case_opened':
        return {
          icon: 'folder-open-outline' as const,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          badgeText: 'Apertura de caso',
          badgeBg: '#EFF6FF',
          badgeColor: '#2563EB',
          title: 'Apertura formal del expediente',
          description:
            log.details?.initial_observation ||
            'Se inició el expediente formal para el abordaje institucional y seguimiento escolar.',
        };
      case 'act_created':
        return {
          icon: 'document-text-outline' as const,
          iconColor: '#7C3AED',
          iconBg: '#F3E8FF',
          badgeText: 'Actuación',
          badgeBg: '#F3E8FF',
          badgeColor: '#7C3AED',
          title: log.details?.title
            ? `Actuación: ${log.details.title}`
            : 'Acta digital labrada',
          description: log.details?.participants
            ? `Participantes convocados: ${log.details.participants}`
            : 'Se registró una nueva actuación en el expediente.',
        };
      case 'student_added':
        return {
          icon: 'person-add-outline' as const,
          iconColor: '#0284C7',
          iconBg: '#E0F2FE',
          badgeText: 'Estudiante incorporado',
          badgeBg: '#E0F2FE',
          badgeColor: '#0284C7',
          title: `Inclusión: ${log.details?.student_name || 'Estudiante'}`,
          description: `Rol: ${log.details?.role || 'Involucrado'}${
            log.details?.course ? ` · Curso: ${log.details.course}` : ''
          }${log.details?.notes ? ` · Nota: ${log.details.notes}` : ''}`,
        };
      case 'report_linked_to_case':
        return {
          icon: 'link-outline' as const,
          iconColor: '#D97706',
          iconBg: '#FEF3C7',
          badgeText: 'Reporte vinculado',
          badgeBg: '#FEF3C7',
          badgeColor: '#D97706',
          title: 'Vinculación de reporte',
          description:
            'Se unificó un reporte conexo al expediente para su abordaje institucional conjunto.',
        };
      case 'case_resolved':
        return {
          icon: 'checkmark-circle-outline' as const,
          iconColor: '#16A34A',
          iconBg: '#DCFCE7',
          badgeText: 'Caso finalizado',
          badgeBg: '#DCFCE7',
          badgeColor: '#16A34A',
          title: 'Conclusión formal del expediente',
          description:
            log.details?.resolution_summary ||
            'El caso concluyó formalmente con acuerdos de convivencia y medidas pedagógicas registradas.',
        };
      default:
        return {
          icon: 'time-outline' as const,
          iconColor: '#475569',
          iconBg: '#F1F5F9',
          badgeText: 'Registro de actividad',
          badgeBg: '#F1F5F9',
          badgeColor: '#475569',
          title: log.action || 'Operación institucional',
          description: 'Registro de auditoría escolar.',
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (!caseItem) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No se pudo cargar el caso.</Text>
        <Button title="Volver" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    );
  }

  const badge = getStatusBadge(caseItem.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Historial de operaciones',
          headerBackTitle: 'Expediente',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* Tarjeta de contexto del Caso */}
      <Card style={styles.caseContextCard}>
        <View style={styles.contextHeader}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <Text style={styles.operationsCount}>
            {logs.length} {logs.length === 1 ? 'operación' : 'operaciones'}
          </Text>
        </View>

        <Text style={styles.caseTitle}>{caseItem.title}</Text>
        <Text style={styles.contextSubtitle}>
          Registro formal de movimientos, intervenciones pedagógicas y actuaciones institucionales
          para el resguardo de los derechos y bienestar de los alumnos.
        </Text>
      </Card>

      {/* Línea de tiempo de Operaciones */}
      <View style={styles.timelineContainer}>
        {logs.map((log, index) => {
          const config = getActionConfig(log);
          const isLast = index === logs.length - 1;
          const performerName = log.performer
            ? `${log.performer.first_name} ${log.performer.last_name}`
            : 'Autoridad escolar';
          const performerRole = log.performer?.position || 'Autoridad escolar';

          return (
            <View key={log.id || index} style={styles.timelineItem}>
              {/* Barra lateral con círculo e hilo conector */}
              <View style={styles.timelineLineCol}>
                <View style={[styles.timelineIconWrap, { backgroundColor: config.iconBg }]}>
                  <Ionicons name={config.icon} size={18} color={config.iconColor} />
                </View>
                {!isLast && <View style={styles.timelineLine} />}
              </View>

              {/* Tarjeta del evento */}
              <View style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={[styles.eventBadge, { backgroundColor: config.badgeBg }]}>
                    <Text style={[styles.eventBadgeText, { color: config.badgeColor }]}>
                      {config.badgeText}
                    </Text>
                  </View>
                  <Text style={styles.eventDate}>{formatDate(log.created_at)}</Text>
                </View>

                <Text style={styles.eventTitle}>{config.title}</Text>
                <Text style={styles.eventDescription}>{config.description}</Text>

                <View style={styles.eventFooter}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#64748B" />
                  <Text style={styles.performerText}>
                    {performerName} · <Text style={styles.performerRole}>{performerRole}</Text>
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Nota institucional de resguardo */}
      <Card style={styles.safeguardCard}>
        <View style={styles.safeguardRow}>
          <Ionicons name="information-circle-outline" size={22} color="#1E3A8A" />
          <View style={styles.safeguardContent}>
            <Text style={styles.safeguardTitle}>Garantía de confidencialidad y debido proceso</Text>
            <Text style={styles.safeguardText}>
              Este registro es estrictamente confidencial. Toda intervención debe priorizar el
              interés superior del menor, protegiendo tanto a los estudiantes afectados como a los
              señalados, garantizando un marco pedagógico de contención y convivencia escolar.
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    minWidth: 120,
  },
  caseContextCard: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  operationsCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  caseTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  contextSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  timelineContainer: {
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLineCol: {
    alignItems: 'center',
    width: 38,
    marginRight: 10,
  },
  timelineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 2,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#CBD5E1',
    marginTop: 4,
    marginBottom: -8,
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventDate: {
    fontSize: 12,
    color: '#64748B',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  performerText: {
    fontSize: 12,
    color: '#64748B',
  },
  performerRole: {
    fontWeight: '600',
    color: '#475569',
  },
  safeguardCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#E0E7FF',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  safeguardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  safeguardContent: {
    flex: 1,
    marginLeft: 12,
  },
  safeguardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  safeguardText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
