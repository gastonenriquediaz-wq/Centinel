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
import { Case, CaseAct } from '../../../../../src/types/database.types';
import { getActTypeLabel } from '../../../../../src/utils/textMigration';

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

  const getRoleBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('directivo') || r.includes('director')) {
      return { bg: '#EFF6FF', text: '#1E3A8A' };
    }
    if (r.includes('estudiante')) {
      return { bg: '#E0F2FE', text: '#0284C7' };
    }
    if (r.includes('familiar') || r.includes('padre') || r.includes('tutor') || r.includes('madre')) {
      return { bg: '#FEF3C7', text: '#D97706' };
    }
    if (r.includes('gabinete') || r.includes('eoe') || r.includes('orientador')) {
      return { bg: '#F3E8FF', text: '#7C3AED' };
    }
    if (r.includes('docente') || r.includes('preceptor')) {
      return { bg: '#DCFCE7', text: '#16A34A' };
    }
    return { bg: '#F1F5F9', text: '#475569' };
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
          title: 'Detalle de la Actuación',
          headerBackTitle: 'Expediente',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
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

      {/* 2. Tarjeta Principal de la Actuación */}
      <Card style={styles.actMainCard}>
        {/* Cabecera de la Actuación */}
        <View style={styles.actTopHeader}>
          <View style={styles.actBadge}>
            <Text style={styles.actBadgeText}>{getActTypeLabel(act.act_type, act.title)}</Text>
          </View>
          <View style={styles.actDateRow}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" style={styles.metaIcon} />
            <Text style={styles.actDateText}>{formatDateTime(act.occurred_at)}</Text>
          </View>
        </View>

        <Text style={styles.actTitle}>{act.title}</Text>

        {/* Participantes estructurados */}
        <View style={styles.sectionDivider} />
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="people-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
          <Text style={styles.sectionLabel}>Personas presentes / intervinientes</Text>
        </View>

        <View style={styles.participantsBox}>
          {act.participants.includes(';') ? (
            <View style={styles.participantsListCol}>
              {act.participants.split(';').map((pStr, i) => {
                const trimmed = pStr.trim();
                if (!trimmed) return null;
                const [rolePart, ...rest] = trimmed.split(':');
                const hasRole = rest.length > 0;
                const role = hasRole ? rolePart.trim() : 'Interviniente';
                const name = hasRole ? rest.join(':').trim() : trimmed;
                const bStyle = getRoleBadgeStyle(role);

                return (
                  <View key={i} style={styles.participantItemRow}>
                    <View style={[styles.participantRoleBadge, { backgroundColor: bStyle.bg }]}>
                      <Text style={[styles.participantRoleText, { color: bStyle.text }]}>
                        {role}
                      </Text>
                    </View>
                    <Text style={styles.participantNameText}>{name}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.participantsText}>{act.participants}</Text>
          )}
        </View>

        {/* Contenido Completo del Acta */}
        <View style={styles.sectionDivider} />
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="document-text-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
          <Text style={styles.sectionLabel}>Desarrollo y relato de la actuación</Text>
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
              {act.creator?.position ? ` (${act.creator.position})` : ' (Autoridad escolar)'}
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
            Esta actuación forma parte del expediente confidencial escolar, resguardada conforme a los
            protocolos de confidencialidad y el régimen de convivencia escolar.
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
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  caseContextCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  caseContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caseIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  caseContextTextContainer: {
    flex: 1,
  },
  caseContextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  caseContextTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  caseContextStudent: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  actMainCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  actBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
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
  },
  actTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 8,
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
    marginRight: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  participantsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  participantsListCol: {
    gap: 6,
  },
  participantItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  participantRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantNameText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  participantsText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  contentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contentText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
  },
  authorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  authorTextContainer: {
    flex: 1,
  },
  authorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  authorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#15803D',
    marginTop: 1,
  },
  createdDateText: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 2,
  },
  noticeCallout: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    padding: 12,
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
  },
  noticeDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  backButton: {
    marginTop: 8,
  },
});
