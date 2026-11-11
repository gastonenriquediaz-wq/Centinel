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
  Modal,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { useAuthStore } from '../../../src/store/auth.store';
import { CoursesService } from '../../../src/services/courses.service';
import { Course, ShiftType } from '../../../src/types/database.types';

const COURSE_YEARS = [1, 2, 3, 4, 5, 6, 7];
const SHIFT_TYPES: ShiftType[] = ['Mañana', 'Tarde', 'Noche', 'Jornada Completa'];

export default function CoursesListScreen() {
  const { profile } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'Todos' | ShiftType>('Todos');

  // Modal para editar curso completo o eliminarlo
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editYear, setEditYear] = useState<number>(1);
  const [editDivision, setEditDivision] = useState('');
  const [editShift, setEditShift] = useState<ShiftType>('Mañana');
  const [editSchoolYear, setEditSchoolYear] = useState('');
  const [editEstimatedCap, setEditEstimatedCap] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourse(course);
    setEditYear(course.year);
    setEditDivision(course.division);
    setEditShift(course.shift);
    setEditSchoolYear(String(course.school_year));
    setEditEstimatedCap(String(course.estimated_students || 30));
  };

  const handleSaveCourse = async () => {
    if (!editingCourse) return;

    if (!editDivision.trim()) {
      Alert.alert('Dato requerido', 'Por favor, ingresá la división (ej: A, B, 1ra).');
      return;
    }

    if (editDivision.trim().length > 15) {
      Alert.alert('División demasiado larga', 'La división no puede superar los 15 caracteres.');
      return;
    }

    const parsedSchoolYear = parseInt(editSchoolYear, 10);
    if (isNaN(parsedSchoolYear) || parsedSchoolYear < 2024 || parsedSchoolYear > 2100) {
      Alert.alert('Ciclo lectivo inválido', 'Ingresá un ciclo lectivo válido (entre 2024 y 2100).');
      return;
    }

    const parsedCap = parseInt(editEstimatedCap, 10);
    if (isNaN(parsedCap) || parsedCap <= 0 || parsedCap > 200) {
      Alert.alert('Valor no válido', 'La cantidad estimada debe ser un número entre 1 y 200.');
      return;
    }

    try {
      setSavingCourse(true);
      const updated = await CoursesService.updateCourse(editingCourse.id, {
        year: editYear,
        division: editDivision,
        shift: editShift,
        schoolYear: parsedSchoolYear,
        estimatedStudents: parsedCap,
      });
      setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCourse(null);
      Alert.alert('Curso actualizado', 'Los datos del curso se actualizaron correctamente.');
    } catch (err: any) {
      Alert.alert('Error al actualizar', err.message || 'No se pudo actualizar el curso.');
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = () => {
    if (!editingCourse) return;

    Alert.alert(
      '¿Eliminar curso?',
      `Esta acción eliminará permanentemente el curso ${editingCourse.year}° "${editingCourse.division}" (${editingCourse.shift}). Solo se puede realizar si no tiene estudiantes registrados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingCourse(true);
              const result = await CoursesService.deleteCourse(editingCourse.id);
              if (!result.success) {
                Alert.alert('No se puede eliminar', result.error);
                return;
              }
              setCourses((prev) => prev.filter((c) => c.id !== editingCourse.id));
              setEditingCourse(null);
              Alert.alert('Curso eliminado', 'El curso fue eliminado de la institución con éxito.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar el curso.');
            } finally {
              setDeletingCourse(false);
            }
          },
        },
      ]
    );
  };

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
                    <View style={styles.courseCapRow}>
                      <Text style={styles.courseCap}>
                        Capacidad estimada: {item.estimated_students} estudiantes
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleOpenEditCourse(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.editCourseButton}
                      >
                        <Ionicons name="pencil" size={12} color="#1E3A8A" />
                        <Text style={styles.editCourseText}>Editar / Eliminar</Text>
                      </TouchableOpacity>
                    </View>

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

      {/* Modal para Editar Curso Completo o Eliminarlo */}
      <Modal
        visible={!!editingCourse}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCourse(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="pencil" size={20} color="#1E3A8A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Editar Datos del Curso</Text>
                  <Text style={styles.modalSubtitleTop}>
                    Modificá los datos o eliminá el curso si fue creado por error.
                  </Text>
                </View>
              </View>

              {/* Selector de Año */}
              <Text style={styles.inputGroupLabel}>Año escolar</Text>
              <View style={styles.selectorRow}>
                {COURSE_YEARS.map((y) => {
                  const isSelected = editYear === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearChip, isSelected && styles.yearChipActive]}
                      onPress={() => setEditYear(y)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.yearChipText, isSelected && styles.yearChipTextActive]}>
                        {y}°
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* División */}
              <Input
                label="División"
                placeholder="Ej: A, B, 1ra, 2da"
                value={editDivision}
                onChangeText={setEditDivision}
                autoCapitalize="characters"
              />

              {/* Selector de Turno */}
              <Text style={styles.inputGroupLabel}>Turno</Text>
              <View style={styles.selectorRow}>
                {SHIFT_TYPES.map((sh) => {
                  const isSelected = editShift === sh;
                  return (
                    <TouchableOpacity
                      key={sh}
                      style={[styles.shiftSelectChip, isSelected && styles.shiftSelectChipActive]}
                      onPress={() => setEditShift(sh)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.shiftSelectChipText,
                          isSelected && styles.shiftSelectChipTextActive,
                        ]}
                      >
                        {sh}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Ciclo Lectivo */}
              <Input
                label="Ciclo lectivo (Año calendario)"
                placeholder="Ej: 2026"
                value={editSchoolYear}
                onChangeText={setEditSchoolYear}
                keyboardType="numeric"
              />

              {/* Capacidad Estimada */}
              <Input
                label="Cantidad estimada de estudiantes"
                placeholder="Ej: 30"
                helperText="Dato orientativo para estadísticas. No limita el registro."
                value={editEstimatedCap}
                onChangeText={setEditEstimatedCap}
                keyboardType="numeric"
              />

              {/* Botón de Eliminar Curso (Protegido) */}
              <TouchableOpacity
                style={styles.deleteCourseBtn}
                onPress={handleDeleteCourse}
                disabled={deletingCourse || savingCourse}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text style={styles.deleteCourseBtnText}>
                  {deletingCourse ? 'Eliminando...' : 'Eliminar este curso'}
                </Text>
              </TouchableOpacity>

              {/* Botones de Acción */}
              <View style={styles.modalButtonsRow}>
                <Button
                  title="Cancelar"
                  variant="outline"
                  onPress={() => setEditingCourse(null)}
                  style={styles.modalBtnHalf}
                />
                <Button
                  title="Guardar Cambios"
                  onPress={handleSaveCourse}
                  loading={savingCourse}
                  style={styles.modalBtnHalf}
                />
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>
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
  courseCapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  editCourseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  editCourseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    padding: 20,
    borderRadius: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitleTop: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  yearChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  yearChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  shiftSelectChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shiftSelectChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  shiftSelectChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  shiftSelectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deleteCourseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  deleteCourseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  modalBtnHalf: {
    flex: 1,
  },
});
