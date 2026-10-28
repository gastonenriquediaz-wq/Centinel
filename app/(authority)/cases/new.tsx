import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService } from '../../../src/services/reports.service';
import { CasesService } from '../../../src/services/cases.service';
import { Report } from '../../../src/types/database.types';

const PROTOCOL_LEVELS = [
  { label: 'Leve (Mediación escolar / Diálogo guiado)', value: 'Leve' },
  { label: 'Moderado (Reunión con tutores / Actas de compromiso)', value: 'Moderado' },
  { label: 'Grave (Derivación EOE / Medidas de protección urgente)', value: 'Grave' },
];

export default function NewCaseScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { profile } = useAuthStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [protocolLevel, setProtocolLevel] = useState('Moderado');

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      const { data } = await ReportsService.getReportDetails(reportId as string);
      if (data) {
        setReport(data);
        setTitle(`Caso: ${data.situation_type} - ${data.student?.first_name || ''} ${data.student?.last_name || ''}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (!title.trim() || title.trim().length < 5) {
      Alert.alert('Título requerido', 'Por favor ingresa un título descriptivo para la carátula del caso.');
      return;
    }

    if (!profile?.id || !profile.institution_id || !reportId) {
      Alert.alert('Error', 'Datos de sesión incompletos.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await CasesService.createCaseFromReport({
        institution_id: profile.institution_id,
        report_id: reportId as string,
        created_by: profile.id,
        title: title.trim(),
        protocol_level: protocolLevel,
      });

      if (error || !data) {
        Alert.alert('Error al abrir caso', error || 'No se pudo crear el caso.');
        return;
      }

      Alert.alert(
        'Caso Formal Abierto',
        'Se ha iniciado el expediente formal de actuación. Ahora puedes registrar actas de entrevistas y acuerdos.',
        [
          {
            text: 'Ir al Caso',
            onPress: () => router.replace(`/(authority)/cases/${data.id}` as any),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Apertura de Caso Formal',
          headerBackTitle: 'Reporte',
        }}
      />

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Reporte de Origen</Text>
        <Text style={styles.summaryText}>
          <Text style={styles.bold}>Alumno:</Text> {report?.student?.first_name} {report?.student?.last_name} (DNI: {report?.student?.dni || 'S/D'})
        </Text>
        <Text style={styles.summaryText}>
          <Text style={styles.bold}>Situación:</Text> {report?.situation_type}
        </Text>
        <Text style={styles.summaryText}>
          <Text style={styles.bold}>Lugar informado:</Text> {report?.location}
        </Text>
      </Card>

      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Carátula y Encuadre del Protocolo</Text>

        <Input
          label="Título o Carátula del Caso *"
          placeholder="Ej: Caso de hostigamiento verbal reiterado en aula"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.levelLabel}>Nivel de Intervención / Gravedad *</Text>
        {PROTOCOL_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[styles.radioItem, protocolLevel === level.value && styles.radioItemSelected]}
            onPress={() => setProtocolLevel(level.value)}
          >
            <View style={[styles.radioDot, protocolLevel === level.value && styles.radioDotSelected]} />
            <Text style={styles.radioText}>{level.label}</Text>
          </TouchableOpacity>
        ))}

        <Button
          title={submitting ? 'Abriendo Caso...' : 'Confirmar Apertura de Caso'}
          onPress={handleCreateCase}
          style={styles.submitBtn}
          disabled={submitting}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  formCard: {
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  radioItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 10,
  },
  radioDotSelected: {
    borderColor: '#1E3A8A',
    backgroundColor: '#1E3A8A',
  },
  radioText: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  submitBtn: {
    marginTop: 16,
  },
});
