import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';

export default function AuthorityDashboard() {
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
        <View style={styles.badgeRow}>
          <Text style={styles.roleBadge}>Autoridad Educativa</Text>
          {profile?.position && (
            <Text style={styles.positionBadge}>{profile.position}</Text>
          )}
        </View>
        <Text style={styles.userName}>
          {profile?.first_name} {profile?.last_name}
        </Text>
        <Text style={styles.institutionName}>
          {institution?.name || 'Institución educativa'}
        </Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Panel Institucional</Text>
        <Text style={styles.infoText}>
          Bienvenido al entorno de gestión y recepción de situaciones de acoso escolar y convivencia.
        </Text>
        <Text style={styles.subtext}>
          En los siguientes incrementos tendrás acceso a la generación de códigos QR, recepción de reportes y seguimiento de casos.
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
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#166534',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  positionBadge: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  institutionName: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
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
  subtext: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: 'auto',
  },
});
