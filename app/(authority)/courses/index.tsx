import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { CoursesService } from '../../../src/services/courses.service';
import { Course, ShiftType } from '../../../src/types/database.types';

export default function CoursesListScreen() {
  const { profile } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'Todos' | ShiftType>('Todos');

  const SHIFT_OPTIONS: ('Todos' | ShiftType)[] = [
    'Todos',
    'Mañana',
    'Tarde',
    'Noche',
    'Jornada Completa',
  ];

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // 1. Filtro por Turno
      if (shiftFilter !== 'Todos' && c.shift !== shiftFilter) {
        return false;
      }

      // 2. Filtro de búsqueda por texto (año, división, turno, ciclo)
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const fullCourse = `${c.year}° "${c.division}"`.toLowerCase();
      const simpleCourse = `${c.year} ${c.division}`.toLowerCase();
      const yearStr = `${c.year}`.toLowerCase();
      const divStr = c.division.toLowerCase();
      const shiftStr = c.shift.toLowerCase();
      const schoolYearStr = `${c.school_year}`.toLowerCase();

      return (
        fullCourse.includes(q) ||
        simpleCourse.includes(q) ||
        yearStr.includes(q) ||
        divStr.includes(q) ||
        shiftStr.includes(q) ||
        schoolYearStr.includes(q)
      );
    });
  }, [courses, searchQuery, shiftFilter]);

  const loadCourses = async () => {
    if (!profile?.institution_id) return;
    try {
      setError(null);
      const data = await CoursesService.getCourses(profile.institution_id);
      setCourses(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los cursos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCourses();
    }, [profile?.institution_id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Cursos y Códigos QR/Alfanuméricos',
          headerBackTitle: 'Inicio',
        }}
      />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cursos Institucionales</Text>
        <Button
          title="+ Nuevo Curso"
          onPress={() => router.push('/(authority)/courses/new')}
          style={styles.newButton}
          textStyle={styles.newButtonText}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" onPress={loadCourses} style={styles.retryButton} />
        </Card>
      ) : courses.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No hay cursos registrados</Text>
          <Text style={styles.emptySubtitle}>
            Creá los cursos correspondientes al ciclo lectivo para que los estudiantes puedan incorporarse con códigos QR o alfanuméricos.
          </Text>
        </Card>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Buscador de Curso */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar curso (ej: 3° A, Mañana)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filtro por Turno */}
          <View style={styles.shiftsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shiftsScrollContent}
            >
              {SHIFT_OPTIONS.map((opt) => {
                const isSelected = shiftFilter === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.shiftChip, isSelected && styles.shiftChipSelected]}
                    onPress={() => setShiftFilter(opt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.shiftChipText,
                        isSelected && styles.shiftChipTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Estado de Filtros */}
          {(searchQuery.length > 0 || shiftFilter !== 'Todos') && (
            <View style={styles.filterStatusRow}>
              <Text style={styles.filterStatusText}>
                Mostrando {filteredCourses.length} de {courses.length} cursos
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShiftFilter('Todos');
                }}
              >
                <Text style={styles.clearFilterText}>Limpiar filtros</Text>
              </TouchableOpacity>
            </View>
          )}

          {filteredCourses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="search-outline" size={42} color="#94A3B8" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No se encontraron cursos</Text>
              <Text style={styles.emptySubtitle}>
                No hay ningún curso que coincida con "{searchQuery}"
                {shiftFilter !== 'Todos' ? ` en el turno ${shiftFilter}` : ''}.
              </Text>
              <Button
                title="Limpiar filtros"
                variant="outline"
                onPress={() => {
                  setSearchQuery('');
                  setShiftFilter('Todos');
                }}
                style={{ marginTop: 12 }}
              />
            </Card>
          ) : (
            <FlatList
              data={filteredCourses}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Card style={styles.courseCard}>
                  <TouchableOpacity
                    style={styles.courseInfo}
                    onPress={() => router.push(`/(authority)/courses/${item.id}/students`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.courseTitleRow}>
                      <Text style={styles.courseName}>
                        {item.year}° "{item.division}"
                      </Text>
                      <View style={styles.viewBadge}>
                        <Ionicons name="people" size={13} color="#1E3A8A" style={{ marginRight: 3 }} />
                        <Text style={styles.viewBadgeText}>Ver alumnos</Text>
                      </View>
                    </View>

                    <Text style={styles.courseDetails}>
                      Turno: {item.shift} · Ciclo: {item.school_year}
                    </Text>
                    <Text style={styles.courseCap}>
                      Capacidad estimada: {item.estimated_students} estudiantes
                    </Text>

                    <View style={styles.manageStudentsLink}>
                      <Text style={styles.manageStudentsLinkText}>
                        Gestionar estudiantes del curso →
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.actionCol}>
                    <Button
                      title="Generar QR"
                      onPress={() => router.push(`/(authority)/courses/${item.id}/qr`)}
                      style={styles.actionBtn}
                      textStyle={styles.actionBtnText}
                    />
                    <Button
                      title="Generar código"
                      variant="outline"
                      onPress={() => router.push(`/(authority)/courses/${item.id}/code`)}
                      style={styles.actionBtnOutline}
                      textStyle={styles.actionBtnOutlineText}
                    />
                  </View>
                </Card>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  newButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  shiftsWrapper: {
    marginBottom: 10,
  },
  shiftsScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  shiftChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shiftChipSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  shiftChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  shiftChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  filterStatusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  courseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  courseInfo: {
    flex: 1,
    marginRight: 12,
  },
  courseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  courseName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  viewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  courseDetails: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 3,
    fontWeight: '500',
  },
  courseCap: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  manageStudentsLink: {
    marginTop: 2,
  },
  manageStudentsLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  actionCol: {
    width: 142,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actionBtnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
    textAlign: 'center',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'justify',
    lineHeight: 18,
  },
  errorCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
  },
  errorText: {
    color: '#991B1B',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
});
