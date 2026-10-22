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
import { router, useFocusEffect } from 'expo-router';
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cursos Institucionales</Text>
        <Button
          title="+ Nuevo Curso"
          onPress={() => router.push('/(authority)/courses/new')}
          style={styles.newButton}
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
            Creá los cursos correspondientes al ciclo lectivo para que los estudiantes puedan incorporarse con códigos QR.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.courseCard}>
              <View style={styles.courseInfo}>
                <Text style={styles.courseName}>
                  {item.year}° "{item.division}"
                </Text>
                <Text style={styles.courseDetails}>
                  Turno: {item.shift} · Ciclo: {item.school_year}
                </Text>
                <Text style={styles.courseCap}>
                  Capacidad estimada: {item.estimated_students} estudiantes
                </Text>
              </View>

              <Button
                title="Generar QR"
                onPress={() => router.push(`/(authority)/courses/${item.id}/qr`)}
                style={styles.qrButton}
              />
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  newButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  courseCard: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  courseInfo: {
    flex: 1,
    marginRight: 12,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  courseDetails: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  courseCap: {
    fontSize: 12,
    color: '#64748B',
  },
  qrButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    textAlign: 'center',
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
