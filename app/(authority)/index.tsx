import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';
import { StudentsService } from '../../src/services/students.service';

export default function AuthorityDashboard() {
  const { profile, institution, reset } = useAuthStore();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const loadPendingCount = async () => {
    if (!profile?.institution_id) return;
    try {
      const requests = await StudentsService.getPendingRequests(profile.institution_id);
      setPendingCount(requests.length);
    } catch {
      // Ignorar fallo visual
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPendingCount();
    }, [profile?.institution_id])
  );

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

      <Text style={styles.sectionHeader}>Gestión Institucional</Text>

      {/* Acceso a Solicitudes de Registro */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(authority)/requests')}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Solicitudes de Registro</Text>
            <Text style={styles.menuDesc}>
              Aprobación y rechazo de cuentas estudiantiles registradas con código QR.
            </Text>
          </View>
          {pendingCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingCount}</Text>
            </View>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Card>
      </TouchableOpacity>

      {/* Acceso a Cursos y QR */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(authority)/courses')}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Cursos y Códigos QR</Text>
            <Text style={styles.menuDesc}>
              Administrar cursos de la institución y generar códigos QR de 5 minutos para alumnos.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Card>
      </TouchableOpacity>

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
    padding: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  welcomeCard: {
    padding: 18,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  institutionName: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
  },
  menuInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  countBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '300',
  },
  logoutButton: {
    marginTop: 'auto',
    paddingVertical: 12,
  },
});
