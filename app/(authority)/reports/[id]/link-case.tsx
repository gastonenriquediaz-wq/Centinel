import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../src/store/auth.store';
import { CasesService } from '../../../../src/services/cases.service';
import { ReportsService } from '../../../../src/services/reports.service';
import { Case, Report } from '../../../../src/types/database.types';

export default function LinkReportToCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkingCaseId, setLinkingCaseId] = useState<string | null>(null);

  const loadData = async () => {
    if (!id || !profile?.institution_id) {
      setLoading(false);
      return;
    }
    try {
      const [reportRes, casesRes] = await Promise.all([
        ReportsService.getReportDetails(id as string),
        CasesService.getInstitutionCases(profile.institution_id),
      ]);

      if (reportRes.data) {
        setCurrentReport(reportRes.data);
      }

      if (casesRes.data) {
        // Mostramos los casos activos (abiertos o en seguimiento institucional)
        const activeCases = casesRes.data.filter((c) => c.status !== 'resolved');
        setCases(activeCases);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, profile?.institution_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtrado reactivo por estudiante o por tipo de acoso / situación
  const filteredCases = useMemo(() => {
    let result = [...cases];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter((c) => {
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const protocolMatch = (c.protocol_level || '').toLowerCase().includes(q);

        // Datos del reporte original del caso
        const situationType = (c.report?.situation_type || '').toLowerCase();
        const description = (c.report?.description || '').toLowerCase();
        const studentName = `${c.report?.student?.first_name || ''} ${c.report?.student?.last_name || ''}`.toLowerCase();
        const studentDni = (c.report?.student?.dni || '').toLowerCase();
        const course = `${c.report?.course?.year || ''} ${c.report?.course?.division || ''}`.toLowerCase();

        // Datos de otros reportes que ya estuvieran vinculados al caso
        const linkedMatch = c.linked_reports?.some((lr) => {
          const lrSit = (lr.situation_type || '').toLowerCase();
          const lrName = `${lr.student?.first_name || ''} ${lr.student?.last_name || ''}`.toLowerCase();
          return lrSit.includes(q) || lrName.includes(q);
        });

        return (
          titleMatch ||
          protocolMatch ||
          situationType.includes(q) ||
          description.includes(q) ||
          studentName.includes(q) ||
          studentDni.includes(q) ||
          course.includes(q) ||
          linkedMatch
        );
      });
    }

    return result;
  }, [cases, searchQuery]);

  const handleSelectCase = (caseItem: Case) => {
    if (!currentReport || !profile) return;

    Alert.alert(
      'Vincular reporte a caso',
      `¿Deseás vincular este reporte al caso institucional "${caseItem.title}"?\n\nEl reporte pasará a estar en seguimiento bajo este caso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vincular caso',
          onPress: async () => {
            setLinkingCaseId(caseItem.id);
            try {
              const { error } = await CasesService.linkReportToCase(
                currentReport.id,
                caseItem.id,
                profile.id,
                profile.institution_id
              );
              if (error) {
                Alert.alert('Error', error);
              } else {
                Alert.alert(
                  'Reporte vinculado',
                  `El reporte ha sido vinculado exitosamente al caso "${caseItem.title}".`,
                  [
                    {
                      text: 'Aceptar',
                      onPress: () => {
                        router.back();
                      },
                    },
                  ]
                );
              }
            } finally {
              setLinkingCaseId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const month = months[d.getMonth()] || 'oct';
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Vincular a caso existente',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '700',
            color: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={filteredCases}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 30 },
        ]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Banner con contexto del reporte a vincular */}
            {currentReport && (
              <Card style={styles.contextCard}>
                <View style={styles.contextHeader}>
                  <Ionicons name="document-text" size={18} color="#1D4ED8" />
                  <Text style={styles.contextHeaderTitle}>Reporte a vincular</Text>
                </View>
                <Text style={styles.contextSituation}>
                  {currentReport.situation_type}
                </Text>
                <Text style={styles.contextStudent}>
                  Estudiante:{' '}
                  <Text style={styles.contextBold}>
                    {currentReport.student
                      ? `${currentReport.student.first_name} ${currentReport.student.last_name}`
                      : 'Estudiante'}
                  </Text>
                  {currentReport.course
                    ? ` (${currentReport.course.year}.° "${currentReport.course.division}")`
                    : ''}
                </Text>
              </Card>
            )}

            <Text style={styles.instructionText}>
              Buscá y seleccioná el caso institucional formal al que corresponde este hecho.
            </Text>

            {/* Buscador superior: estudiante o tipo de acoso escolar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por estudiante o tipo de acoso..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.resultsCountRow}>
              <Text style={styles.resultsCountText}>
                {filteredCases.length} caso{filteredCases.length !== 1 ? 's' : ''} disponible{filteredCases.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#1E3A8A" />
              <Text style={styles.loadingText}>Cargando casos disponibles...</Text>
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons
                name="folder-open-outline"
                size={44}
                color="#94A3B8"
                style={{ alignSelf: 'center', marginBottom: 10 }}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron coincidencias' : 'No hay casos activos'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No se encontró ningún caso que coincida con "${searchQuery}". Probá buscar por nombre de alumno o tipo de situación.`
                  : 'Actualmente no hay casos abiertos o en investigación para vincular este reporte. Podés crear uno nuevo con "Crear caso".'}
              </Text>
              {searchQuery.length > 0 ? (
                <Button
                  title="Limpiar búsqueda"
                  variant="outline"
                  onPress={() => setSearchQuery('')}
                  style={{ marginTop: 14 }}
                />
              ) : (
                <Button
                  title="Volver al reporte"
                  variant="outline"
                  onPress={() => router.back()}
                  style={{ marginTop: 14 }}
                />
              )}
            </Card>
          )
        }
        renderItem={({ item }) => {
          const isLinking = linkingCaseId === item.id;
          const statusLabel = item.status === 'under_investigation' ? 'En seguimiento' : 'Abierto';
          const isInvestigation = item.status === 'under_investigation';

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectCase(item)}
              disabled={!!linkingCaseId}
            >
              <Card style={styles.caseCard}>
                {/* Cabecera de la tarjeta: Título y Badges */}
                <View style={styles.caseCardHeader}>
                  <Text style={styles.caseTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isInvestigation ? styles.statusBadgeWarning : styles.statusBadgeOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isInvestigation ? styles.statusBadgeWarningText : styles.statusBadgeOpenText,
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Protocolo */}
                <View style={styles.metaRow}>
                  <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
                  <Text style={styles.protocolText} numberOfLines={1}>
                    {item.protocol_level || 'Protocolo institucional'}
                  </Text>
                </View>

                {/* Tipo de acoso / situación original */}
                {item.report?.situation_type && (
                  <View style={styles.metaRow}>
                    <Ionicons name="warning-outline" size={14} color="#D97706" />
                    <Text style={styles.situationText} numberOfLines={1}>
                      Tipo de acoso: <Text style={styles.situationBold}>{item.report.situation_type}</Text>
                    </Text>
                  </View>
                )}

                {/* Estudiante inicial del caso */}
                {item.report?.student && (
                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={14} color="#64748B" />
                    <Text style={styles.studentText} numberOfLines={1}>
                      Iniciado por: {item.report.student.first_name} {item.report.student.last_name}
                      {item.report.course ? ` · ${item.report.course.year}.° ${item.report.course.division}` : ''}
                    </Text>
                  </View>
                )}

                {/* Fecha */}
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text style={styles.dateText}>Iniciado el {formatDate(item.created_at)}</Text>
                </View>

                {/* Botón de acción */}
                <View style={styles.actionRow}>
                  <View style={styles.actionLeft}>
                    <Ionicons name="link" size={15} color="#1E3A8A" />
                    <Text style={styles.actionText}>
                      {isLinking ? 'Vinculando reporte...' : 'Tocar para vincular a este caso'}
                    </Text>
                  </View>
                  {isLinking ? (
                    <ActivityIndicator size="small" color="#1E3A8A" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#1E3A8A" />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBackBtn: {
    paddingRight: 12,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerSection: {
    marginBottom: 6,
  },
  contextCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contextHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextSituation: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  contextStudent: {
    fontSize: 13,
    color: '#334155',
  },
  contextBold: {
    fontWeight: '700',
    color: '#1E3A8A',
  },
  instructionText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  resultsCountRow: {
    marginBottom: 10,
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  caseCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  caseTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeOpen: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgeOpenText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusBadgeWarningText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  protocolText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2563EB',
    flex: 1,
  },
  situationText: {
    fontSize: 12.5,
    color: '#475569',
    flex: 1,
  },
  situationBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  studentText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
