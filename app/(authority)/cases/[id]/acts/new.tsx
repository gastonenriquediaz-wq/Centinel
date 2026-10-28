import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Card } from '../../../../../src/components/ui/Card';
import { Input } from '../../../../../src/components/ui/Input';
import { Button } from '../../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../../src/store/auth.store';
import { CasesService } from '../../../../../src/services/cases.service';
import { ActType } from '../../../../../src/types/database.types';

const ACT_TYPES: { label: string; value: ActType; desc: string }[] = [
  {
    label: 'Entrevista a Estudiante',
    value: 'interview_student',
    desc: 'Diálogo con la víctima, el agresor o testigos para esclarecer hechos.',
  },
  {
    label: 'Reunión con Padres / Tutores',
    value: 'interview_parents',
    desc: 'Comunicación formal con adultos responsables y pautas de compromiso.',
  },
  {
    label: 'Acta de Mediación / Diálogo Escolar',
    value: 'mediation',
    desc: 'Espacio de resolución pacífica de conflictos con facilitadores escolares.',
  },
  {
    label: 'Derivación Gabinete / EOE',
    value: 'psychological_referral',
    desc: 'Intervención de profesionales pedagógicos o psicológicos.',
  },
  {
    label: 'Medida Pedagógica / Sanción',
    value: 'disciplinary_measure',
    desc: 'Aplicación del Régimen de Convivencia y medidas de reparación.',
  },
  {
    label: 'Acuerdo de Convivencia y Cierre',
    value: 'closure_agreement',
    desc: 'Pautas acordadas entre las partes para dar cierre al incidente.',
  },
];

export default function NewCaseActScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const [actType, setActType] = useState<ActType>('interview_student');
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [content, setContent] = useState('');

  const handleSaveAct = async () => {
    if (!title.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa un título descriptivo para el acta.');
      return;
    }
    if (!participants.trim()) {
      Alert.alert('Campo requerido', 'Por favor indica los participantes de la actuación.');
      return;
    }
    if (!content.trim() || content.trim().length < 20) {
      Alert.alert('Detalle insuficiente', 'Por favor redacta los hechos y acuerdos con suficiente detalle (mínimo 20 caracteres).');
      return;
    }

    if (!profile?.id || !profile.institution_id || !caseId) {
      Alert.alert('Error', 'Datos de sesión incompletos.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await CasesService.addCaseAct({
        case_id: caseId as string,
        institution_id: profile.institution_id,
        created_by: profile.id,
        act_type: actType,
        title: title.trim(),
        participants: participants.trim(),
        content: content.trim(),
        occurred_at: new Date().toISOString(),
      });

      if (error || !data) {
        Alert.alert('Error al labrar acta', error || 'No se pudo guardar el acta.');
        return;
      }

      Alert.alert(
        'Acta Registrada',
        'El acta digital ha sido labrada y archivada en el expediente del caso.',
        [
          {
            text: 'Volver al Caso',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Labrar Acta Digital',
          headerBackTitle: 'Caso',
        }}
      />

      <Card style={styles.card}>
        <Text style={styles.sectionHeader}>Tipo de Actuación Institucional *</Text>
        {ACT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.radioItem, actType === type.value && styles.radioItemSelected]}
            onPress={() => {
              setActType(type.value);
              if (!title) {
                setTitle(type.label);
              }
            }}
          >
            <View style={[styles.radioDot, actType === type.value && styles.radioDotSelected]} />
            <View style={styles.radioTextContainer}>
              <Text style={styles.radioTitle}>{type.label}</Text>
              <Text style={styles.radioDesc}>{type.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Card>

      <Card style={styles.card}>
        <Input
          label="Título del Acta *"
          placeholder="Ej: Entrevista individual con el alumno implicado"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          label="Personas Presentes / Intervinientes *"
          placeholder="Ej: Director Lic. Gómez, Alumno Juan Pérez, Preceptora García..."
          value={participants}
          onChangeText={setParticipants}
          style={styles.spacing}
        />

        <Input
          label="Cuerpo del Acta y Acuerdos Alcanzados *"
          placeholder="Describa el desarrollo de la reunión, lo manifestado por las partes, compromisos asumidos y próximas acciones pautadas..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={8}
          style={styles.spacing}
        />
        <Text style={styles.helperText}>
          Las actas forman parte del legajo pedagógico y legal confidencial de la institución.
        </Text>

        <Button
          title={submitting ? 'Guardando Acta...' : 'Firmar y Guardar Acta'}
          onPress={handleSaveAct}
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
  card: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  radioDotSelected: {
    borderColor: '#1E3A8A',
    backgroundColor: '#1E3A8A',
  },
  radioTextContainer: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  radioDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  spacing: {
    marginTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },
  submitBtn: {
    marginTop: 16,
  },
});
