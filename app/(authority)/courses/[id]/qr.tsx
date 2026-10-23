import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { NativeQRCode } from '../../../../src/components/ui/NativeQRCode';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../src/store/auth.store';
import { CoursesService } from '../../../../src/services/courses.service';
import { Course, QRCode } from '../../../../src/types/database.types';

export default function CourseQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, user } = useAuthStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [qrData, setQrData] = useState<QRCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(300); // 5 minutos = 300 segundos
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos del curso y generar QR
  const loadAndGenerateQR = async () => {
    if (!id || !profile?.institution_id || !user?.id) return;

    try {
      setError(null);
      setGenerating(true);

      const courseData = await CoursesService.getCourseById(id);
      if (!courseData) {
        throw new Error('Curso no encontrado.');
      }
      setCourse(courseData);

      const newQr = await CoursesService.generateCourseQR({
        courseId: id,
        institutionId: profile.institution_id,
        userId: user.id,
      });

      setQrData(newQr);

      // Calcular segundos restantes
      const diffMs = new Date(newQr.expires_at).getTime() - Date.now();
      const initialSeconds = Math.max(0, Math.floor(diffMs / 1000));
      setSecondsLeft(initialSeconds);
    } catch (err: any) {
      setError(err.message || 'Error al generar el código QR.');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadAndGenerateQR();
  }, [id]);

  // Temporizador regresivo
  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const isExpired = secondsLeft === 0;

  // Formato mm:ss
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.courseHeader}>
          {course ? `${course.year}° "${course.division}"` : 'Cargando curso...'}
        </Text>
        <Text style={styles.courseSub}>
          Turno {course?.shift} · Ciclo Lectivo {course?.school_year}
        </Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#1E3A8A" />
            <Text style={styles.loadingText}>Generando código QR...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Reintentar" onPress={loadAndGenerateQR} style={styles.actionBtn} />
          </View>
        ) : qrData ? (
          <View style={styles.qrContainer}>
            {isExpired ? (
              <View style={styles.expiredOverlay}>
                <Text style={styles.expiredTitle}>Código Vencido</Text>
                <Text style={styles.expiredSub}>
                  Han transcurrido los 5 minutos de vigencia. Los estudiantes ya no podrán iniciar registro con este código.
                </Text>
                <Button
                  title="Generar Nuevo Código QR"
                  onPress={loadAndGenerateQR}
                  loading={generating}
                  style={styles.actionBtn}
                />
              </View>
            ) : (
              <>
                <View style={styles.qrBox}>
                  <NativeQRCode
                    value={qrData.code_token}
                    size={240}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                </View>

                <View style={styles.timerBadge}>
                  <Text style={styles.timerLabel}>Tiempo restante de validez:</Text>
                  <Text style={styles.timerValue}>{timeFormatted}</Text>
                </View>

                <Text style={styles.instructionText}>
                  Los estudiantes deben escanear este código desde Centinel para registrarse en este curso. Reutilizable por múltiples alumnos durante estos 5 minutos.
                </Text>
              </>
            )}
          </View>
        ) : null}

        <Button
          title="Volver a Cursos"
          variant="outline"
          onPress={() => router.back()}
          style={styles.backButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    alignItems: 'center',
  },
  courseHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 4,
    textAlign: 'center',
  },
  courseSub: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    textAlign: 'center',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
    width: '100%',
  },
  timerLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 2,
    marginTop: 2,
  },
  instructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  expiredOverlay: {
    paddingVertical: 30,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
    marginBottom: 20,
  },
  expiredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 8,
  },
  expiredSub: {
    fontSize: 13,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionBtn: {
    width: '100%',
  },
  backButton: {
    width: '100%',
    marginTop: 8,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    marginBottom: 12,
    textAlign: 'center',
  },
});
