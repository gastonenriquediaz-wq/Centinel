import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../src/store/auth.store';
import { CoursesService } from '../../../../src/services/courses.service';
import { StudentsService, StudentWithCourse } from '../../../../src/services/students.service';
import { Course } from '../../../../src/types/database.types';

export default function CourseStudentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Array.isArray(id) ? id[0] : id;
  const { profile } = useAuthStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'suspended' | 'pending'>('all');

  // Modal para ingresar motivo al suspender
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCourse | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    try {
      const [courseData, studentsData] = await Promise.all([
        CoursesService.getCourseById(courseId),
        StudentsService.getStudentsByCourse(courseId),
      ]);
      setCourse(courseData);
      setStudents(studentsData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar los datos del curso.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtrado de estudiantes
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      const dni = s.dni?.toLowerCase() || '';
      const matchesQuery = !q || fullName.includes(q) || dni.includes(q);

      if (!matchesQuery) return false;

      if (statusFilter === 'all') return true;
      return s.account_status === statusFilter;
    });
  }, [students, searchQuery, statusFilter]);

  // Contadores
  const stats = useMemo(() => {
    const total = students.length;
    const approved = students.filter((s) => s.account_status === 'approved').length;
    const suspended = students.filter((s) => s.account_status === 'suspended').length;
    const pending = students.filter((s) => s.account_status === 'pending').length;
    return { total, approved, suspended, pending };
  }, [students]);

  // Abrir modal de suspensión
  const handleOpenSuspendModal = (student: StudentWithCourse) => {
    setSelectedStudent(student);
    setSuspendReason('Uso inadecuado de la plataforma escolar o medida disciplinaria preventiva.');
    setSuspendModalVisible(true);
  };

  // Confirmar suspensión
  const handleConfirmSuspend = async () => {
    if (!selectedStudent || !profile?.institution_id) return;
    try {
      setActionLoading(true);
      await StudentsService.suspendStudent({
        studentId: selectedStudent.id,
        performedBy: profile.id,
        institutionId: profile.institution_id,
        reason: suspendReason.trim(),
      });

      // Actualizar estado local
      setStudents((prev) =>
        prev.map((s) => (s.id === selectedStudent.id ? { ...s, account_status: 'suspended' } : s))
      );
      setSuspendModalVisible(false);
      Alert.alert(
        'Cuenta suspendida',
        `La cuenta de ${selectedStudent.first_name} ${selectedStudent.last_name} fue suspendida. No podrá ingresar a la app hasta ser reactivada.`
      );
    } catch (err: any) {
      Alert.alert('Error al suspender', err.message || 'No se pudo suspender la cuenta.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reactivar cuenta
  const handleReactivate = (student: StudentWithCourse) => {
    if (!profile?.institution_id) return;
    Alert.alert(
      '¿Reactivar cuenta?',
      `¿Deseás reactivar el acceso de ${student.first_name} ${student.last_name} a la aplicación?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reactivar',
          onPress: async () => {
            try {
              setActionLoading(true);
              await StudentsService.reactivateStudent({
                studentId: student.id,
                performedBy: profile.id,
                institutionId: profile.institution_id,
              });

              setStudents((prev) =>
                prev.map((s) => (s.id === student.id ? { ...s, account_status: 'approved' } : s))
              );
              Alert.alert(
                'Cuenta reactivada',
                `El estudiante ${student.first_name} ${student.last_name} puede volver a ingresar a la aplicación.`
              );
            } catch (err: any) {
              Alert.alert('Error al reactivar', err.message || 'No se pudo reactivar la cuenta.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Eliminar usuario con chequeo estricto
  const handleDelete = async (student: StudentWithCourse) => {
    if (!profile?.institution_id) return;
    try {
      setActionLoading(true);

      // 1. Verificación previa de integridad institucional
      const check = await StudentsService.checkCanDeleteStudent(student.id);

      if (!check.canDelete) {
        Alert.alert(
          'No se puede eliminar',
          check.reason ||
            'El estudiante cuenta con reportes o actuaciones institucionales registradas que no pueden eliminarse. Podés optar por suspender su cuenta.',
          [
            { text: 'Entendido', style: 'cancel' },
            {
              text: 'Suspender cuenta',
              onPress: () => handleOpenSuspendModal(student),
            },
          ]
        );
        return;
      }

      // 2. Si no tiene reportes ni intervenciones, confirmar eliminación
      Alert.alert(
        '¿Eliminar usuario del curso?',
        `Se eliminará definitivamente la cuenta de ${student.first_name} ${student.last_name} (DNI: ${student.dni || 'Sin DNI'}).\n\nEsta cuenta no registra reportes ni actuaciones escolares previas. Esta acción es permanente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar definitivamente',
            style: 'destructive',
            onPress: async () => {
              try {
                setActionLoading(true);
                await StudentsService.deleteStudent({
                  studentId: student.id,
                  performedBy: profile.id,
                  institutionId: profile.institution_id,
                });

                // Quitar de la lista local
                setStudents((prev) => prev.filter((s) => s.id !== student.id));
                Alert.alert('Usuario eliminado', 'El estudiante ha sido removido del curso y del sistema.');
              } catch (delErr: any) {
                Alert.alert('Error al eliminar', delErr.message || 'No se pudo eliminar el usuario.');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo verificar el estado del estudiante.');
    } finally {
      setActionLoading(false);
    }
  };

  const courseTitle = course ? `${course.year}° "${course.division}"` : 'Curso';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Estudiantes - ${courseTitle}`,
          headerBackTitle: 'Cursos',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Cargando estudiantes del curso...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Tarjeta de Encabezado del Curso */}
              <Card style={styles.courseHeaderCard}>
                <View style={styles.courseHeaderTop}>
                  <View style={styles.courseBadgeIcon}>
                    <Ionicons name="school" size={24} color="#1E3A8A" />
                  </View>
                  <View style={styles.courseHeaderInfo}>
                    <Text style={styles.courseHeaderTitle}>{courseTitle}</Text>
                    <Text style={styles.courseHeaderSub}>
                      Turno: {course?.shift} · Ciclo Lectivo: {course?.school_year}
                    </Text>
                  </View>
                </View>

                {/* Métricas de estudiantes */}
                <View style={styles.metricsRow}>
                  <TouchableOpacity
                    style={[styles.metricChip, statusFilter === 'all' && styles.metricChipActive]}
                    onPress={() => setStatusFilter('all')}
                  >
                    <Text style={[styles.metricNumber, statusFilter === 'all' && styles.metricNumberActive]}>
                      {stats.total}
                    </Text>
                    <Text style={[styles.metricLabel, statusFilter === 'all' && styles.metricLabelActive]}>
                      Total
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.metricChip, statusFilter === 'approved' && styles.metricChipApproved]}
                    onPress={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
                  >
                    <Text style={[styles.metricNumber, { color: '#15803D' }]}>{stats.approved}</Text>
                    <Text style={styles.metricLabel}>Activos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.metricChip, statusFilter === 'suspended' && styles.metricChipSuspended]}
                    onPress={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
                  >
                    <Text style={[styles.metricNumber, { color: '#B91C1C' }]}>{stats.suspended}</Text>
                    <Text style={styles.metricLabel}>Suspendidos</Text>
                  </TouchableOpacity>

                  {stats.pending > 0 && (
                    <TouchableOpacity
                      style={[styles.metricChip, statusFilter === 'pending' && styles.metricChipPending]}
                      onPress={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    >
                      <Text style={[styles.metricNumber, { color: '#D97706' }]}>{stats.pending}</Text>
                      <Text style={styles.metricLabel}>Pendientes</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>

              {/* Barra de Búsqueda */}
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color="#64748B" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre, apellido o DNI..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.listHeaderRow}>
                <Text style={styles.listSectionTitle}>
                  Estudiantes registrados ({filteredStudents.length})
                </Text>
                {statusFilter !== 'all' && (
                  <TouchableOpacity onPress={() => setStatusFilter('all')}>
                    <Text style={styles.clearFilterText}>Mostrar todos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No se encontraron estudiantes'
                  : 'No hay estudiantes registrados en este curso'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'all'
                  ? 'Probá ajustando el término de búsqueda o el filtro de estado.'
                  : 'Los alumnos aparecerán aquí automáticamente una vez que escaneen el código QR o ingresen el código alfanumérico generado para este curso.'}
              </Text>
              {!searchQuery && statusFilter === 'all' && course && (
                <View style={styles.emptyActionRow}>
                  <Button
                    title="Generar QR"
                    onPress={() => router.push(`/(authority)/courses/${course.id}/qr`)}
                    style={styles.emptyBtn}
                  />
                  <Button
                    title="Generar código"
                    variant="outline"
                    onPress={() => router.push(`/(authority)/courses/${course.id}/code`)}
                    style={styles.emptyBtnOutline}
                  />
                </View>
              )}
            </Card>
          }
          renderItem={({ item }) => {
            const isApproved = item.account_status === 'approved';
            const isSuspended = item.account_status === 'suspended';
            const isPending = item.account_status === 'pending';

            return (
              <Card style={styles.studentCard}>
                <View style={styles.studentCardHeader}>
                  {/* Avatar con iniciales */}
                  <View
                    style={[
                      styles.avatarCircle,
                      isSuspended && styles.avatarCircleSuspended,
                      isPending && styles.avatarCirclePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        isSuspended && styles.avatarTextSuspended,
                        isPending && styles.avatarTextPending,
                      ]}
                    >
                      {item.first_name?.[0] || ''}
                      {item.last_name?.[0] || ''}
                    </Text>
                  </View>

                  <View style={styles.studentInfoCol}>
                    <Text style={styles.studentName}>
                      {item.last_name}, {item.first_name}
                    </Text>
                    <Text style={styles.studentDni}>DNI: {item.dni || 'No especificado'}</Text>
                    {item.birth_date && (
                      <Text style={styles.studentBirth}>
                        Nacimiento: {item.birth_date}
                      </Text>
                    )}
                  </View>

                  {/* Badge de Estado */}
                  <View
                    style={[
                      styles.statusBadge,
                      isApproved && styles.statusBadgeApproved,
                      isSuspended && styles.statusBadgeSuspended,
                      isPending && styles.statusBadgePending,
                    ]}
                  >
                    <Ionicons
                      name={
                        isApproved
                          ? 'checkmark-circle'
                          : isSuspended
                          ? 'alert-circle'
                          : 'time'
                      }
                      size={13}
                      color={isApproved ? '#15803D' : isSuspended ? '#B91C1C' : '#B45309'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isApproved && styles.statusBadgeTextApproved,
                        isSuspended && styles.statusBadgeTextSuspended,
                        isPending && styles.statusBadgeTextPending,
                      ]}
                    >
                      {isApproved ? 'Activo' : isSuspended ? 'Suspendido' : 'Pendiente'}
                    </Text>
                  </View>
                </View>

                {/* Acciones de Autoridad */}
                <View style={styles.studentActionsRow}>
                  {isApproved && (
                    <TouchableOpacity
                      style={styles.actionBtnSuspend}
                      onPress={() => handleOpenSuspendModal(item)}
                      disabled={actionLoading}
                    >
                      <Ionicons name="pause-circle-outline" size={16} color="#DC2626" />
                      <Text style={styles.actionBtnSuspendText}>Suspender</Text>
                    </TouchableOpacity>
                  )}

                  {isSuspended && (
                    <TouchableOpacity
                      style={styles.actionBtnReactivate}
                      onPress={() => handleReactivate(item)}
                      disabled={actionLoading}
                    >
                      <Ionicons name="play-circle-outline" size={16} color="#15803D" />
                      <Text style={styles.actionBtnReactivateText}>Reactivar</Text>
                    </TouchableOpacity>
                  )}

                  {isPending && (
                    <TouchableOpacity
                      style={styles.actionBtnPending}
                      onPress={() => router.push('/(authority)/requests')}
                      disabled={actionLoading}
                    >
                      <Ionicons name="checkmark-done-outline" size={16} color="#1E3A8A" />
                      <Text style={styles.actionBtnPendingText}>Ver solicitud</Text>
                    </TouchableOpacity>
                  )}

                  {/* Botón Eliminar con validación estricta */}
                  <TouchableOpacity
                    style={styles.actionBtnDelete}
                    onPress={() => handleDelete(item)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="trash-outline" size={16} color="#64748B" />
                    <Text style={styles.actionBtnDeleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Modal para especificar motivo al suspender cuenta */}
      <Modal
        visible={suspendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuspendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="warning-outline" size={24} color="#B91C1C" />
              </View>
              <Text style={styles.modalTitle}>Suspender cuenta de estudiante</Text>
            </View>

            <Text style={styles.modalSub}>
              Estás por suspender a{' '}
              <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>
                {selectedStudent?.first_name} {selectedStudent?.last_name}
              </Text>
              . El estudiante no podrá iniciar sesión en la aplicación. Podés reactivar la cuenta en cualquier momento.
            </Text>

            <Text style={styles.modalInputLabel}>Motivo institucional de la medida:</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={3}
              value={suspendReason}
              onChangeText={setSuspendReason}
              placeholder="Ej.: Medida preventiva por uso indebido del canal o aplicación del Régimen de Convivencia."
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSuspendModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSuspendBtn}
                onPress={handleConfirmSuspend}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSuspendBtnText}>Confirmar Suspensión</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  courseHeaderCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  courseHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  courseBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseHeaderInfo: {
    flex: 1,
  },
  courseHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  courseHeaderSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  metricChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  metricChipApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  metricChipSuspended: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  metricChipPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  metricNumberActive: {
    color: '#1D4ED8',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  metricLabelActive: {
    color: '#1D4ED8',
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
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  clearFilterText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  studentCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarCircleSuspended: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  avatarCirclePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  avatarTextSuspended: {
    color: '#DC2626',
  },
  avatarTextPending: {
    color: '#D97706',
  },
  studentInfoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  studentDni: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  studentBirth: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statusBadgeSuspended: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextApproved: {
    color: '#15803D',
  },
  statusBadgeTextSuspended: {
    color: '#B91C1C',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  studentActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  actionBtnSuspend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF1F2',
  },
  actionBtnSuspendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionBtnReactivate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  actionBtnReactivateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  actionBtnPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  actionBtnPendingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  actionBtnDeleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
  },
  emptyBtnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderColor: '#1E3A8A',
    borderWidth: 1.5,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
  },
  modalSub: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
    height: 72,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalSuspendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  modalSuspendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
