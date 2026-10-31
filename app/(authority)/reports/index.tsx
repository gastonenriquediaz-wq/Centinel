import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../src/types/database.types';

type FilterType = 'all' | 'sent' | 'in_progress' | 'closed_no_case' | 'finalized';

export default function AuthorityReportsList() {
  const { profile } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de búsqueda, filtros y ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [sortAscending, setSortAscending] = useState(false); // false = más recientes primero

  // Conjunto de reportes leídos/abiertos durante la sesión
  const [openedReportIds, setOpenedReportIds] = useState<Set<string>>(new Set());

  const loadReports = async () => {
    if (!profile?.institution_id) return;
    try {
      // Cargamos todos los reportes de la institución para permitir filtrado reactivo rápido en cliente
      const { data, error } = await ReportsService.getInstitutionReports(profile.institution_id);
      if (!error && data) {
        setReports(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadReports();
  }, [profile?.institution_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const formatReportDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['oct', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const month = months[d.getMonth()] || 'oct';
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} ${year} · ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviado', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
      case 'closed_no_case':
        return { label: 'Cerrado', bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
      default:
        return { label: status, bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' };
    }
  };

  // Filtrado y búsqueda
  const filteredAndSortedReports = useMemo(() => {
    let result = [...reports];

    // 1. Filtro por estado
    if (selectedFilter !== 'all') {
      result = result.filter((r) => r.status === selectedFilter);
    }

    // 2. Filtro por buscador: estudiante o curso
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((r) => {
        const studentFullName = `${r.student?.first_name || ''} ${r.student?.last_name || ''}`.toLowerCase();
        const studentDni = (r.student?.dni || '').toLowerCase();

        const courseYear = r.course?.year ? String(r.course.year) : '';
        const courseDiv = r.course?.division ? r.course.division.toLowerCase() : '';
        const courseShift = r.course?.shift ? r.course.shift.toLowerCase() : '';
        const courseCombined = `${courseYear}° ${courseDiv} ${courseYear} ${courseDiv} ${courseShift}`.toLowerCase();

        const situation = (r.situation_type || '').toLowerCase();

        return (
          studentFullName.includes(query) ||
          studentDni.includes(query) ||
          courseCombined.includes(query) ||
          situation.includes(query)
        );
      });
    }

    // 3. Ordenamiento por fecha
    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortAscending ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [reports, selectedFilter, searchQuery, sortAscending]);

  const handleOpenReport = (reportId: string) => {
    setOpenedReportIds((prev) => {
      const updated = new Set(prev);
      updated.add(reportId);
      return updated;
    });
    router.push(`/(authority)/reports/${reportId}` as any);
  };

  const handleMoreFilters = () => {
    Alert.alert(
      'Más filtros de estado',
      'Seleccioná un estado adicional para filtrar los reportes:',
      [
        {
          text: 'Cerrados sin apertura',
          onPress: () => setSelectedFilter('closed_no_case'),
        },
        {
          text: 'Finalizados',
          onPress: () => setSelectedFilter('finalized'),
        },
        {
          text: 'Ver todos',
          onPress: () => setSelectedFilter('all'),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Reportes recibidos',
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
              onPress={() => router.replace('/(authority)')}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={filteredAndSortedReports}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.subtitle}>Consultá las situaciones comunicadas por estudiantes.</Text>

            {/* Buscador superior: "Buscar por estudiante o curso" */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por estudiante o curso"
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

            {/* Fila de Filtros tipo Chips */}
            <View style={styles.filterRow}>
              {/* Todos */}
              <TouchableOpacity
                style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipSelected]}
                onPress={() => setSelectedFilter('all')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === 'all' && styles.filterChipTextSelected,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>

              {/* Enviado */}
              <TouchableOpacity
                style={[styles.filterChip, selectedFilter === 'sent' && styles.filterChipSelected]}
                onPress={() => setSelectedFilter('sent')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === 'sent' && styles.filterChipTextSelected,
                  ]}
                >
                  Enviado
                </Text>
              </TouchableOpacity>

              {/* En seguimiento */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedFilter === 'in_progress' && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedFilter('in_progress')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === 'in_progress' && styles.filterChipTextSelected,
                  ]}
                >
                  En seguimiento
                </Text>
              </TouchableOpacity>

              {/* Más filtros */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (selectedFilter === 'closed_no_case' || selectedFilter === 'finalized') &&
                    styles.filterChipSelected,
                ]}
                onPress={handleMoreFilters}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    (selectedFilter === 'closed_no_case' || selectedFilter === 'finalized') &&
                      styles.filterChipTextSelected,
                  ]}
                >
                  {selectedFilter === 'closed_no_case'
                    ? 'Cerrado'
                    : selectedFilter === 'finalized'
                    ? 'Finalizado'
                    : 'Más filtros'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ordenamiento por fecha */}
            <View style={styles.sortRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSortAscending((prev) => !prev)}
                style={styles.sortButton}
              >
                <Ionicons name="swap-vertical" size={16} color="#1D4ED8" />
                <Text style={styles.sortText}>
                  {sortAscending ? 'Más antiguos primero' : 'Más recientes primero'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#1D4ED8" />
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="document-text-outline"
                  size={42}
                  color="#94A3B8"
                  style={{ alignSelf: 'center', marginBottom: 10 }}
                />
                <Text style={styles.emptyTitle}>No se encontraron reportes</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No hay reportes que coincidan con "${searchQuery}". Probá buscar por nombre de estudiante o curso.`
                    : 'Los reportes recibidos de los alumnos aparecerán organizados en esta bandeja.'}
                </Text>
                {searchQuery.length > 0 && (
                  <Button
                    title="Limpiar búsqueda"
                    variant="outline"
                    onPress={() => setSearchQuery('')}
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>
            </View>
          )
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const isUnopened = !openedReportIds.has(item.id) && item.status === 'sent';
          const attachmentCount = item.attachments?.length || 0;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleOpenReport(item.id)}
            >
              <Card style={styles.reportCard}>
                {/* Insignia "Sin abrir" cuando corresponde */}
                {isUnopened && (
                  <View style={styles.unopenedBadge}>
                    <Text style={styles.unopenedBadgeText}>Sin abrir</Text>
                  </View>
                )}

                {/* Título de la situación y badge de estado */}
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.situationTitle}>{item.situation_type}</Text>
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

                {/* Identificación del estudiante y curso */}
                <View style={styles.studentInfoRow}>
                  <Ionicons name="person" size={14} color="#2563EB" style={styles.infoIcon} />
                  <Text style={styles.studentInfoText} numberOfLines={1}>
                    <Text style={styles.studentNameHighlight}>
                      {item.student
                        ? `${item.student.first_name} ${item.student.last_name}`
                        : 'Estudiante'}
                    </Text>
                    {item.course
                      ? ` · ${item.course.year}.° ${item.course.division} · ${item.course.shift}`
                      : ''}
                  </Text>
                </View>

                {/* Ubicación y Fecha */}
                <View style={styles.locationDateRow}>
                  <View style={styles.metaSubRow}>
                    <Ionicons
                      name="location-sharp"
                      size={14}
                      color="#64748B"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                  <Text style={styles.pipeSeparator}>│</Text>
                  <View style={styles.metaSubRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#64748B"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.dateText}>{formatReportDate(item.created_at)}</Text>
                  </View>
                </View>

                {/* Barra inferior de adjuntos */}
                <View style={styles.attachmentsBar}>
                  <View style={styles.attachmentsBarLeft}>
                    <Ionicons name="attach-outline" size={16} color="#2563EB" />
                    <Text style={styles.attachmentsBarText}>
                      {attachmentCount > 0
                        ? `${attachmentCount} adjunto${attachmentCount > 1 ? 's' : ''}`
                        : 'Sin archivos adjuntos'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
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
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748B',
    marginBottom: 14,
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
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 14,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  unopenedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  unopenedBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  situationTitle: {
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
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  infoIcon: {
    marginTop: 1,
  },
  studentInfoText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  studentNameHighlight: {
    fontWeight: '700',
    color: '#1E3A8A',
  },
  locationDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
  },
  pipeSeparator: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  attachmentsBar: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachmentsBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentsBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  centerContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 20,
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
