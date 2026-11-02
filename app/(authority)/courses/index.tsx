import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { CoursesService } from '../../../src/services/courses.service';
import { Course } from '../../../src/types/database.types';

export default function CoursesListScreen() {
  const { profile } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <FlatList
          data={courses}
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
