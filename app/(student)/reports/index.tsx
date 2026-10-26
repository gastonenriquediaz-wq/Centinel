import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { Report, ReportStatus } from '../../../src/types/database.types';

export default function StudentReportsList() {
  const { profile } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await ReportsService.getStudentReports(profile.id);
      if (!error && data) {
        setReports(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [profile?.id]);

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
        <View>
          <Text style={styles.title}>Mis Reportes</Text>
          <Text style={styles.subtitle}>Historial de situaciones comunicadas</Text>
        </View>
        <Button
          title="+ Nuevo"
          onPress={() => router.push('/(student)/reports/new')}
          style={styles.newButton}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tienes reportes creados</Text>
            <Text style={styles.emptyText}>
              Si estás viviendo o presenciando una situación de preocupación escolar, puedes comunicarla de forma confidencial a las autoridades de tu escuela.
            </Text>
            <Button
              title="Crear mi primer reporte"
              onPress={() => router.push('/(student)/reports/new')}
              style={styles.emptyButton}
            />
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
                onPress={() => router.push(`/(student)/reports/${item.id}` as any)}
              >
                <Card style={styles.reportCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.situationType}>{item.situation_type}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.locationText}>Lugar: {item.location}</Text>
                  <Text style={styles.dateText}>Fecha de envío: {formatDate(item.created_at)}</Text>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
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
  newButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    width: '100%',
  },
});
