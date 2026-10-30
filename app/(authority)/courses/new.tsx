import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { CoursesService } from '../../../src/services/courses.service';
import { ShiftType } from '../../../src/types/database.types';

const SHIFTS: ShiftType[] = ['Mañana', 'Tarde', 'Noche', 'Jornada Completa'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];

export default function NewCourseScreen() {
  const { profile } = useAuthStore();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(1);
  const [division, setDivision] = useState('');
  const [shift, setShift] = useState<ShiftType>('Mañana');
  const [schoolYear, setSchoolYear] = useState(String(currentYear));
  const [estimatedStudents, setEstimatedStudents] = useState('30');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMessage(null);

    if (!division.trim()) {
      setErrorMessage('Por favor, indicá la división del curso (ej: A, B, 1ra).');
      return;
    }

    const parsedSchoolYear = parseInt(schoolYear, 10);
    if (isNaN(parsedSchoolYear) || parsedSchoolYear < 2024) {
      setErrorMessage('Ingresá un ciclo lectivo válido.');
      return;
    }

    const parsedCap = parseInt(estimatedStudents, 10);
    if (isNaN(parsedCap) || parsedCap <= 0) {
      setErrorMessage('La cantidad estimada de estudiantes debe ser mayor a 0.');
      return;
    }

    if (!profile?.institution_id) {
      setErrorMessage('No se encontró la institución asociada a tu cuenta.');
      return;
    }

    try {
      setLoading(true);
      await CoursesService.createCourse({
        institutionId: profile.institution_id,
        year,
        division,
        shift,
        schoolYear: parsedSchoolYear,
        estimatedStudents: parsedCap,
      });

      router.back();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el curso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Nuevo Curso', headerBackTitle: 'Cursos' }} />
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Registrar Nuevo Curso</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Text style={styles.label}>Año de secundaria</Text>
          <View style={styles.selectorRow}>
            {YEARS.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, year === y && styles.yearChipActive]}
                onPress={() => setYear(y)}
              >
                <Text style={[styles.yearText, year === y && styles.yearTextActive]}>
                  {y}°
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="División / Sección"
            placeholder="Ej: A, B, C, 1ra"
            value={division}
            onChangeText={setDivision}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Turno escolar</Text>
          <View style={styles.selectorRow}>
            {SHIFTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.shiftChip, shift === s && styles.shiftChipActive]}
                onPress={() => setShift(s)}
              >
                <Text style={[styles.shiftText, shift === s && styles.shiftTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Ciclo lectivo (Año)"
            placeholder="Ej: 2026"
            value={schoolYear}
            onChangeText={setSchoolYear}
            keyboardType="numeric"
          />

          <Input
            label="Cantidad estimada de estudiantes"
            placeholder="Ej: 30"
            value={estimatedStudents}
            onChangeText={setEstimatedStudents}
            keyboardType="numeric"
          />

          <Button
            title="Crear Curso"
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          />

          <Button
            title="Cancelar"
            variant="outline"
            onPress={() => router.back()}
            style={styles.cancelButton}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  yearChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  yearChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  yearTextActive: {
    color: '#FFFFFF',
  },
  shiftChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shiftChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  shiftText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  shiftTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 12,
  },
  cancelButton: {
    marginTop: 10,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    textAlign: 'justify',
  },
});
