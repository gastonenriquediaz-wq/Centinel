import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';

export default function StudentDashboard() {
  const { profile, institution, reset } = useAuthStore();

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
    } finally {
      reset();
      router.replace('/(auth)/login');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.welcomeCard}>
        <Text style={styles.roleBadge}>Estudiante</Text>
        <Text style={styles.userName}>
          ¡Hola, {profile?.first_name} {profile?.last_name}!
        </Text>
        <Text style={styles.institutionName}>
          {institution?.name || 'Institución educativa'}
        </Text>
        <Text style={styles.dniText}>DNI: {profile?.dni || 'No registrado'}</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Espacio de Comunicación Segura</Text>
        <Text style={styles.infoText}>
          Desde aquí podrás comunicar situaciones de preocupación escolar directamente a las autoridades de tu institución.
        </Text>
        <Text style={styles.noteText}>
          Tus reportes y mensajes son privados y solo accesibles por las autoridades autorizadas de tu colegio.
        </Text>
      </Card>

      <Button
        title="Cerrar Sesión"
        variant="outline"
        onPress={handleLogout}
        style={styles.logoutButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  welcomeCard: {
    padding: 20,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E3A8A',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  institutionName: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  dniText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  infoCard: {
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: 'auto',
  },
});
