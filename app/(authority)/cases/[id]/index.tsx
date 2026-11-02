import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import { useAuthStore } from '../../../../src/store/auth.store';
import { CasesService } from '../../../../src/services/cases.service';
import { Case, CaseStatus, ActType } from '../../../../src/types/database.types';

export default function AuthorityCaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  // Modal para resolución de caso
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');

  useEffect(() => {
    if (id) {
      loadCaseData();
    }
  }, [id]);

  const loadCaseData = async () => {
    try {
      const { data, error } = await CasesService.getCaseDetails(id as string);
      if (!error && data) {
        setCaseItem(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'open':
        return { label: 'Abierto', bg: '#EFF6FF', text: '#2563EB' };
      case 'under_investigation':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'resolved':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569' };
    }
  };

  const getActTypeLabel = (type: ActType) => {
    switch (type) {
      case 'interview_student':
        return 'Entrevista a Estudiante';
      case 'interview_parents':
        return 'Reunión con Padres / Tutores';
      case 'mediation':
        return 'Acta de Mediación / Diálogo';
      case 'psychological_referral':
        return 'Derivación Gabinete / EOE';
      case 'disciplinary_measure':
        return 'Medida Pedagógica / Sanción';
      case 'closure_agreement':
        return 'Acuerdo de Convivencia y Cierre';
      default:
        return type;
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

  const handleConfirmResolve = async () => {
    if (!caseItem || !profile) return;
    if (!resolutionSummary.trim() || resolutionSummary.trim().length < 15) {
      Alert.alert('Resumen insuficiente', 'Por favor ingresa las conclusiones y acuerdos alcanzados (mínimo 15 caracteres).');
      return;
    }

    setResolving(true);
    try {
      const { error } = await CasesService.resolveCase(
        caseItem.id,
        caseItem.report_id,
        resolutionSummary.trim(),
        profile.id,
        profile.institution_id
      );

      if (error) {
        Alert.alert('Error', error);
      } else {
        setResolveModalVisible(false);
        Alert.alert('Caso Finalizado', 'El caso ha sido concluido formalmente y el reporte asociado ha pasado a estado Finalizado.');
        loadCaseData();
      }
    } finally {
      setResolving(false);
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
          title: 'Expediente de Caso',
          headerBackTitle: 'Casos',
        }}
      />

      {/* Cabecera del Caso */}
      <Card style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.caseTitle}>{caseItem.title}</Text>
        <Text style={styles.caseDate}>Apertura: {formatDate(caseItem.created_at)}</Text>

        {caseItem.status !== 'resolved' && (
          <View style={styles.actionButtonsRow}>
            <Button
              title="➕ Labrar Nueva Acta"
              onPress={() => router.push(`/(authority)/cases/${caseItem.id}/acts/new` as any)}
              style={styles.actionBtn}
            />
            <Button
              title="✓ Finalizar Caso"
              variant="outline"
              onPress={() => setResolveModalVisible(true)}
              style={styles.actionBtn}
            />
          </View>
        )}

        {caseItem.status === 'resolved' && caseItem.resolution_summary && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionTitle}>Conclusión y Resolución Institucional:</Text>
            <Text style={styles.resolutionText}>{caseItem.resolution_summary}</Text>
          </View>
        )}
      </Card>

      {/* Reportes Vinculados */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>
          {caseItem.linked_reports && caseItem.linked_reports.length > 1
            ? `Reportes Vinculados (${caseItem.linked_reports.length})`
            : 'Reporte Vinculado'}
        </Text>
        {(caseItem.linked_reports && caseItem.linked_reports.length > 0
          ? caseItem.linked_reports
          : caseItem.report
          ? [caseItem.report]
          : []
        ).map((rep, idx) => (
          <View
            key={rep.id}
            style={
              idx > 0
                ? {
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#E2E8F0',
                  }
                : undefined
            }
          >
            <Text style={styles.reportDetail}>
              <Text style={styles.bold}>Estudiante:</Text> {rep.student?.first_name}{' '}
              {rep.student?.last_name} (DNI: {rep.student?.dni || 'S/D'})
            </Text>
            {rep.course && (
              <Text style={styles.reportDetail}>
                <Text style={styles.bold}>Curso:</Text> {rep.course.year}° "{rep.course.division}"{' '}
                ({rep.course.shift})
              </Text>
            )}
            <Text style={styles.reportDetail}>
              <Text style={styles.bold}>Situación:</Text> {rep.situation_type}
            </Text>
            <Text style={styles.reportDetail}>
              <Text style={styles.bold}>Hecho relatado:</Text> {rep.description}
            </Text>

            <Button
              title="Ver Reporte y Evidencia"
              variant="outline"
              onPress={() => router.push(`/(authority)/reports/${rep.id}` as any)}
              style={styles.viewReportBtn}
            />
          </View>
        ))}
      </Card>

      {/* Actas Digitales Labradas */}
      <Card style={styles.card}>
        <View style={styles.actsHeader}>
          <Text style={styles.sectionTitle}>
            Actas Digitales Labradas ({caseItem.acts?.length || 0})
          </Text>
          {caseItem.status !== 'resolved' && (
            <TouchableOpacity
              onPress={() => router.push(`/(authority)/cases/${caseItem.id}/acts/new` as any)}
            >
              <Text style={styles.addActLink}>+ Nueva Acta</Text>
            </TouchableOpacity>
          )}
        </View>

        {!caseItem.acts || caseItem.acts.length === 0 ? (
          <Text style={styles.emptyActsText}>
            Aún no se han registrado actas para este caso. Puedes labrar actas de entrevistas, reuniones con padres o derivaciones pedagógicas.
          </Text>
        ) : (
          <View style={styles.actsList}>
            {caseItem.acts.map((act) => (
              <View key={act.id} style={styles.actItem}>
                <View style={styles.actHeaderRow}>
                  <Text style={styles.actTypeTag}>{getActTypeLabel(act.act_type)}</Text>
                  <Text style={styles.actDate}>{formatDate(act.occurred_at)}</Text>
                </View>
                <Text style={styles.actTitle}>{act.title}</Text>
                <Text style={styles.actParticipants}>
                  <Text style={styles.bold}>Participantes:</Text> {act.participants}
                </Text>
                <Text style={styles.actContent}>{act.content}</Text>
                <Text style={styles.actAuthor}>
                  Labrada por: {act.creator?.first_name} {act.creator?.last_name} ({act.creator?.position || 'Autoridad'})
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Modal para Finalizar Caso */}
      <Modal visible={resolveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finalización y Cierre de Caso</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa las conclusiones, acuerdos pedagógicos alcanzados y medidas de seguimiento acordadas.
            </Text>

            <Input
              label="Resumen de Finalización / Acuerdos *"
              placeholder="Ej: Se realizaron las entrevistas pertinentes, se suscribió acta de compromiso de convivencia y se deriva a taller de integración..."
              value={resolutionSummary}
              onChangeText={setResolutionSummary}
              multiline
              numberOfLines={5}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setResolveModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Confirmar Finalización"
                onPress={handleConfirmResolve}
                style={styles.modalBtn}
                disabled={resolving}
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
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 12,
  },
  headerCard: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  protocolBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  caseDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
  },
  resolutionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
  },
  resolutionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  resolutionText: {
    fontSize: 13,
    color: '#14532D',
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'justify',
  },
  card: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  reportDetail: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
    lineHeight: 18,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: '700',
  },
  viewReportBtn: {
    marginTop: 10,
  },
  actsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addActLink: {
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyActsText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'justify',
  },
  actsList: {
    gap: 12,
  },
  actItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  actHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actTypeTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  actParticipants: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  actContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
    textAlign: 'justify',
  },
  actAuthor: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
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
    textAlign: 'justify',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
  },
});
