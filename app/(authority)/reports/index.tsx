import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../src/types/database.types';

const FILTER_TABS: { label: string; value: ReportStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Enviados', value: 'sent' },
  { label: 'En seguimiento', value: 'in_progress' },
  { label: 'Cerrados', value: 'closed_no_case' },
  { label: 'Finalizados', value: 'finalized' },
];

export default function AuthorityReportsList() {
  const { profile } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ReportStatus | 'all'>('all');

  const loadReports = async () => {
    if (!profile?.institution_id) return;
    try {
      const statusParam = selectedFilter === 'all' ? undefined : selectedFilter;
      const { data, error } = await ReportsService.getInstitutionReports(
        profile.institution_id,
        statusParam
      );
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
  }, [profile?.institution_id, selectedFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviado', bg: '#EFF6FF', text: '#2563EB' };
      case 'in_progress':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'closed_no_case':
        return { label: 'Cerrado sin apertura', bg: '#F1F5F9', text: '#475569' };
      case 'finalized':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569' };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title="← Volver"
          variant="outline"
          onPress={() => router.replace('/(authority)')}
          style={styles.backButton}
        />
        <Text style={styles.title}>Recepción de Reportes</Text>
        <Text style={styles.subtitle}>Comunicaciones de situaciones estudiantiles</Text>
      </View>

      {/* Chips de filtro */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TABS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = selectedFilter === item.value;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setSelectedFilter(item.value)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay reportes para este filtro</Text>
            <Text style={styles.emptyText}>
              Los reportes enviados por los alumnos de la institución aparecerán aquí organizados por estado.
            </Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/(authority)/reports/${item.id}` as any)}
              >
                <Card style={styles.reportCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.situationType}>{item.situation_type}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  {/* Identificación del alumno (Centinel: sin anonimato) */}
                  <View style={styles.studentInfoRow}>
                    <Text style={styles.studentName}>
                      👤 {item.student?.first_name} {item.student?.last_name}
                    </Text>
                    <Text style={styles.studentDni}>DNI: {item.student?.dni || 'S/D'}</Text>
                  </View>

                  {item.course && (
                    <Text style={styles.courseInfo}>
                      Curso: {item.course.year}° "{item.course.division}" ({item.course.shift})
                    </Text>
                  )}

                  <Text style={styles.locationText}>Lugar: {item.location}</Text>
                  <Text style={styles.dateText}>Recibido el: {formatDate(item.created_at)}</Text>

                  {item.attachments && item.attachments.length > 0 && (
                    <View style={styles.attachmentsCountBadge}>
                      <Text style={styles.attachmentsCountText}>
                        📎 {item.attachments.length} archivo(s) adjunto(s)
                      </Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  filterRow: {
    paddingVertical: 8,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterChipSelected: {
    backgroundColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    gap: 12,
  },
  reportCard: {
    padding: 16,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  situationType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
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
  studentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  studentDni: {
    fontSize: 12,
    color: '#64748B',
  },
  courseInfo: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  attachmentsCountBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  attachmentsCountText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
