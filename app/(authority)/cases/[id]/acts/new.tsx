import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../../src/components/ui/Card';
import { useAuthStore } from '../../../../../src/store/auth.store';
import { CasesService } from '../../../../../src/services/cases.service';
import { ActType, Case } from '../../../../../src/types/database.types';

type ActOptionKey =
  | 'interview_student'
  | 'interview_parents'
  | 'mediation'
  | 'psychological_referral'
  | 'disciplinary_measure'
  | 'case_observation'
  | 'other';

interface ActOption {
  key: ActOptionKey;
  dbType: ActType;
  title: string;
  defaultFormTitle: string;
  desc: string;
}

const ACT_OPTIONS: ActOption[] = [
  {
    key: 'interview_student',
    dbType: 'interview_student',
    title: 'Entrevista individual a estudiante',
    defaultFormTitle: 'Entrevista a estudiante',
    desc: 'Registro de una entrevista con un estudiante para conocer su relato y obtener información sobre la situación.',
  },
  {
    key: 'interview_parents',
    dbType: 'interview_parents',
    title: 'Reunión con familiares o responsables',
    defaultFormTitle: 'Reunión con familiares o responsables',
    desc: 'Comunicación formal con la familia o personas responsables y definición de pautas.',
  },
  {
    key: 'mediation',
    dbType: 'mediation',
    title: 'Intervención de convivencia escolar',
    defaultFormTitle: 'Intervención de convivencia escolar',
    desc: 'Registro de acciones institucionales y pedagógicas para fortalecer la convivencia y prevenir nuevas situaciones.',
  },
  {
    key: 'psychological_referral',
    dbType: 'psychological_referral',
    title: 'Derivación a equipo u organismo competente',
    defaultFormTitle: 'Derivación a equipo u organismo competente',
    desc: 'Registro de la derivación a un equipo de orientación, gabinete u otro organismo, indicando el motivo.',
  },
  {
    key: 'disciplinary_measure',
    dbType: 'disciplinary_measure',
    title: 'Medida institucional adoptada',
    defaultFormTitle: 'Medida institucional adoptada',
    desc: 'Registro de una medida pedagógica, de acompañamiento o disciplinaria, según el Régimen de Convivencia.',
  },
  {
    key: 'case_observation',
    dbType: 'closure_agreement',
    title: 'Observación o seguimiento del caso',
    defaultFormTitle: 'Observación o seguimiento del caso',
    desc: 'Registro de avances, observaciones o acciones de seguimiento.',
  },
  {
    key: 'other',
    dbType: 'closure_agreement',
    title: 'Otra actuación institucional',
    defaultFormTitle: 'Actuación institucional',
    desc: 'Registro de una actuación que no se encuentra en las opciones anteriores.',
  },
];

type ParticipantRole =
  | 'Directivo'
  | 'Docente'
  | 'Estudiante'
  | 'Familiar / Tutor'
  | 'Gabinete'
  | 'Otro';

interface StructuredParticipant {
  id: string;
  role: ParticipantRole;
  name: string;
}

export default function NewCaseActScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tipo de actuación
  const [selectedOptionKey, setSelectedOptionKey] = useState<ActOptionKey>('interview_student');
  const [title, setTitle] = useState(ACT_OPTIONS[0].defaultFormTitle);

  // Fecha y hora de la actuación
  const getInitialDateStr = () => {
    const d = new Date();
    const day = d.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getInitialTimeStr = () => {
    const d = new Date();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [actDate, setActDate] = useState(getInitialDateStr());
  const [actTime, setActTime] = useState(getInitialTimeStr());

  // Personas presentes / intervinientes estructurados
  const [participantsList, setParticipantsList] = useState<StructuredParticipant[]>([]);
  const [newPersonRole, setNewPersonRole] = useState<ParticipantRole>('Estudiante');
  const [newPersonName, setNewPersonName] = useState('');

  // Contenido de la actuación
  const [development, setDevelopment] = useState('');
  const [agreements, setAgreements] = useState('');
  const [nextActions, setNextActions] = useState('');

  useEffect(() => {
    if (caseId) {
      loadCaseData();
    }
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      const { data } = await CasesService.getCaseDetails(caseId as string);
      if (data) {
        setCaseItem(data);
      }
    } finally {
      setLoadingCase(false);
    }
  };

  // Inicializar al usuario actual como participante directivo
  useEffect(() => {
    if (profile && participantsList.length === 0) {
      const currentUserName = `${profile.first_name} ${profile.last_name}`.trim();
      const currentRole: ParticipantRole =
        profile.position === 'Director' || profile.position === 'Vicedirector'
          ? 'Directivo'
          : 'Docente';
      setParticipantsList([
        {
          id: `author_${profile.id}`,
          role: currentRole,
          name: `${currentUserName}${profile.position ? ` (${profile.position})` : ''}`,
        },
      ]);
    }
  }, [profile]);

  const handleSelectOption = (option: ActOption) => {
    setSelectedOptionKey(option.key);
    setTitle(option.defaultFormTitle);
  };

  const handleAddParticipant = () => {
    if (!newPersonName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresá el nombre y apellido del interviniente.');
      return;
    }

    const newParticipant: StructuredParticipant = {
      id: `p_${Date.now()}_${Math.random()}`,
      role: newPersonRole,
      name: newPersonName.trim(),
    };

    setParticipantsList((prev) => [...prev, newParticipant]);
    setNewPersonName('');
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipantsList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddSuggestedStudent = (name: string, roleText: string) => {
    const isAlreadyAdded = participantsList.some(
      (p) => p.name.toLowerCase().includes(name.toLowerCase())
    );
    if (isAlreadyAdded) {
      Alert.alert('Ya agregado', `${name} ya se encuentra en la lista de intervinientes.`);
      return;
    }

    const studentRole: ParticipantRole = 'Estudiante';
    setParticipantsList((prev) => [
      ...prev,
      {
        id: `sug_${Date.now()}_${name}`,
        role: studentRole,
        name: `${name} (${roleText})`,
      },
    ]);
  };

  const getRoleBadgeStyle = (role: ParticipantRole) => {
    switch (role) {
      case 'Directivo':
        return { bg: '#EFF6FF', text: '#1E3A8A' };
      case 'Estudiante':
        return { bg: '#E0F2FE', text: '#0284C7' };
      case 'Familiar / Tutor':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'Gabinete':
        return { bg: '#F3E8FF', text: '#7C3AED' };
      case 'Docente':
        return { bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const handleSaveAct = async () => {
    if (!title.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresá el título de la actuación.');
      return;
    }

    if (participantsList.length === 0) {
      Alert.alert(
        'Intervinientes requeridos',
        'Por favor agregá al menos una persona presente o interviniente en la actuación.'
      );
      return;
    }

    if (!development.trim() || development.trim().length < 15) {
      Alert.alert(
        'Detalle insuficiente',
        'Por favor describí el desarrollo de la actuación con suficiente detalle (mínimo 15 caracteres).'
      );
      return;
    }

    if (!profile?.id || !profile.institution_id || !caseId) {
      Alert.alert('Error', 'Datos de sesión incompletos.');
      return;
    }

    // Compilar participantes en formato estructurado pero legible
    const participantsString = participantsList
      .map((p) => `${p.role}: ${p.name}`)
      .join('; ');

    // Estructurar el cuerpo completo del contenido del acta
    let fullContent = development.trim();
    if (agreements.trim()) {
      fullContent += `\n\n📌 Acuerdos o compromisos:\n${agreements.trim()}`;
    }
    if (nextActions.trim()) {
      fullContent += `\n\n🗓️ Próximas acciones:\n${nextActions.trim()}`;
    }

    // Calcular fecha y hora aproximada
    let occurredIso = new Date().toISOString();
    try {
      const parts = actTime.split(':');
      if (parts.length === 2) {
        const d = new Date();
        d.setHours(parseInt(parts[0], 10) || 12, parseInt(parts[1], 10) || 0, 0, 0);
        occurredIso = d.toISOString();
      }
    } catch {
      occurredIso = new Date().toISOString();
    }

    const selectedOption = ACT_OPTIONS.find((o) => o.key === selectedOptionKey) || ACT_OPTIONS[0];

    setSubmitting(true);
    try {
      const { data, error } = await CasesService.addCaseAct({
        case_id: caseId as string,
        institution_id: profile.institution_id,
        created_by: profile.id,
        act_type: selectedOption.dbType,
        title: title.trim(),
        participants: participantsString,
        content: fullContent,
        occurred_at: occurredIso,
      });

      if (error || !data) {
        Alert.alert('Error al guardar actuación', error || 'No se pudo guardar la actuación.');
        return;
      }

      Alert.alert(
        'Actuación registrada',
        'La actuación institucional fue guardada formalmente y el expediente ha pasado a estado "En seguimiento".',
        [
          {
            text: 'Volver al expediente',
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
          headerTitle: () => (
            <Text style={styles.headerTitleText}>
              {'Registrar Actuación\nInstitucional'}
            </Text>
          ),
          headerTitleAlign: 'center',
          headerBackTitle: 'Expediente',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
        }}
      />

      {/* 1. Selector de Tipo de Actuación Institucional */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Tipo de actuación institucional *</Text>
        <Text style={styles.sectionSubtitle}>
          Seleccioná el tipo de actuación que vas a registrar.
        </Text>

        {ACT_OPTIONS.map((option) => {
          const isSelected = selectedOptionKey === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.radioItem, isSelected && styles.radioItemSelected]}
              onPress={() => handleSelectOption(option)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>

              <View style={styles.radioContent}>
                <Text style={styles.radioTitle}>{option.title}</Text>
                <Text style={styles.radioDesc}>{option.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* 2. Formulario de Datos de la Actuación */}
      <Card style={styles.card}>
        {/* Título de la actuación */}
        <Text style={styles.fieldLabel}>Título de la actuación *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ej: Entrevista a estudiante"
          value={title}
          onChangeText={setTitle}
        />

        {/* Fecha y Hora en 2 columnas */}
        <View style={styles.rowTwoCols}>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Fecha de la actuación</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="calendar-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInputInner}
                value={actDate}
                onChangeText={setActDate}
                placeholder="29 oct 2026"
              />
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Hora</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="time-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInputInner}
                value={actTime}
                onChangeText={setActTime}
                placeholder="15:00"
              />
            </View>
          </View>
        </View>

        {/* Personas presentes / Intervinientes (Estructurado y Ordenado) */}
        <Text style={styles.fieldLabel}>Personas presentes / Intervinientes *</Text>
        <Text style={styles.fieldHelper}>
          Indicá las personas que participaron (ej.: director/a, preceptor/a, estudiante, familiar, profesional).
        </Text>

        {/* Sugerencias directas a partir de los datos del caso */}
        {caseItem && caseItem.involved_students && caseItem.involved_students.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Sugerencias del caso:</Text>
            <View style={styles.suggestionsPillsRow}>
              {caseItem.involved_students.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  style={styles.suggestionPill}
                  onPress={() => handleAddSuggestedStudent(st.name, st.role)}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#1E3A8A" />
                  <Text style={styles.suggestionPillText}>
                    {st.name} ({st.role.includes('afectado') ? 'Afectado' : 'Señalado'})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Listado de intervinientes agregados */}
        <View style={styles.participantsList}>
          {participantsList.length === 0 ? (
            <Text style={styles.emptyParticipantsText}>
              Aún no agregaste personas intervinientes. Utilizá el formulario a continuación.
            </Text>
          ) : (
            participantsList.map((p) => {
              const bStyle = getRoleBadgeStyle(p.role);
              return (
                <View key={p.id} style={styles.participantItemRow}>
                  <View style={[styles.roleBadge, { backgroundColor: bStyle.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: bStyle.text }]}>{p.role}</Text>
                  </View>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveParticipant(p.id)}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close-circle" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Formulario para agregar nuevo interviniente */}
        <View style={styles.addParticipantBox}>
          <Text style={styles.addParticipantTitle}>+ Incorporar interviniente:</Text>
          <View style={styles.rolePickerRow}>
            {(
              [
                'Estudiante',
                'Familiar / Tutor',
                'Directivo',
                'Docente',
                'Gabinete',
                'Otro',
              ] as ParticipantRole[]
            ).map((r) => {
              const isSelected = newPersonRole === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleSelectChip, isSelected && styles.roleSelectChipSelected]}
                  onPress={() => setNewPersonRole(r)}
                >
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      isSelected && styles.roleSelectChipTextSelected,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.addInputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Nombre y apellido / cargo..."
              value={newPersonName}
              onChangeText={setNewPersonName}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddParticipant}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Desarrollo de la actuación */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Desarrollo de la actuación *</Text>
        <Text style={styles.fieldHelper}>
          Registrá lo conversado, la información relevante y las observaciones.
        </Text>
        <TextInput
          style={[styles.textInput, styles.textAreaLarge]}
          placeholder="Escribí aquí el desarrollo de la actuación..."
          value={development}
          onChangeText={setDevelopment}
          multiline
          numberOfLines={5}
        />

        {/* Acuerdos o compromisos */}
        <Text style={styles.fieldLabel}>Acuerdos o compromisos (opcional)</Text>
        <TextInput
          style={[styles.textInput, styles.textAreaSmall]}
          placeholder="Ej.: Se acordó realizar un seguimiento quincenal..."
          value={agreements}
          onChangeText={setAgreements}
          multiline
          numberOfLines={2}
        />

        {/* Próximas acciones */}
        <Text style={styles.fieldLabel}>Próximas acciones (opcional)</Text>
        <TextInput
          style={[styles.textInput, styles.textAreaSmall]}
          placeholder="Ej.: Nueva entrevista, reunión con la familia, derivación..."
          value={nextActions}
          onChangeText={setNextActions}
          multiline
          numberOfLines={2}
        />

        {/* Recuadro de Información */}
        <View style={styles.infoCallout}>
          <Ionicons name="information-circle-outline" size={22} color="#1E3A8A" />
          <Text style={styles.infoCalloutText}>
            La actuación quedará registrada en el seguimiento del caso, indicando tu usuario, la fecha y la hora de registro.
          </Text>
        </View>
      </Card>

      {/* Botones inferiores Cancelar / Guardar actuación */}
      <View style={styles.bottomButtonsRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSaveAct}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Guardar actuación</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
    gap: 16,
  },
  headerTitleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  radioItemSelected: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EFF6FF',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: '#1E3A8A',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A8A',
  },
  radioContent: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  radioDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  fieldHelper: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    marginBottom: 6,
  },
  textAreaLarge: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  col: {
    flex: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 6,
  },
  textInputInner: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  suggestionsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  suggestionsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  suggestionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  participantsList: {
    gap: 6,
    marginBottom: 12,
  },
  participantItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  removeBtn: {
    padding: 2,
  },
  emptyParticipantsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  addParticipantBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addParticipantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  roleSelectChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  roleSelectChipSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  roleSelectChipText: {
    fontSize: 11,
    color: '#475569',
  },
  roleSelectChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginTop: 16,
    gap: 10,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
