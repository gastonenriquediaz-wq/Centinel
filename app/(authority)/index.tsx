import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';
import { StudentsService } from '../../src/services/students.service';
import { ReportsService } from '../../src/services/reports.service';
import { useReportsStore } from '../../src/store/reports.store';
import { CasesService } from '../../src/services/cases.service';

export default function AuthorityDashboard() {
  const insets = useSafeAreaInsets();
  const { profile, institution, reset } = useAuthStore();
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [sentReportsCount, setSentReportsCount] = useState<number>(0);
  const [inProgressReportsCount, setInProgressReportsCount] = useState<number>(0);
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0);

  const loadDashboardMetrics = async () => {
    if (!profile?.institution_id) return;
    try {
      // 1. Solicitudes pendientes de registro
      const requests = await StudentsService.getPendingRequests(profile.institution_id);
      setPendingRequestsCount(requests.length);

      // 2. Reportes: enviados ('sent') y en seguimiento ('in_progress')
      const { data: allReports } = await ReportsService.getInstitutionReports(
        profile.institution_id
      );

      if (allReports) {
        const sentReports = allReports.filter((r) => r.status === 'sent');
        const inProgressReports = allReports.filter((r) => r.status === 'in_progress');

        setSentReportsCount(sentReports.length);
        setInProgressReportsCount(inProgressReports.length);
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
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseás cerrar la sesión de autoridad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.signOut();
            } finally {
              reset();
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Centinel',
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '800',
            color: '#FFFFFF',
          },
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerRight: () => (
            <View style={styles.headerRightIcons}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert(
                    'Perfil de Autoridad',
                    `Usuario: ${profile?.first_name} ${profile?.last_name}\nCargo: ${profile?.position || 'Director'}\nInstitución: ${institution?.name || ''}`
                  )
                }
                style={styles.headerIconBtn}
              >
                <Ionicons name="person-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert(
                    'Configuración',
                    `Centinel v1.0.0\n${institution?.name || ''}\nSistema de Convivencia Escolar.`
                  )
                }
                style={styles.headerIconBtn}
              >
                <Ionicons name="settings-sharp" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
      >
        <Text style={styles.pageTitle}>Panel de autoridad</Text>

        {/* Tarjeta de Usuario / Autoridad */}
        <View style={styles.userCard}>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadgeBox}>
              <Text style={styles.roleBadgeText}>AUTORIDAD EDUCATIVA</Text>
            </View>
            <View style={styles.positionBadgeBox}>
              <Text style={styles.positionBadgeText}>
                {profile?.position || 'Director'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>
            {profile?.first_name} {profile?.last_name}
          </Text>
          <Text style={styles.institutionName}>
            {institution?.name || 'Institución educativa'}
          </Text>
        </View>

        {/* Sección: Resumen Institucional */}
        <Text style={styles.sectionHeader}>Resumen institucional</Text>
        <View style={styles.statsGrid}>
          {/* Fila 1 */}
          <View style={styles.statsRow}>
            {/* Reportes nuevos -> Navega a Reportes recibidos con filtro 'sent' (Enviado) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(authority)/reports?filter=sent')}
              style={styles.statCard}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="document-text" size={20} color="#2563EB" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Reportes nuevos</Text>
                <Text style={[styles.statValue, { color: '#1D4ED8' }]}>{sentReportsCount}</Text>
              </View>
            </TouchableOpacity>

            {/* Reportes en seguimiento -> Navega a Reportes recibidos con filtro 'in_progress' (En seguimiento) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(authority)/reports?filter=in_progress')}
              style={styles.statCard}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={20} color="#D97706" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Reportes en seguimiento</Text>
                <Text style={[styles.statValue, { color: '#B45309' }]}>
                  {inProgressReportsCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Fila 2 */}
          <View style={styles.statsRow}>
            {/* Casos abiertos -> Navega a Casos y protocolos con filtro 'active' (Abiertos y En investigación) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(authority)/cases?filter=active')}
              style={styles.statCard}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="folder" size={20} color="#DC2626" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Casos abiertos</Text>
                <Text style={[styles.statValue, { color: '#DC2626' }]}>{activeCasesCount}</Text>
              </View>
            </TouchableOpacity>

            {/* Registros pendientes -> Navega a Solicitudes de registro */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(authority)/requests')}
              style={styles.statCard}
            >
              <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="people" size={20} color="#7C3AED" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Registros pendientes</Text>
                <Text style={[styles.statValue, { color: '#7C3AED' }]}>
                  {pendingRequestsCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección: Gestión Institucional */}
        <Text style={styles.sectionHeader}>Gestión institucional</Text>

        {/* 1. Reportes recibidos */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(authority)/reports')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="megaphone" size={20} color="#2563EB" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Reportes recibidos</Text>
            <Text style={styles.actionDesc}>
              Consultar comunicaciones, evidencias y mensajes enviados por estudiantes.
            </Text>
          </View>
          {sentReportsCount > 0 && (
            <View style={styles.newReportBadge}>
              <Text style={styles.newReportBadgeText}>{sentReportsCount} nuevo{sentReportsCount > 1 ? 's' : ''}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* 2. Gestión de casos */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(authority)/cases')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="folder-outline" size={20} color="#D97706" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Gestión de casos</Text>
            <Text style={styles.actionDesc}>
              Administrar casos institucionales, actuaciones y estados de seguimiento.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* 3. Solicitudes de registro */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(authority)/requests')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="people-outline" size={20} color="#7C3AED" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Solicitudes de registro</Text>
            <Text style={styles.actionDesc}>
              Aprobar o rechazar cuentas estudiantiles pendientes.
            </Text>
          </View>
          {pendingRequestsCount > 0 && (
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{pendingRequestsCount} pendiente{pendingRequestsCount > 1 ? 's' : ''}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* 4. Cursos y códigos de registro */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(authority)/courses')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="grid-outline" size={20} color="#0284C7" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Cursos y códigos de registro</Text>
            <Text style={styles.actionDesc}>
              Administrar cursos y generar códigos QR o alfanuméricos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* 5. Aprender y prevenir */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(authority)/education')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="book-outline" size={20} color="#16A34A" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Aprender y prevenir</Text>
            <Text style={styles.actionDesc}>
              Consultar contenidos educativos sobre acoso escolar, ciberacoso y convivencia.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Botón Cerrar Sesión */}
        <Button
          title="Cerrar sesión"
          variant="outline"
          onPress={handleLogout}
          style={styles.logoutButton}
          textStyle={styles.logoutButtonText}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 6,
  },
  headerIconBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  userCard: {
    backgroundColor: '#F0F6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  roleBadgeBox: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  positionBadgeBox: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  positionBadgeText: {
    color: '#1E3A8A',
    fontSize: 11,
    fontWeight: '700',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  institutionName: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
  },
  statsGrid: {
    gap: 10,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 14,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  newReportBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newReportBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  caseBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  caseBadgeText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  requestBadge: {
    backgroundColor: '#F3E8FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  requestBadgeText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 8,
    borderColor: '#1E3A8A',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  logoutButtonText: {
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 14,
  },
});
