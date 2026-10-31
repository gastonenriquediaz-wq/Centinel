import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { MessagesService } from '../../../src/services/messages.service';
import { useReportsStore } from '../../../src/store/reports.store';
import { Report, ReportStatus } from '../../../src/types/database.types';

type FilterType = 'all' | 'sent' | 'in_progress' | 'closed_no_case' | 'finalized';

const FILTER_TABS: { label: string; value: FilterType }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Enviado', value: 'sent' },
  { label: 'En seguimiento', value: 'in_progress' },
  { label: 'Cerrados', value: 'closed_no_case' },
  { label: 'Finalizados', value: 'finalized' },
];

export default function AuthorityReportsList() {
  const { profile } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [chatStats, setChatStats] = useState<{
    unreadCounts: Record<string, number>;
    totalCounts: Record<string, number>;
  }>({ unreadCounts: {}, totalCounts: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>(
    filter && ['sent', 'in_progress', 'closed_no_case', 'finalized', 'all'].includes(filter)
      ? (filter as FilterType)
      : 'all'
  );

  useEffect(() => {
    if (filter && ['sent', 'in_progress', 'closed_no_case', 'finalized', 'all'].includes(filter)) {
      setSelectedFilter(filter as FilterType);
    }
  }, [filter]);

  // Estados de búsqueda, filtros y ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(false); // false = más recientes primero

  const openedReportIds = useReportsStore((state) => state.openedReportIds);

  const loadReports = async () => {
    if (!profile?.institution_id) return;
    try {
      // Cargamos reportes, auditoría de lecturas y estadísticas de chat en paralelo
      const [reportsRes, openedIds, chatStatsRes] = await Promise.all([
        ReportsService.getInstitutionReports(profile.institution_id),
        ReportsService.getOpenedReportIds(profile.institution_id),
        MessagesService.getReportsChatStats(),
      ]);
      if (openedIds && openedIds.size > 0) {
        useReportsStore.getState().setOpenedReportIds(openedIds);
      }
      if (!reportsRes.error && reportsRes.data) {
        setReports(reportsRes.data);
      }
      if (chatStatsRes) {
        setChatStats(chatStatsRes);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [profile?.institution_id])
  );

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

  // Filtrado y búsqueda reactivos
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
    useReportsStore.getState().markReportAsOpened(reportId);
    router.push(`/(authority)/reports/${reportId}` as any);
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

            {/* Fila de Filtros horizontales desplazables con el dedo */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
              style={styles.filterScrollView}
            >
              {FILTER_TABS.map((tab) => {
                const isSelected = selectedFilter === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => setSelectedFilter(tab.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

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
          const unreadMsgs = chatStats.unreadCounts[item.id] || 0;
          const totalMsgs = chatStats.totalCounts[item.id] || 0;

          return (
            <Card style={styles.reportCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenReport(item.id)}
              >
                {/* Fila de insignias superiores */}
                {(isUnopened || unreadMsgs > 0) && (
                  <View style={styles.badgesTopRow}>
                    {isUnopened && (
                      <View style={styles.unopenedBadge}>
                        <Text style={styles.unopenedBadgeText}>Sin abrir</Text>
                      </View>
                    )}
                    {unreadMsgs > 0 && (
                      <View style={styles.chatAlertTopBadge}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={11}
                          color="#1D4ED8"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.chatAlertTopBadgeText}>Chat pendiente</Text>
                      </View>
                    )}
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
              </TouchableOpacity>

              {/* Barra de Chat (debajo de adjuntos) */}
              <TouchableOpacity
                style={[
                  styles.chatBar,
                  unreadMsgs > 0 && styles.chatBarWithUnread,
                ]}
                onPress={() => router.push(`/(authority)/reports/${item.id}/chat` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.chatBarLeft}>
                  <Ionicons
                    name={unreadMsgs > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                    size={16}
                    color={unreadMsgs > 0 ? '#1D4ED8' : '#2563EB'}
                  />
                  <Text
                    style={[
                      styles.chatBarText,
                      unreadMsgs > 0 && styles.chatBarTextWithUnread,
                    ]}
                  >
                    Chat
                  </Text>
                  {totalMsgs > 0 && (
                    <Text
                      style={[
                        styles.chatBarSubText,
                        unreadMsgs > 0 && styles.chatBarSubTextWithUnread,
                      ]}
                    >
                      ({totalMsgs} {totalMsgs === 1 ? 'mensaje' : 'mensajes'})
                    </Text>
                  )}
                </View>

                {unreadMsgs > 0 ? (
                  <View style={styles.chatUnreadPill}>
                    <View style={styles.chatUnreadDot} />
                    <Text style={styles.chatUnreadPillText}>
                      {unreadMsgs === 1 ? '1 nuevo mensaje' : `${unreadMsgs} nuevos`}
                    </Text>
                    <Ionicons name="chevron-forward" size={13} color="#1D4ED8" />
                  </View>
                ) : (
                  <View style={styles.chatNormalRight}>
                    {totalMsgs === 0 && (
                      <Text style={styles.chatEmptySubText}>Sin mensajes</Text>
                    )}
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                  </View>
                )}
              </TouchableOpacity>
            </Card>
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
  filterScrollView: {
    marginBottom: 14,
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 13,
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
  },
  unopenedBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  badgesTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  chatAlertTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chatAlertTopBadgeText: {
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
  chatBar: {
    marginTop: 8,
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
  chatBarWithUnread: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  chatBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chatBarTextWithUnread: {
    fontWeight: '700',
    color: '#1D4ED8',
  },
  chatBarSubText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  chatBarSubTextWithUnread: {
    color: '#2563EB',
    fontWeight: '600',
  },
  chatUnreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  chatUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1D4ED8',
  },
  chatUnreadPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  chatNormalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatEmptySubText: {
    fontSize: 11.5,
    color: '#94A3B8',
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
