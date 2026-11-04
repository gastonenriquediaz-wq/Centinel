import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { supabase } from '../../../src/services/supabase';
import { Report, ReportStatus } from '../../../src/types/database.types';

type FilterType = 'all' | ReportStatus;

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'sent', label: 'Enviados' },
  { key: 'in_progress', label: 'En seguimiento' },
  { key: 'finalized', label: 'Finalizados' },
  { key: 'closed_no_case', label: 'Cerrado sin apertura' },
];

export default function StudentReportsList() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [unreadReportIds, setUnreadReportIds] = useState<Set<string>>(new Set());
  const [unreadTotalCount, setUnreadTotalCount] = useState(0);
  const [latestUnreadReportId, setLatestUnreadReportId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await ReportsService.getStudentReports(profile.id);
      if (!error && data) {
        setReports(data);
        const studentReportIds = data.map((r) => r.id);
        if (studentReportIds.length > 0) {
          const { data: msgData } = await supabase
            .from('report_messages')
            .select('id, report_id, created_at')
            .in('report_id', studentReportIds)
            .neq('sender_id', profile.id)
            .is('read_at', null)
            .order('created_at', { ascending: false });

          if (msgData) {
            const ids = new Set<string>(msgData.map((m) => m.report_id));
            setUnreadReportIds(ids);
            setUnreadTotalCount(msgData.length);
            if (msgData.length > 0) {
              setLatestUnreadReportId(msgData[0].report_id);
            } else {
              setLatestUnreadReportId(null);
            }
          }
        } else {
          setUnreadReportIds(new Set());
          setUnreadTotalCount(0);
          setLatestUnreadReportId(null);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  // Mapeo cronológico de identificadores REP-0001, REP-0002...
  const reportCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...reports].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    sorted.forEach((rep, idx) => {
      map.set(rep.id, `REP-${String(idx + 1).padStart(4, '0')}`);
    });
    return map;
  }, [reports]);

  // Filtrado de reportes según el chip activo
  const filteredReports = useMemo(() => {
    if (activeFilter === 'all') return reports;
    return reports.filter((r) => r.status === activeFilter);
  }, [reports, activeFilter]);

  // Colores de estados solicitados en Punto 8:
  // Enviado = azul, En seguimiento = amarillo, Cerrado sin apertura = rojo, Finalizado = gris
  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviado', bg: '#EFF6FF', text: '#2563EB' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'closed_no_case':
        return { label: 'Cerrado sin apertura', bg: '#FEE2E2', text: '#DC2626' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#F1F5F9', text: '#64748B' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Mis reportes', headerBackTitle: 'Inicio' }} />

      {/* 4_ Filtros en la parte superior */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5_ Métricas superiores: Historial y Notificación de chat */}
      <View style={styles.metricsRow}>
        {/* Tarjeta izquierda con icono de documento */}
        <View style={styles.metricCardLeft}>
          <Ionicons
            name="document-text-outline"
            size={24}
            color="#1E3A8A"
            style={styles.metricIcon}
          />
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricCountText}>
              {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}
            </Text>
            <Text style={styles.metricSubtext}>Historial de situaciones comunicadas</Text>
          </View>
        </View>

        {/* Tarjeta derecha de notificación de chat */}
        <TouchableOpacity
          style={[styles.metricCardRight, unreadTotalCount > 0 ? styles.metricCardRightActive : null]}
          activeOpacity={unreadTotalCount > 0 ? 0.7 : 1}
          onPress={() => {
            if (unreadTotalCount > 0 && latestUnreadReportId) {
              router.push(`/(student)/reports/${latestUnreadReportId}/chat` as any);
            }
          }}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={unreadTotalCount > 0 ? '#1E3A8A' : '#64748B'}
          />
          <Text
            style={[
              styles.chatNotificationText,
              unreadTotalCount > 0 ? styles.chatNotificationTextActive : null,
            ]}
            numberOfLines={1}
          >
            {unreadTotalCount > 0
              ? `${unreadTotalCount} ${unreadTotalCount === 1 ? 'respuesta nueva' : 'respuestas nuevas'}`
              : 'Sin respuestas'}
          </Text>
          {unreadTotalCount > 0 && (
            <Ionicons name="chevron-forward" size={16} color="#1E3A8A" />
          )}
        </TouchableOpacity>
      </View>

      {/* Contenido principal */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {reports.length === 0
                ? 'No tenés reportes creados'
                : 'No hay reportes con este estado'}
            </Text>
            <Text style={styles.emptyText}>
              {reports.length === 0
                ? 'Si estás viviendo o presenciando una situación de preocupación escolar, podés comunicarla de forma confidencial a las autoridades de tu escuela.'
                : 'Cambiá el filtro superior a "Todos" para ver el resto de tus reportes.'}
            </Text>
            {reports.length === 0 && (
              <Button
                title="Crear mi primer reporte"
                onPress={() => router.push('/(student)/reports/new')}
                style={styles.emptyButton}
              />
            )}
          </Card>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 84 },
          ]}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const reportCode = reportCodeMap.get(item.id) || 'REP-0001';
            const hasNewResponse = unreadReportIds.has(item.id);

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/(student)/reports/${item.id}` as any)}
                style={styles.cardTouchable}
              >
                <Card style={styles.reportCard}>
                  {/* Encabezado de la tarjeta con REP-000X y Estado */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.reportCodeText}>{reportCode}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBodyRow}>
                    <View style={styles.cardMainContent}>
                      <Text style={styles.situationType}>{item.situation_type}</Text>

                      <View style={styles.metaRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color="#64748B"
                          style={styles.metaIcon}
                        />
                        <Text style={styles.metaText} numberOfLines={1}>
                          Lugar: {item.location}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color="#64748B"
                          style={styles.metaIcon}
                        />
                        <Text style={styles.metaText}>
                          Fecha de envío: {formatDate(item.created_at)}
                        </Text>
                      </View>

                      {/* Píldoras de adjuntos, protocolo activo y nueva respuesta */}
                      <View style={styles.pillsContainer}>
                        {item.case_id && (
                          <View
                            style={[
                              styles.protocolActivePill,
                              item.status === 'finalized' && styles.protocolResolvedPill,
                            ]}
                          >
                            <Ionicons
                              name={
                                item.status === 'finalized'
                                  ? 'checkmark-circle'
                                  : 'shield-checkmark'
                              }
                              size={14}
                              color={item.status === 'finalized' ? '#15803D' : '#0369A1'}
                              style={styles.pillIcon}
                            />
                            <Text
                              style={[
                                styles.protocolActivePillText,
                                item.status === 'finalized' && styles.protocolResolvedPillText,
                              ]}
                            >
                              {item.status === 'finalized'
                                ? 'Protocolo concluido y resuelto'
                                : 'Protocolo de convivencia activo'}
                            </Text>
                          </View>
                        )}

                        {item.attachments && item.attachments.length > 0 && (
                          <View style={styles.attachmentPill}>
                            <Ionicons name="attach-outline" size={14} color="#2563EB" style={styles.pillIcon} />
                            <Text style={styles.attachmentPillText}>
                              {item.attachments.length}{' '}
                              {item.attachments.length === 1
                                ? 'archivo adjunto'
                                : 'archivos adjuntos'}
                            </Text>
                          </View>
                        )}

                        {hasNewResponse && (
                          <View style={styles.newResponsePill}>
                            <View style={styles.chatIconWrapper}>
                              <Ionicons name="chatbubble-ellipses" size={14} color="#2563EB" />
                              <View style={styles.redDot} />
                            </View>
                            <Text style={styles.newResponsePillText}>Nueva respuesta</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#94A3B8"
                      style={styles.cardChevron}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* 3_ Botón flotante inferior: "+ Nuevo reporte" */}
      <View
        style={[
          styles.floatingFooter,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.8}
          onPress={() => router.push('/(student)/reports/new')}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.floatingButtonText}>Nuevo reporte</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filtersWrapper: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filtersScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  metricCardLeft: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIcon: {
    marginRight: 10,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricCountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  metricCardRight: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  metricCardRightActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  chatNotificationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    flex: 1,
  },
  chatNotificationTextActive: {
    color: '#1E3A8A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  cardTouchable: {
    width: '100%',
  },
  reportCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMainContent: {
    flex: 1,
    marginRight: 10,
  },
  cardChevron: {
    alignSelf: 'center',
  },
  situationType: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaIcon: {
    marginRight: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  pillsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  protocolActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  protocolResolvedPill: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  protocolActivePillText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
  },
  protocolResolvedPillText: {
    color: '#15803D',
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillIcon: {
    marginRight: 4,
  },
  attachmentPillText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  newResponsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chatIconWrapper: {
    position: 'relative',
    marginRight: 6,
  },
  redDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  newResponsePillText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  floatingButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'justify',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    width: '100%',
  },
});
