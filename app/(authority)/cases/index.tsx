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
} from 'react-native';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { CasesService } from '../../../src/services/cases.service';
import { Case, CaseStatus } from '../../../src/types/database.types';

type CaseFilterType = 'all' | 'open' | 'under_investigation' | 'resolved' | 'active';

const FILTER_TABS: { label: string; value: CaseFilterType }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'active' },
  { label: 'Abierto', value: 'open' },
  { label: 'En seguimiento', value: 'under_investigation' },
  { label: 'Finalizado', value: 'resolved' },
];

export default function AuthorityCasesList() {
  const { profile } = useAuthStore();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const loadCases = useCallback(async () => {
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
          setCases(data.filter((c) => c.status !== 'resolved'));
        } else {
          setCases(data);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.institution_id, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [loadCases])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCases();
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

  // Filtrado reactivo por buscador (estudiante o tipo de caso)
  const filteredCases = useMemo(() => {
    let result = [...cases];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const situationMatch = (c.report?.situation_type || '').toLowerCase().includes(q);
        const studentFullName = `${c.report?.student?.first_name || ''} ${c.report?.student?.last_name || ''}`.toLowerCase();
        const studentDni = (c.report?.student?.dni || '').toLowerCase();
        const course = `${c.report?.course?.year || ''} ${c.report?.course?.division || ''}`.toLowerCase();

        return (
          titleMatch ||
          situationMatch ||
          studentFullName.includes(q) ||
          studentDni.includes(q) ||
          course.includes(q)
        );
      });
    }

    return result;
  }, [cases, searchQuery]);

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

        {/* Buscador superior: "Buscar por estudiante o tipo de caso" */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por estudiante o tipo de caso"
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
              Para abrir un caso formal de protocolo, seleccioná un reporte en la bandeja de "Reportes recibidos" y pulsá "Crear caso".
            </Text>
            <Button
              title="Ir a Reportes recibidos"
              onPress={() => router.push('/(authority)/reports')}
              style={styles.emptyBtn}
            />
          </Card>
        </View>
      ) : filteredCases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <Ionicons name="search-outline" size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Sin resultados de búsqueda</Text>
            <Text style={styles.emptyText}>
              No se encontraron casos que coincidan con "{searchQuery}". Probá buscar por nombre de estudiante o tipo de situación.
            </Text>
            <Button
              title="Limpiar búsqueda"
              variant="outline"
              onPress={() => setSearchQuery('')}
              style={styles.emptyBtn}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const actsCount = item.acts?.length || 0;

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
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" style={styles.dateIcon} />
                      <Text style={styles.dateText}>Apertura: {formatDate(item.created_at)}</Text>
                    </View>
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

                  {/* Indicador de Actas al final del caso */}
                  <View style={styles.actasBar}>
                    <View style={styles.actasBarLeft}>
                      <Ionicons name="document-text-outline" size={15} color="#334155" />
                      <Text style={styles.actasBarText}>
                        {actsCount === 0
                          ? 'Sin actas'
                          : actsCount === 1
                          ? '1 acta'
                          : `${actsCount} actas`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                  </View>
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
    paddingBottom: 4,
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
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
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
  actasBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  actasBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actasBarText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
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
