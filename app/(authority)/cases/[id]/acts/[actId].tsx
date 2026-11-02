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
import { Card } from '../../../../../src/components/ui/Card';
import { Button } from '../../../../../src/components/ui/Button';
import { CasesService } from '../../../../../src/services/cases.service';
import { Case, CaseAct, ActType } from '../../../../../src/types/database.types';

export default function AuthorityCaseActDetailScreen() {
  const { id, actId } = useLocalSearchParams<{ id: string; actId: string }>();
  const [act, setAct] = useState<CaseAct | null>(null);
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (actId) {
      loadActData();
    }
  }, [actId, id]);

  const loadActData = async () => {
    try {
      const [actRes, caseRes] = await Promise.all([
        CasesService.getCaseActDetails(actId as string),
        id ? CasesService.getCaseDetails(id as string) : Promise.resolve({ data: null, error: null }),
      ]);

      if (actRes.data) {
        setAct(actRes.data);
      }
      if (caseRes.data) {
        setCaseItem(caseRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const getActTypeLabel = (type?: ActType) => {
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
        return type || 'Acta de Actuación';
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
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
      return `${day} de ${month} de ${year} · ${hours}:${minutes} ${ampm}`;
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

  if (!act) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Detalle del Acta', headerBackTitle: 'Volver' }} />
        <Card style={styles.card}>
          <Text style={styles.emptyTitle}>Acta no encontrada</Text>
          <Text style={styles.emptyText}>
            No se pudo encontrar la información del acta digital solicitada.
          </Text>
          <Button title="Volver al Expediente" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Detalle del Acta',
          headerBackTitle: 'Expediente',
        }}
      />

      {/* 1. Contexto del Caso vinculado */}
      {caseItem && (
        <Card style={styles.caseContextCard}>
          <View style={styles.caseContextRow}>
            <View style={styles.caseIconContainer}>
              <Ionicons name="folder-outline" size={20} color="#1E3A8A" />
            </View>
            <View style={styles.caseContextTextContainer}>
              <Text style={styles.caseContextLabel}>Expediente vinculado</Text>
              <Text style={styles.caseContextTitle} numberOfLines={2}>
                {caseItem.title}
              </Text>
              {caseItem.report?.student && (
                <Text style={styles.caseContextStudent}>
                  👤 {caseItem.report.student.first_name} {caseItem.report.student.last_name}
                  {caseItem.report.course ? ` · ${caseItem.report.course.year}° "${caseItem.report.course.division}"` : ''}
                </Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* 2. Tarjeta Principal del Acta */}
      <Card style={styles.actMainCard}>
        {/* Cabecera del Acta */}
        <View style={styles.actTopHeader}>
          <View style={styles.actBadge}>
            <Text style={styles.actBadgeText}>{getActTypeLabel(act.act_type)}</Text>
          </View>
          <View style={styles.actDateRow}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" style={styles.metaIcon} />
            <Text style={styles.actDateText}>{formatDateTime(act.occurred_at)}</Text>
          </View>
        </View>

        <Text style={styles.actTitle}>{act.title}</Text>

        {/* Participantes */}
        <View style={styles.sectionDivider} />
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="people-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
          <Text style={styles.sectionLabel}>Participantes convocados / intervinientes</Text>
        </View>
        <View style={styles.participantsBox}>
          <Text style={styles.participantsText}>{act.participants}</Text>
        </View>

        {/* Contenido Completo del Acta */}
        <View style={styles.sectionDivider} />
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="document-text-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
          <Text style={styles.sectionLabel}>Relato de lo actuado y manifestaciones</Text>
        </View>
        <View style={styles.contentBox}>
          <Text style={styles.contentText}>{act.content}</Text>
        </View>

        {/* Firma digital y Responsable */}
        <View style={styles.sectionDivider} />
        <View style={styles.authorSection}>
          <View style={styles.authorIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color="#1E3A8A" />
          </View>
          <View style={styles.authorTextContainer}>
            <Text style={styles.authorLabel}>Responsable del labrado:</Text>
            <Text style={styles.authorName}>
              {act.creator?.first_name} {act.creator?.last_name}
              {act.creator?.position ? ` (${act.creator.position})` : ' (Autoridad Institucional)'}
            </Text>
            <Text style={styles.createdDateText}>
              Registro digital: {formatDateTime(act.created_at)}
            </Text>
          </View>
        </View>
      </Card>

      {/* 3. Callout Informativo de Reserva */}
      <View style={styles.noticeCallout}>
        <Ionicons name="lock-closed-outline" size={20} color="#1E3A8A" style={styles.noticeIcon} />
        <View style={styles.noticeTextContainer}>
          <Text style={styles.noticeTitle}>Documento confidencial escolar</Text>
          <Text style={styles.noticeDesc}>
            Esta acta digital forma parte de las actuaciones institucionales reservadas, resguardada conforme a los protocolos de confidencialidad y convivencia escolar.
          </Text>
        </View>
      </View>

      {/* 4. Botón de Regreso */}
      <Button
        title="Volver al Expediente"
        variant="outline"
        onPress={() => router.back()}
        style={styles.backButton}
      />
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
    backgroundColor: '#F8FAFC',
  },
  card: {
    padding: 16,
  },
  caseContextCard: {
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  caseContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caseIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  caseContextTextContainer: {
    flex: 1,
  },
  caseContextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    textTransform: 'uppercase',
  },
  caseContextTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  caseContextStudent: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  actMainCard: {
    padding: 18,
  },
  actTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  actBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  actDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 4,
  },
  actDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    lineHeight: 24,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  participantsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  participantsText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  contentBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
  },
  contentText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
    textAlign: 'justify',
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  authorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  authorTextContainer: {
    flex: 1,
  },
  authorLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  createdDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  noticeCallout: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  noticeDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  backButton: {
    marginTop: 4,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
});
