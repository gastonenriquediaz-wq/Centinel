import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { CasesService } from '../../../src/services/cases.service';
import { CoursesService } from '../../../src/services/courses.service';
import { StudentsService } from '../../../src/services/students.service';
import { Report, Case, Course, ShiftType } from '../../../src/types/database.types';
import { shareStatisticsReportAsPdf } from '../../../src/utils/pdfExport';

const CANONICAL_SITUATIONS = [
  {
    match: 'Agresión física',
    label: 'Agresión física (golpes, empujones)',
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: 'hand-left-outline' as const,
  },
  {
    match: 'Burlas, insultos',
    label: 'Burlas, insultos o humillaciones',
    color: '#D97706',
    bg: '#FEF3C7',
    icon: 'chatbubble-ellipses-outline' as const,
  },
  {
    match: 'Acoso o agresiones por internet',
    label: 'Acoso o agresiones por internet',
    color: '#7C3AED',
    bg: '#F3E8FF',
    icon: 'phone-portrait-outline' as const,
  },
  {
    match: 'Exclusión o aislamiento',
    label: 'Exclusión o aislamiento social',
    color: '#2563EB',
    bg: '#EFF6FF',
    icon: 'people-outline' as const,
  },
  {
    match: 'Amenazas o intimidación',
    label: 'Amenazas o intimidación',
    color: '#B91C1C',
    bg: '#FEE2E2',
    icon: 'warning-outline' as const,
  },
  {
    match: 'Daño o robo',
    label: 'Daño o robo de pertenencias',
    color: '#0284C7',
    bg: '#E0F2FE',
    icon: 'briefcase-outline' as const,
  },
];

const CANONICAL_LOCATIONS = [
  {
    match: 'Dentro del aula',
    label: 'Dentro del aula',
    icon: 'easel-outline' as const,
    color: '#1E3A8A',
  },
  {
    match: 'Patio o recreo',
    label: 'Patio o recreo',
    icon: 'sunny-outline' as const,
    color: '#D97706',
  },
  {
    match: 'Internet, redes sociales',
    label: 'Internet, redes sociales o mensajes',
    icon: 'globe-outline' as const,
    color: '#7C3AED',
  },
  {
    match: 'Baños',
    label: 'Baños',
    icon: 'water-outline' as const,
    color: '#0284C7',
  },
  {
    match: 'Entrada o salida',
    label: 'Entrada o salida del colegio',
    icon: 'walk-outline' as const,
    color: '#16A34A',
  },
  {
    match: 'Cerca del colegio',
    label: 'Cerca del colegio',
    icon: 'location-outline' as const,
    color: '#EA580C',
  },
];

const SHIFT_FILTERS: ('Todos' | ShiftType)[] = [
  'Todos',
  'Mañana',
  'Tarde',
  'Noche',
  'Jornada Completa',
];

export default function AuthorityStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, institution } = useAuthStore();

  const [reports, setReports] = useState<Report[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [shiftFilter, setShiftFilter] = useState<'Todos' | ShiftType>('Todos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadAllData = async () => {
    if (!profile?.institution_id) return;
    try {
      const [reportsRes, casesRes, coursesData, studentsData] = await Promise.all([
        ReportsService.getInstitutionReports(profile.institution_id),
        CasesService.getInstitutionCases(profile.institution_id),
        CoursesService.getCourses(profile.institution_id),
        StudentsService.getStudentsByInstitution(profile.institution_id),
      ]);

      if (reportsRes.data) setReports(reportsRes.data);
      if (casesRes.data) setCases(casesRes.data);
      setCourses(coursesData || []);
      const approvedStudents = (studentsData || []).filter((s) => s.account_status === 'approved');
      setTotalStudentsCount(approvedStudents.length);
    } catch (e) {
      console.warn('Error cargando estadísticas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [profile?.institution_id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // Mapa rápido de cursos por ID
  const courseMap = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  // Reportes filtrados por turno seleccionado
  const filteredReports = useMemo(() => {
    if (shiftFilter === 'Todos') return reports;
    return reports.filter((r) => {
      const c = r.course || (r.course_id ? courseMap.get(r.course_id) : undefined);
      return c?.shift === shiftFilter;
    });
  }, [reports, shiftFilter, courseMap]);

  // Casos filtrados por turno seleccionado (según el reporte vinculado)
  const filteredCases = useMemo(() => {
    if (shiftFilter === 'Todos') return cases;
    const validReportIds = new Set(filteredReports.map((r) => r.id));
    return cases.filter((c) => validReportIds.has(c.report_id));
  }, [cases, filteredReports, shiftFilter]);

  // 1. Indicadores Generales (KPIs)
  const kpis = useMemo(() => {
    const totalReports = filteredReports.length;
    const sentCount = filteredReports.filter((r) => r.status === 'sent').length;
    const inProgressCount = filteredReports.filter((r) => r.status === 'in_progress').length;
    const finalizedCount = filteredReports.filter((r) => r.status === 'finalized').length;
    const closedNoCaseCount = filteredReports.filter((r) => r.status === 'closed_no_case').length;

    const attendedCount = inProgressCount + finalizedCount + closedNoCaseCount;
    const attentionRate = totalReports > 0 ? Math.round((attendedCount / totalReports) * 100) : 0;

    const totalCases = filteredCases.length;
    const openCases = filteredCases.filter((c) => c.status === 'open').length;
    const trackingCases = filteredCases.filter((c) => c.status === 'under_investigation').length;
    const resolvedCases = filteredCases.filter((c) => c.status === 'resolved').length;
    const caseResolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

    return {
      totalReports,
      sentCount,
      inProgressCount,
      finalizedCount,
      closedNoCaseCount,
      attendedCount,
      attentionRate,
      totalCases,
      openCases,
      trackingCases,
      resolvedCases,
      caseResolutionRate,
    };
  }, [filteredReports, filteredCases]);

  // 2. Estadísticas por Tipo de Situación
  const situationStats = useMemo(() => {
    const counts = CANONICAL_SITUATIONS.map((item) => ({
      ...item,
      count: 0,
    }));
    let otherCount = 0;

    filteredReports.forEach((rep) => {
      const raw = (rep.situation_type || '').toLowerCase();
      let matchedAny = false;

      counts.forEach((c) => {
        if (raw.includes(c.match.toLowerCase())) {
          c.count += 1;
          matchedAny = true;
        }
      });

      if (raw.includes('otro:') || raw.includes('otra situación') || !matchedAny) {
        otherCount += 1;
      }
    });

    const allItems = [
      ...counts,
      ...(otherCount > 0
        ? [
            {
              match: 'Otro',
              label: 'Otra situación comunicada',
              color: '#64748B',
              bg: '#F1F5F9',
              icon: 'ellipsis-horizontal-circle-outline' as const,
              count: otherCount,
            },
          ]
        : []),
    ];

    const totalMentions = allItems.reduce((acc, item) => acc + item.count, 0);

    return allItems
      .map((item) => ({
        ...item,
        percentage: totalMentions > 0 ? Math.round((item.count / totalMentions) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReports]);

  // 3. Estadísticas por Lugar del Hecho
  const locationStats = useMemo(() => {
    const counts = CANONICAL_LOCATIONS.map((item) => ({
      ...item,
      count: 0,
    }));
    let otherLocCount = 0;

    filteredReports.forEach((rep) => {
      const raw = (rep.location || '').toLowerCase();
      let matchedAny = false;

      counts.forEach((c) => {
        if (raw.includes(c.match.toLowerCase())) {
          c.count += 1;
          matchedAny = true;
        }
      });

      if (raw.includes('otro:') || raw.includes('no sé') || !matchedAny) {
        otherLocCount += 1;
      }
    });

    const allLocs = [
      ...counts,
      ...(otherLocCount > 0
        ? [
            {
              match: 'Otro',
              label: 'Otro lugar / No especificado',
              icon: 'help-circle-outline' as const,
              color: '#64748B',
              count: otherLocCount,
            },
          ]
        : []),
    ];

    const totalMentions = allLocs.reduce((acc, item) => acc + item.count, 0);

    return allLocs
      .map((item) => ({
        ...item,
        percentage: totalMentions > 0 ? Math.round((item.count / totalMentions) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReports]);

  // 4. Estadísticas por Frecuencia / Severidad de Repetición
  const frequencyStats = useMemo(() => {
    let daily = 0;
    let frequent = 0;
    let several = 0;
    let once = 0;
    let unknown = 0;

    filteredReports.forEach((rep) => {
      const f = (rep.frequency || '').toLowerCase();
      if (f.includes('todos los días') || f.includes('diario')) {
        daily += 1;
      } else if (f.includes('frecuente')) {
        frequent += 1;
      } else if (f.includes('varias veces') || f.includes('a veces')) {
        several += 1;
      } else if (f.includes('una sola vez') || f.includes('una vez')) {
        once += 1;
      } else {
        unknown += 1;
      }
    });

    const total = filteredReports.length;
    const highRecurrence = daily + frequent;
    const highRecurrencePct = total > 0 ? Math.round((highRecurrence / total) * 100) : 0;

    return {
      daily,
      frequent,
      several,
      once,
      unknown,
      highRecurrence,
      highRecurrencePct,
    };
  }, [filteredReports]);

  // 5. Incidencia por Curso
  const courseStats = useMemo(() => {
    const filteredCoursesList =
      shiftFilter === 'Todos' ? courses : courses.filter((c) => c.shift === shiftFilter);

    const list = filteredCoursesList.map((course) => {
      const courseReports = filteredReports.filter(
        (r) => r.course_id === course.id || r.course?.id === course.id
      );
      const activeCasesForCourse = courseReports.filter(
        (r) => r.status === 'in_progress'
      ).length;

      return {
        course,
        reportsCount: courseReports.length,
        activeCasesCount: activeCasesForCourse,
      };
    });

    return list.sort((a, b) => b.reportsCount - a.reportsCount);
  }, [courses, filteredReports, shiftFilter]);

  // 6. Diagnóstico Pedagógico Automático
  const diagnosticInsight = useMemo(() => {
    if (filteredReports.length === 0) return null;

    const topSituation = situationStats.find((s) => s.count > 0);
    const topLocation = locationStats.find((l) => l.count > 0);
    const topCourse = courseStats.find((c) => c.reportsCount > 0);

    return {
      topSituation,
      topLocation,
      topCourse,
    };
  }, [filteredReports, situationStats, locationStats, courseStats]);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await shareStatisticsReportAsPdf({
        institution,
        profile,
        shiftFilter,
        totalStudentsCount,
        kpis,
        situationStats,
        locationStats,
        frequencyStats,
        courseStats,
      });
    } catch (err: any) {
      Alert.alert(
        'Error al generar PDF',
        err.message || 'No se pudo generar o compartir el informe estadístico en PDF.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Estadísticas de Convivencia',
          headerBackTitle: 'Inicio',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Calculando indicadores institucionales...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 24) + 28 },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Encabezado Institucional */}
          <View style={styles.headerBanner}>
            <View style={styles.headerBannerRow}>
              <View style={styles.headerIconBox}>
                <Ionicons name="stats-chart" size={24} color="#1E3A8A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Métricas de Convivencia Escolar</Text>
                <Text style={styles.headerSubtitle}>
                  {institution?.name || 'Institución Educativa'} · {totalStudentsCount} estudiantes activos
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.exportTopBtn, exportingPdf && { opacity: 0.7 }]}
              onPress={handleExportPdf}
              disabled={exportingPdf}
              activeOpacity={0.8}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.exportTopBtnText}>
                {exportingPdf
                  ? 'Generando PDF...'
                  : 'Compartir / Descargar Informe Estadístico en PDF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filtro por Turno */}
          <Text style={styles.filterLabel}>Filtrar métricas por turno:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shiftsRow}
          >
            {SHIFT_FILTERS.map((shift) => {
              const active = shiftFilter === shift;
              return (
                <TouchableOpacity
                  key={shift}
                  style={[styles.shiftChip, active && styles.shiftChipActive]}
                  onPress={() => setShiftFilter(shift)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.shiftChipText, active && styles.shiftChipTextActive]}>
                    {shift === 'Todos' ? 'Todos los turnos' : `Turno ${shift}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* SECCIÓN 1: KPIs Principales */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { borderLeftColor: '#2563EB' }]}>
                <Text style={styles.kpiLabel}>Reportes totales</Text>
                <Text style={[styles.kpiValue, { color: '#1E3A8A' }]}>{kpis.totalReports}</Text>
                <Text style={styles.kpiFoot}>
                  {kpis.sentCount} sin intervenir · {kpis.attendedCount} gestionados
                </Text>
              </View>

              <View style={[styles.kpiCard, { borderLeftColor: '#16A34A' }]}>
                <Text style={styles.kpiLabel}>Tasa de atención</Text>
                <Text style={[styles.kpiValue, { color: '#15803D' }]}>{kpis.attentionRate}%</Text>
                <Text style={styles.kpiFoot}>
                  {kpis.inProgressCount} en seg. · {kpis.finalizedCount} finalizados
                </Text>
              </View>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { borderLeftColor: '#D97706' }]}>
                <Text style={styles.kpiLabel}>Expedientes de caso</Text>
                <Text style={[styles.kpiValue, { color: '#B45309' }]}>{kpis.totalCases}</Text>
                <Text style={styles.kpiFoot}>
                  {kpis.openCases} abiertos · {kpis.trackingCases} en seguimiento
                </Text>
              </View>

              <View style={[styles.kpiCard, { borderLeftColor: '#7C3AED' }]}>
                <Text style={styles.kpiLabel}>Casos resueltos</Text>
                <Text style={[styles.kpiValue, { color: '#6D28D9' }]}>
                  {kpis.resolvedCases} ({kpis.caseResolutionRate}%)
                </Text>
                <Text style={styles.kpiFoot}>Con acta de acuerdo y cierre</Text>
              </View>
            </View>
          </View>

          {/* Diagnóstico Inteligente */}
          {diagnosticInsight && (
            <Card style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons name="bulb" size={20} color="#1E3A8A" />
                <Text style={styles.insightTitle}>Síntesis Diagnóstica para Dirección</Text>
              </View>
              <Text style={styles.insightText}>
                • <Text style={styles.insightBold}>Tipología predominante:</Text>{' '}
                {diagnosticInsight.topSituation
                  ? `${diagnosticInsight.topSituation.label} (${diagnosticInsight.topSituation.count} menciones, ${diagnosticInsight.topSituation.percentage}% del total).`
                  : 'Sin datos suficientes.'}
              </Text>
              <Text style={styles.insightText}>
                • <Text style={styles.insightBold}>Espacio crítico:</Text>{' '}
                {diagnosticInsight.topLocation
                  ? `${diagnosticInsight.topLocation.label} (${diagnosticInsight.topLocation.percentage}% de ocurrencia).`
                  : 'Sin datos suficientes.'}
              </Text>
              {diagnosticInsight.topCourse && (
                <Text style={styles.insightText}>
                  • <Text style={styles.insightBold}>Curso con mayor demanda:</Text>{' '}
                  {`${diagnosticInsight.topCourse.course.year}° "${diagnosticInsight.topCourse.course.division}" (${diagnosticInsight.topCourse.course.shift}) con ${diagnosticInsight.topCourse.reportsCount} reporte(s).`}
                </Text>
              )}
            </Card>
          )}

          {/* SECCIÓN 2: Tipologías de Acoso y Conflicto */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="pie-chart-outline" size={20} color="#1E3A8A" />
              <Text style={styles.sectionTitle}>Incidencia por Tipo de Situación</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Distribución de las problemáticas comunicadas por los estudiantes (un reporte puede incluir más de una modalidad).
            </Text>

            {filteredReports.length === 0 ? (
              <Text style={styles.emptyMetricText}>
                No hay reportes registrados para el filtro seleccionado.
              </Text>
            ) : (
              <View style={styles.barsList}>
                {situationStats.map((item) => (
                  <View key={item.label} style={styles.barItem}>
                    <View style={styles.barLabelRow}>
                      <View style={styles.barLabelLeft}>
                        <View style={[styles.barIconBadge, { backgroundColor: item.bg }]}>
                          <Ionicons name={item.icon} size={14} color={item.color} />
                        </View>
                        <Text style={styles.barLabelText} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </View>
                      <Text style={styles.barValueText}>
                        {item.count} ({item.percentage}%)
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(item.percentage, item.count > 0 ? 6 : 0)}%`,
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* SECCIÓN 3: Espacios Físicos y Digitales */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="location-outline" size={20} color="#1E3A8A" />
              <Text style={styles.sectionTitle}>Lugares de Mayor Ocurrencia</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Identificación de ámbitos escolares y virtuales para focalizar la prevención y el acompañamiento adulto.
            </Text>

            {filteredReports.length === 0 ? (
              <Text style={styles.emptyMetricText}>
                No hay datos de ubicación para mostrar.
              </Text>
            ) : (
              <View style={styles.barsList}>
                {locationStats.map((loc) => (
                  <View key={loc.label} style={styles.barItem}>
                    <View style={styles.barLabelRow}>
                      <View style={styles.barLabelLeft}>
                        <Ionicons
                          name={loc.icon}
                          size={16}
                          color={loc.color}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.barLabelText} numberOfLines={1}>
                          {loc.label}
                        </Text>
                      </View>
                      <Text style={styles.barValueText}>
                        {loc.count} ({loc.percentage}%)
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(loc.percentage, loc.count > 0 ? 6 : 0)}%`,
                            backgroundColor: loc.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* SECCIÓN 4: Nivel de Recurrencia y Persistencia */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="repeat-outline" size={20} color="#1E3A8A" />
              <Text style={styles.sectionTitle}>Frecuencia y Persistencia Temporal</Text>
            </View>
            <Text style={styles.sectionDesc}>
              La reiteración en el tiempo es un indicador clave para distinguir hechos aislados de situaciones de acoso escolar sostenido.
            </Text>

            <View style={styles.recurrenceBanner}>
              <View style={styles.recurrenceBannerLeft}>
                <Text style={styles.recurrenceRateValue}>
                  {frequencyStats.highRecurrencePct}%
                </Text>
                <Text style={styles.recurrenceRateSub}>Alta recurrencia</Text>
              </View>
              <View style={styles.recurrenceBannerRight}>
                <Text style={styles.recurrenceDetailText}>
                  <Text style={{ fontWeight: '700' }}>{frequencyStats.highRecurrence}</Text> de{' '}
                  {filteredReports.length} reportes corresponden a situaciones que ocurren{' '}
                  <Text style={{ fontWeight: '700' }}>frecuentemente o casi todos los días</Text>.
                </Text>
              </View>
            </View>

            <View style={styles.freqGrid}>
              <View style={styles.freqBox}>
                <Text style={[styles.freqCount, { color: '#DC2626' }]}>{frequencyStats.daily}</Text>
                <Text style={styles.freqLabel}>Casi todos los días</Text>
              </View>
              <View style={styles.freqBox}>
                <Text style={[styles.freqCount, { color: '#D97706' }]}>
                  {frequencyStats.frequent}
                </Text>
                <Text style={styles.freqLabel}>Frecuentemente</Text>
              </View>
              <View style={styles.freqBox}>
                <Text style={[styles.freqCount, { color: '#2563EB' }]}>
                  {frequencyStats.several}
                </Text>
                <Text style={styles.freqLabel}>Varias veces</Text>
              </View>
              <View style={styles.freqBox}>
                <Text style={[styles.freqCount, { color: '#16A34A' }]}>{frequencyStats.once}</Text>
                <Text style={styles.freqLabel}>Una sola vez</Text>
              </View>
            </View>
          </Card>

          {/* SECCIÓN 5: Incidencia por Curso y División */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="school-outline" size={20} color="#1E3A8A" />
              <Text style={styles.sectionTitle}>Incidencia por Curso y División</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Cursos ordenados según volumen de reportes emitidos. Tocá un curso para gestionar sus alumnos.
            </Text>

            {courseStats.length === 0 ? (
              <Text style={styles.emptyMetricText}>No hay cursos registrados.</Text>
            ) : (
              <View style={styles.coursesList}>
                {courseStats.map(({ course, reportsCount, activeCasesCount }) => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.courseStatRow}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/(authority)/courses/${course.id}/students`)}
                  >
                    <View style={styles.courseStatLeft}>
                      <View style={styles.courseAvatar}>
                        <Text style={styles.courseAvatarText}>
                          {course.year}°{course.division}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.courseStatTitle}>
                          {course.year}° "{course.division}" · Turno {course.shift}
                        </Text>
                        <Text style={styles.courseStatSub}>
                          Ciclo {course.school_year} · Capacidad: {course.estimated_students} est.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.courseStatRight}>
                      <View
                        style={[
                          styles.courseCountBadge,
                          reportsCount > 0 ? styles.courseCountBadgeActive : styles.courseCountBadgeZero,
                        ]}
                      >
                        <Text
                          style={[
                            styles.courseCountText,
                            reportsCount > 0 ? styles.courseCountTextActive : styles.courseCountTextZero,
                          ]}
                        >
                          {reportsCount} {reportsCount === 1 ? 'reporte' : 'reportes'}
                        </Text>
                      </View>
                      {activeCasesCount > 0 && (
                        <Text style={styles.courseActiveCasesText}>
                          {activeCasesCount} en seguimiento
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  container: {
    padding: 16,
  },
  headerBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
    gap: 12,
  },
  exportTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
  },
  exportTopBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  filterLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  shiftsRow: {
    gap: 8,
    paddingBottom: 14,
  },
  shiftChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shiftChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  shiftChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  shiftChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kpiGrid: {
    gap: 10,
    marginBottom: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  kpiFoot: {
    fontSize: 11,
    color: '#64748B',
  },
  insightCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14532D',
  },
  insightText: {
    fontSize: 12.5,
    color: '#166534',
    lineHeight: 18,
    marginBottom: 4,
  },
  insightBold: {
    fontWeight: '700',
    color: '#14532D',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  emptyMetricText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  barsList: {
    gap: 12,
  },
  barItem: {
    gap: 5,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  barIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  barLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  barValueText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  recurrenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  recurrenceBannerLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#FCA5A5',
    minWidth: 85,
  },
  recurrenceRateValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#DC2626',
  },
  recurrenceRateSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
    marginTop: 1,
  },
  recurrenceBannerRight: {
    flex: 1,
    paddingLeft: 12,
  },
  recurrenceDetailText: {
    fontSize: 12.5,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  freqGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  freqBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  freqCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  freqLabel: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
  },
  coursesList: {
    gap: 8,
  },
  courseStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  courseStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  courseAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  courseStatTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  courseStatSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  courseStatRight: {
    alignItems: 'flex-end',
  },
  courseCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  courseCountBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  courseCountBadgeZero: {
    backgroundColor: '#F1F5F9',
  },
  courseCountText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  courseCountTextActive: {
    color: '#1E3A8A',
  },
  courseCountTextZero: {
    color: '#64748B',
  },
  courseActiveCasesText: {
    fontSize: 10.5,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
});
