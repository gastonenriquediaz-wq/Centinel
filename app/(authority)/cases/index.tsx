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
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { CasesService } from '../../../src/services/cases.service';
import { Case, CaseStatus } from '../../../src/types/database.types';

type CaseFilterType = 'all' | 'active' | 'open' | 'under_investigation' | 'resolved';

const FILTER_TABS: { label: string; value: CaseFilterType }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Abiertos', value: 'active' }, // Muestra 'open' y 'under_investigation'
  { label: 'En Investigación', value: 'under_investigation' },
  { label: 'Resueltos', value: 'resolved' },
];

export default function AuthorityCasesList() {
  const { profile } = useAuthStore();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<CaseFilterType>(
    filter && ['all', 'active', 'open', 'under_investigation', 'resolved'].includes(filter)
      ? (filter as CaseFilterType)
      : 'all'
  );

  useEffect(() => {
    if (filter && ['all', 'active', 'open', 'under_investigation', 'resolved'].includes(filter)) {
      setSelectedFilter(filter as CaseFilterType);
    }
  }, [filter]);

  const loadCases = async () => {
    if (!profile?.institution_id) return;
    try {
      const statusParam =
        selectedFilter === 'all' || selectedFilter === 'active'
          ? undefined
          : (selectedFilter as CaseStatus);

      const { data, error } = await CasesService.getInstitutionCases(
        profile.institution_id,
        statusParam
      );
      if (!error && data) {
        if (selectedFilter === 'active') {
          // Filtra los casos 'open' y 'under_investigation' (no resueltos)
          setCases(data.filter((c) => c.status !== 'resolved'));
        } else {
          setCases(data);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadCases();
  }, [profile?.institution_id, selectedFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCases();
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'open':
        return { label: 'Abierto', bg: '#EFF6FF', text: '#2563EB' };
      case 'under_investigation':
        return { label: 'En Investigación', bg: '#FEF3C7', text: '#D97706' };
      case 'resolved':
        return { label: 'Resuelto', bg: '#DCFCE7', text: '#16A34A' };
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
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Casos y Protocolos',
          headerBackTitle: 'Volver',
        }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Casos de Intervención</Text>
        <Text style={styles.subtitle}>
          Seguimiento formal de protocolos escolares y actas
        </Text>
      </View>

      {/* Filtros */}
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
      ) : cases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay casos registrados</Text>
            <Text style={styles.emptyText}>
              Para abrir un caso formal de protocolo, selecciona un reporte en la bandeja de "Recepción de Reportes" y pulsa "Abrir Caso Formal".
            </Text>
            <Button
              title="Ir a Recepción de Reportes"
              onPress={() => router.push('/(authority)/reports')}
              style={styles.emptyBtn}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/(authority)/cases/${item.id}` as any)}
              >
                <Card style={styles.caseCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.caseTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.protocolBadge}>Nivel: {item.protocol_level}</Text>
                    <Text style={styles.dateText}>Apertura: {formatDate(item.created_at)}</Text>
                  </View>

                  {item.report?.student && (
                    <Text style={styles.studentText}>
                      👤 Alumno: {item.report.student.first_name} {item.report.student.last_name}
                      {item.report.course ? ` (${item.report.course.year}° "${item.report.course.division}")` : ''}
                    </Text>
                  )}

                  <Text style={styles.situationText} numberOfLines={1}>
                    Hecho: {item.report?.situation_type || 'N/A'}
                  </Text>
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
  title: {
    fontSize: 22,
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
  caseCard: {
    padding: 16,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  protocolBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  studentText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 4,
  },
  situationText: {
    fontSize: 12,
    color: '#64748B',
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
    textAlign: 'justify',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyBtn: {
    width: '100%',
  },
});
