import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, Stack } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { StudentsService, StudentWithCourse } from '../../../src/services/students.service';

export default function PendingRequestsScreen() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<StudentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!profile?.institution_id) return;
    try {
      setError(null);
      const data = await StudentsService.getPendingRequests(profile.institution_id);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [profile?.institution_id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleApprove = async (student: StudentWithCourse) => {
    try {
      setProcessingId(student.id);
      await StudentsService.updateAccountStatus(student.id, 'approved');
      // Remover de la lista
      setRequests((prev) => prev.filter((r) => r.id !== student.id));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo aprobar la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (student: StudentWithCourse) => {
    try {
      setProcessingId(student.id);
      await StudentsService.updateAccountStatus(student.id, 'rejected');
      setRequests((prev) => prev.filter((r) => r.id !== student.id));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo rechazar la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Solicitudes de Registro', headerBackTitle: 'Inicio' }} />
      <Text style={styles.title}>Solicitudes de Registro</Text>
      <Text style={styles.subtitle}>
        Estudiantes que completaron el registro mediante código QR y aguardan habilitación institucional.
      </Text>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" onPress={loadRequests} style={styles.retryButton} />
        </Card>
      ) : requests.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No hay solicitudes pendientes</Text>
          <Text style={styles.emptySubtitle}>
            Cuando los estudiantes escaneen el código QR de un curso y completen sus datos, aparecerán aquí para su aprobación.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isProcessing = processingId === item.id;
            return (
              <Card style={styles.requestCard}>
                <View style={styles.headerItem}>
                  <Text style={styles.studentName}>
                    {item.last_name}, {item.first_name}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Pendiente</Text>
                  </View>
                </View>

                <View style={styles.detailsBox}>
                  <Text style={styles.detailRow}>
                    <Text style={styles.detailLabel}>DNI: </Text>
                    {item.dni || 'Sin documento'}
                  </Text>
                  <Text style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nacimiento: </Text>
                    {item.birth_date || 'No registrada'}
                  </Text>
                  <Text style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Curso solicitado: </Text>
                    {item.course
                      ? `${item.course.year}° "${item.course.division}" (Turno ${item.course.shift})`
                      : 'No especificado'}
                  </Text>
                  <Text style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha solicitud: </Text>
                    {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Button
                    title="Aprobar"
                    variant="primary"
                    onPress={() => handleApprove(item)}
                    loading={isProcessing}
                    style={styles.approveButton}
                  />
                  <Button
                    title="Rechazar"
                    variant="danger"
                    onPress={() => handleReject(item)}
                    disabled={isProcessing}
                    style={styles.rejectButton}
                  />
                </View>
              </Card>
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
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
    textAlign: 'justify',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  requestCard: {
    marginBottom: 14,
    padding: 16,
  },
  headerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  detailRow: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#1E3A8A',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  approveButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#16A34A',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 10,
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
