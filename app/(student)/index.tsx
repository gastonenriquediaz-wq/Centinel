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

      {/* Accesos rápidos de Reportes */}
      <Card style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Comunicación y Reportes</Text>
        <Text style={styles.actionDesc}>
          Si estás atravesando o presencias una situación de hostigamiento o conflicto, puedes comunicarla de forma confidencial.
        </Text>
        <View style={styles.actionButtons}>
          <Button
            title="➕ Crear Nuevo Reporte"
            onPress={() => router.push('/(student)/reports/new')}
            style={styles.primaryActionButton}
          />
          <Button
            title="📋 Mis Reportes Enviados"
            variant="outline"
            onPress={() => router.push('/(student)/reports')}
            style={styles.secondaryActionButton}
          />
        </View>
      </Card>

      {/* Acceso al Módulo Educativo */}
      <Card style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Módulo Educativo y Preventivo</Text>
        <Text style={styles.actionDesc}>
          Información clara y orientativa sobre acoso escolar, ciberacoso, convivencia y cuándo solicitar acompañamiento.
        </Text>
        <Button
          title="📖 Aprender y Prevenir"
          variant="outline"
          onPress={() => router.push('/(student)/education')}
          style={styles.educationButton}
        />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Espacio de Comunicación Segura</Text>
        <Text style={styles.infoText}>
          Tus reportes son confidenciales y solo pueden ser leídos por los directivos y autoridades habilitadas de tu institución.
        </Text>
        <Text style={styles.noteText}>
          ⚠️ En situaciones de riesgo físico inmediato o urgencias graves, comunícate de inmediato con las líneas 911 o 102.
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
  actionCard: {
    padding: 20,
    marginBottom: 16,
    borderColor: '#E2E8F0',
  },
  actionDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  actionButtons: {
    gap: 10,
  },
  primaryActionButton: {
    width: '100%',
  },
  secondaryActionButton: {
    width: '100%',
  },
  educationButton: {
    width: '100%',
    borderColor: '#1E3A8A',
  },
  infoCard: {
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
  noteText: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 'auto',
  },
});
