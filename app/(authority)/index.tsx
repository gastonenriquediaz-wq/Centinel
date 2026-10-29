import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';
import { StudentsService } from '../../src/services/students.service';
import { ReportsService } from '../../src/services/reports.service';
import { CasesService } from '../../src/services/cases.service';

export default function AuthorityDashboard() {
  const { profile, institution, reset } = useAuthStore();
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [sentReportsCount, setSentReportsCount] = useState<number>(0);
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0);

  const loadDashboardMetrics = async () => {
    if (!profile?.institution_id) return;
    try {
      // 1. Solicitudes pendientes de registro
      const requests = await StudentsService.getPendingRequests(profile.institution_id);
      setPendingRequestsCount(requests.length);

      // 2. Reportes con estado 'sent' (pendientes de revisión)
      const { data: sentReports } = await ReportsService.getInstitutionReports(
        profile.institution_id,
        'sent'
      );
      if (sentReports) {
        setSentReportsCount(sentReports.length);
      }

      // 3. Casos activos ('open' o 'under_investigation')
      const { data: cases } = await CasesService.getInstitutionCases(profile.institution_id);
      if (cases) {
        const active = cases.filter((c) => c.status !== 'resolved');
        setActiveCasesCount(active.length);
      }
    } catch {
      // Fallo silencioso en dashboard
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardMetrics();
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

      {/* Acceso a Recepción de Reportes */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(authority)/reports')}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Recepción de Reportes</Text>
            <Text style={styles.menuDesc}>
              Bandeja de comunicaciones y evidencias enviadas por los alumnos.
            </Text>
          </View>
          {sentReportsCount > 0 ? (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{sentReportsCount} nuevo(s)</Text>
            </View>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Card>
      </TouchableOpacity>

      {/* Acceso a Casos y Protocolos de Actuación */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(authority)/cases')}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Casos y Protocolos</Text>
            <Text style={styles.menuDesc}>
              Expedientes formales, actas de entrevistas, acuerdos y resoluciones.
            </Text>
          </View>
          {activeCasesCount > 0 ? (
            <View style={styles.caseCountBadge}>
              <Text style={styles.caseCountText}>{activeCasesCount} activo(s)</Text>
            </View>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Card>
      </TouchableOpacity>

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
          {pendingRequestsCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingRequestsCount}</Text>
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

      {/* Acceso a Módulo Educativo y Preventivo */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(authority)/education')}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Módulo Educativo y Preventivo</Text>
            <Text style={styles.menuDesc}>
              Guías pedagógicas, criterios formativos sobre acoso escolar, ciberacoso y convivencia.
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
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  welcomeCard: {
    padding: 20,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#1E3A8A',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  positionBadge: {
    backgroundColor: '#DBEAFE',
    color: '#1E3A8A',
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
    color: '#1E3A8A',
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
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
    paddingRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  countBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  alertBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  alertBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  caseCountBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  caseCountText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '300',
  },
  logoutButton: {
    marginTop: 20,
    marginBottom: 20,
  },
});
