import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService, AttachmentInput } from '../../../src/services/reports.service';

const SITUATION_TYPES = [
  'Agresión física (golpes, empujones)',
  'Burlas, insultos o humillaciones',
  'Acoso o agresiones por internet',
  'Exclusión o aislamiento social',
  'Amenazas o intimidación',
  'Daño o robo de pertenencias',
  'Otra situación',
];

const FREQUENCIES = [
  'Ocurrió una sola vez',
  'Ocurrió varias veces',
  'Ocurre frecuentemente',
  'Ocurre todos o casi todos los días',
  'No sé con qué frecuencia ocurre',
];

const LOCATIONS = [
  'Dentro del aula',
  'Patio o recreo',
  'Baños',
  'Entrada o salida del colegio',
  'Cerca del colegio',
  'Internet, redes sociales o mensajes',
  'No sé dónde ocurrió',
  'Otro lugar',
];

interface AggressorItem {
  name: string;
  courseDivision: string;
}

export default function NewReportScreen() {
  const { profile, institution } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- PASO 1 STATE ---
  // ¿Qué tipo de situación deseas comunicar? (Multi-select)
  const [selectedSituations, setSelectedSituations] = useState<string[]>([]);
  const [customSituation, setCustomSituation] = useState('');
  // ¿Dónde ocurrió o suele ocurrir? (Multi-select)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState('');
  // Frecuencia
  const [frequency, setFrequency] = useState('');
  const [occurredAtDate] = useState(new Date().toISOString().split('T')[0]);

  // --- PASO 2 STATE ---
  // 1_ ¿Quién o quiénes fueron afectados?
  const [affectedPersonOption, setAffectedPersonOption] = useState<
    'me_affected' | 'other_affected' | 'both_affected' | ''
  >('');
  const [affectedPersonOtherName, setAffectedPersonOtherName] = useState('');

  // 2_ ¿Quiénes realizaron las agresiones?
  const [aggressorsType, setAggressorsType] = useState<'unknown' | 'known' | ''>('');
  const [aggressorsList, setAggressorsList] = useState<AggressorItem[]>([
    { name: '', courseDivision: '' },
  ]);

  // 3_ ¿Alguien vio lo que pasó? (Testigos opcionales)
  const [witnessesList, setWitnessesList] = useState<string[]>([]);

  // 4_ Descripción de lo sucedido
  const [description, setDescription] = useState('');

  // --- PASO 3 STATE ---
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);

  // --- PASO 4 STATE ---
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Manejo de multi-select en situaciones
  const toggleSituation = (type: string) => {
    if (selectedSituations.includes(type)) {
      setSelectedSituations(selectedSituations.filter((s) => s !== type));
    } else {
      setSelectedSituations([...selectedSituations, type]);
    }
  };

  // Manejo de multi-select en ubicaciones
  const toggleLocation = (loc: string) => {
    if (selectedLocations.includes(loc)) {
      setSelectedLocations(selectedLocations.filter((l) => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  };

  // Manejo de lista dinámica de agresores
  const handleAggressorChange = (index: number, field: keyof AggressorItem, value: string) => {
    const updated = [...aggressorsList];
    updated[index][field] = value;
    setAggressorsList(updated);
  };

  const addAggressor = () => {
    setAggressorsList([...aggressorsList, { name: '', courseDivision: '' }]);
  };

  const removeAggressor = (index: number) => {
    if (aggressorsList.length > 1) {
      setAggressorsList(aggressorsList.filter((_, i) => i !== index));
    }
  };

  // Manejo de lista dinámica de testigos
  const handleWitnessChange = (index: number, value: string) => {
    const updated = [...witnessesList];
    updated[index] = value;
    setWitnessesList(updated);
  };

  const addWitness = () => {
    setWitnessesList([...witnessesList, '']);
  };

  const removeWitness = (index: number) => {
    setWitnessesList(witnessesList.filter((_, i) => i !== index));
  };

  // Selector de multimedia (Paso 3)
  const pickMedia = async (mediaType: 'image' | 'video') => {
    try {
      const currentImages = attachments.filter((a) => a.type === 'image');
      const currentVideos = attachments.filter((a) => a.type === 'video');

      if (mediaType === 'image' && currentImages.length >= 5) {
        Alert.alert('Límite alcanzado', 'Puedes adjuntar como máximo 5 imágenes.');
        return;
      }
      if (mediaType === 'video' && currentVideos.length >= 1) {
        Alert.alert('Límite alcanzado', 'Puedes adjuntar como máximo 1 video.');
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para adjuntar archivos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'image' ? ['images'] : ['videos'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 1024 * 500;

        if (mediaType === 'image') {
          const newTotalImgSize = currentImages.reduce((sum, a) => sum + a.size, 0) + fileSize;
          if (newTotalImgSize > 25 * 1024 * 1024) {
            Alert.alert('Límite excedido', 'El total de imágenes no puede superar los 25 MB.');
            return;
          }
        } else {
          if (fileSize > 40 * 1024 * 1024) {
            Alert.alert('Límite excedido', 'El video no puede superar los 40 MB.');
            return;
          }
        }

        const newAttachment: AttachmentInput = {
          uri: asset.uri,
          type: mediaType,
          name: asset.fileName || (mediaType === 'image' ? 'imagen.jpg' : 'video.mp4'),
          size: fileSize,
        };

        setAttachments([...attachments, newAttachment]);
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo: ' + err.message);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const totalSizeBytes = attachments.reduce((sum, a) => sum + a.size, 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  // Validación y navegación
  const handleNext = () => {
    if (currentStep === 1) {
      if (selectedSituations.length === 0) {
        Alert.alert('Campo requerido', 'Por favor selecciona al menos un tipo de situación.');
        return;
      }
      if (selectedSituations.includes('Otra situación') && !customSituation.trim()) {
        Alert.alert('Campo requerido', 'Por favor especifica el tipo de situación.');
        return;
      }
      if (selectedLocations.length === 0) {
        Alert.alert('Campo requerido', 'Por favor selecciona al menos un lugar.');
        return;
      }
      if (selectedLocations.includes('Otro lugar') && !customLocation.trim()) {
        Alert.alert('Campo requerido', 'Por favor especifica el lugar del hecho.');
        return;
      }
      if (!frequency) {
        Alert.alert('Campo requerido', 'Por favor selecciona con qué frecuencia ocurre la situación.');
        return;
      }

      setCurrentStep(2);
    } else if (currentStep === 2) {
      // 1_ Quién o quiénes fueron afectados
      if (!affectedPersonOption) {
        Alert.alert('Campo requerido', 'Por favor indicá quién o quiénes fueron afectados.');
        return;
      }
      if (
        (affectedPersonOption === 'other_affected' || affectedPersonOption === 'both_affected') &&
        !affectedPersonOtherName.trim()
      ) {
        Alert.alert('Campo requerido', 'Por favor ingresá el nombre y apellido de la persona afectada.');
        return;
      }

      // 2_ Quiénes realizaron las agresiones
      if (!aggressorsType) {
        Alert.alert('Campo requerido', 'Por favor indica si conoces a quiénes realizaron las agresiones.');
        return;
      }
      if (aggressorsType === 'known') {
        const hasValidAggressor = aggressorsList.some((a) => a.name.trim().length > 0);
        if (!hasValidAggressor) {
          Alert.alert('Campo requerido', 'Por favor ingresa al menos un nombre, apellido o apodo del agresor.');
          return;
        }
      }

      // 4_ Descripción
      if (!description.trim() || description.trim().length < 15) {
        Alert.alert('Descripción insuficiente', 'Por favor proporciona una descripción detallada de lo sucedido (mínimo 15 caracteres).');
        return;
      }

      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  // Generar cadenas formateadas para guardar en la base de datos
  const getFormattedSituations = () => {
    return selectedSituations
      .map((s) => (s === 'Otra situación' ? `Otro: ${customSituation.trim()}` : s))
      .join(', ');
  };

  const getFormattedLocations = () => {
    return selectedLocations
      .map((l) => (l === 'Otro lugar' ? `Otro: ${customLocation.trim()}` : l))
      .join(', ');
  };

  const getFormattedInvolvedPersons = () => {
    const parts: string[] = [];

    // Persona afectada
    if (affectedPersonOption === 'me_affected') {
      parts.push('Afectado: El propio estudiante que reporta');
    } else if (affectedPersonOption === 'both_affected') {
      parts.push(`Afectados: El estudiante que reporta y otra persona (${affectedPersonOtherName.trim()})`);
    } else {
      parts.push(`Afectado: Otra persona (${affectedPersonOtherName.trim()})`);
    }

    // Agresores
    if (aggressorsType === 'unknown') {
      parts.push('Agresores: No identificados / Se desconoce quiénes fueron');
    } else {
      const validAggressors = aggressorsList
        .filter((a) => a.name.trim().length > 0)
        .map((a) => `${a.name.trim()}${a.courseDivision.trim() ? ` (${a.courseDivision.trim()})` : ''}`)
        .join('; ');
      parts.push(`Agresores: ${validAggressors}`);
    }

    // Testigos
    const validWitnesses = witnessesList.filter((w) => w.trim().length > 0);
    if (validWitnesses.length > 0) {
      parts.push(`Testigos: ${validWitnesses.map((w) => w.trim()).join('; ')}`);
    }

    return parts.join(' | ');
  };

  const handleSubmit = async () => {
    if (!disclaimerAccepted) {
      Alert.alert('Aviso obligatorio', 'Debes leer y aceptar el aviso sobre situaciones de emergencia para continuar.');
      return;
    }

    if (!profile?.id || !institution?.id) {
      Alert.alert('Error', 'No se pudo identificar tu sesión.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalSituations = getFormattedSituations();
      const finalLocations = getFormattedLocations();
      const finalInvolvedPersons = getFormattedInvolvedPersons();

      const { data, error } = await ReportsService.createReport(
        {
          institution_id: institution.id,
          course_id: profile.course_id,
          student_id: profile.id,
          situation_type: finalSituations,
          location: finalLocations,
          occurred_at: new Date(occurredAtDate).toISOString(),
          frequency: frequency,
          involved_persons: finalInvolvedPersons,
          description: description,
        },
        attachments
      );

      if (error || !data) {
        Alert.alert('Error al enviar', error || 'No se pudo registrar el reporte.');
        return;
      }

      Alert.alert(
        'Reporte Enviado',
        'Tu reporte ha sido comunicado a las autoridades escolares de tu institución. Podrás seguir el estado desde la sección "Mis Reportes".',
        [
          {
            text: 'Entendido',
            onPress: () => router.replace('/(student)/reports'),
          },
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24) + 12,
          paddingBottom: Math.max(insets.bottom, 24) + 40,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Ocultar encabezado de navegación nativo que mostraba "(Student)/reports/new" */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Indicador de pasos */}
      <View style={styles.stepIndicator}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.stepCircle,
              currentStep === step && styles.stepCircleActive,
              currentStep > step && styles.stepCircleCompleted,
            ]}
          >
            <Text
              style={[
                styles.stepText,
                (currentStep === step || currentStep > step) && styles.stepTextActive,
              ]}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.stepSubtitle}>
        {currentStep === 1 && 'Paso 1: Clasificación y Lugar'}
        {currentStep === 2 && 'Paso 2: Personas y Relato'}
        {currentStep === 3 && 'Paso 3: Evidencia Multimedia (Opcional)'}
        {currentStep === 4 && 'Paso 4: Confirmación y Envío'}
      </Text>

      {/* ===================== PASO 1 ===================== */}
      {currentStep === 1 && (
        <View style={styles.stepContainer}>
          {/* ¿Qué tipo de situación deseas comunicar? (Multi-select) */}
          <Card style={styles.card}>
            <Text style={styles.label}>¿Qué tipo de situación deseas comunicar?</Text>
            <Text style={styles.multiSelectHelp}>(Puedes marcar más de una opción)</Text>
            {SITUATION_TYPES.map((type) => {
              const isChecked = selectedSituations.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.checkboxRow, isChecked && styles.checkboxRowSelected]}
                  onPress={() => toggleSituation(type)}
                >
                  <View style={[styles.checkboxSquare, isChecked && styles.checkboxSquareSelected]}>
                    {isChecked && <Text style={styles.checkmarkIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>{type}</Text>
                </TouchableOpacity>
              );
            })}

            {selectedSituations.includes('Otra situación') && (
              <Input
                label="Especifica qué otra situación ocurre"
                placeholder="Escribe aquí el tipo..."
                value={customSituation}
                onChangeText={setCustomSituation}
                style={styles.customInput}
              />
            )}
          </Card>

          {/* ¿Dónde ocurrió o suele ocurrir? (Multi-select) */}
          <Card style={styles.card}>
            <Text style={styles.label}>¿Dónde ocurrió o suele ocurrir?</Text>
            <Text style={styles.multiSelectHelp}>(Puedes marcar más de una opción)</Text>
            {LOCATIONS.map((loc) => {
              const isChecked = selectedLocations.includes(loc);
              return (
                <TouchableOpacity
                  key={loc}
                  style={[styles.checkboxRow, isChecked && styles.checkboxRowSelected]}
                  onPress={() => toggleLocation(loc)}
                >
                  <View style={[styles.checkboxSquare, isChecked && styles.checkboxSquareSelected]}>
                    {isChecked && <Text style={styles.checkmarkIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>{loc}</Text>
                </TouchableOpacity>
              );
            })}

            {selectedLocations.includes('Otro lugar') && (
              <Input
                label="Especifica el lugar"
                placeholder="Escribe el lugar aquí..."
                value={customLocation}
                onChangeText={setCustomLocation}
                style={styles.customInput}
              />
            )}
          </Card>

          {/* Frecuencia */}
          <Card style={styles.card}>
            <Text style={styles.label}>¿Con qué frecuencia ocurre?</Text>
            {FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[styles.radioItem, frequency === freq && styles.radioItemSelected]}
                onPress={() => setFrequency(freq)}
              >
                <View style={[styles.radioDot, frequency === freq && styles.radioDotSelected]} />
                <Text style={styles.radioText}>{freq}</Text>
              </TouchableOpacity>
            ))}
          </Card>

          <View style={styles.rowButtons}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={() => router.back()}
              style={styles.halfButton}
            />
            <Button title="Continuar al Paso 2" onPress={handleNext} style={styles.halfButton} />
          </View>
        </View>
      )}

      {/* ===================== PASO 2 ===================== */}
      {currentStep === 2 && (
        <View style={styles.stepContainer}>
          {/* 1_ ¿Quién o quiénes fueron afectados? */}
          <Card style={styles.card}>
            <Text style={styles.label}>1_ ¿Quién o quiénes fueron afectados?</Text>
            <Text style={styles.helperTextNotice}>
              Seleccioná la opción que corresponda:
            </Text>

            <TouchableOpacity
              style={[styles.radioItem, affectedPersonOption === 'me_affected' && styles.radioItemSelected]}
              onPress={() => setAffectedPersonOption('me_affected')}
            >
              <View style={[styles.radioDot, affectedPersonOption === 'me_affected' && styles.radioDotSelected]} />
              <Text style={styles.radioText}>Yo fui una de las personas afectadas.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioItem, affectedPersonOption === 'other_affected' && styles.radioItemSelected]}
              onPress={() => setAffectedPersonOption('other_affected')}
            >
              <View style={[styles.radioDot, affectedPersonOption === 'other_affected' && styles.radioDotSelected]} />
              <Text style={styles.radioText}>Otra persona fue afectada.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioItem, affectedPersonOption === 'both_affected' && styles.radioItemSelected]}
              onPress={() => setAffectedPersonOption('both_affected')}
            >
              <View style={[styles.radioDot, affectedPersonOption === 'both_affected' && styles.radioDotSelected]} />
              <Text style={styles.radioText}>Tanto yo como otras personas fuimos afectadas.</Text>
            </TouchableOpacity>

            {(affectedPersonOption === 'other_affected' || affectedPersonOption === 'both_affected') && (
              <Input
                label="Nombre y apellido de la persona afectada"
                placeholder="Ingresá aquí nombre y apellido..."
                value={affectedPersonOtherName}
                onChangeText={setAffectedPersonOtherName}
                style={styles.customInput}
              />
            )}
          </Card>

          {/* 2_ ¿Quiénes participaron en lo sucedido? */}
          <Card style={styles.card}>
            <Text style={styles.label}>2_ ¿Quiénes participaron en lo sucedido?</Text>
            <Text style={styles.helperTextNotice}>
              Si conocés a las personas que participaron, podés indicarlas.{"\n"}
              Si no lo sabés, podés marcar la primera opción.
            </Text>

            <TouchableOpacity
              style={[styles.radioItem, aggressorsType === 'unknown' && styles.radioItemSelected]}
              onPress={() => setAggressorsType('unknown')}
            >
              <View style={[styles.radioDot, aggressorsType === 'unknown' && styles.radioDotSelected]} />
              <Text style={styles.radioText}>No sé quiénes participaron</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioItem, aggressorsType === 'known' && styles.radioItemSelected]}
              onPress={() => setAggressorsType('known')}
            >
              <View style={[styles.radioDot, aggressorsType === 'known' && styles.radioDotSelected]} />
              <Text style={styles.radioText}>Conozco a una o más personas que participaron</Text>
            </TouchableOpacity>

            {aggressorsType === 'known' && (
              <View style={styles.dynamicListContainer}>
                {aggressorsList.map((aggressor, index) => (
                  <View key={index} style={styles.dynamicItemCard}>
                    <View style={styles.dynamicItemHeader}>
                      <Text style={styles.dynamicItemTitle}>Involucrado #{index + 1}</Text>
                      {aggressorsList.length > 1 && (
                        <TouchableOpacity onPress={() => removeAggressor(index)}>
                          <Text style={styles.removeText}>Eliminar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Input
                      label="Nombre, apellido o apodo"
                      placeholder="Ej: Juan Pérez / 'El Flaco'"
                      value={aggressor.name}
                      onChangeText={(val) => handleAggressorChange(index, 'name', val)}
                    />
                    <Input
                      label="Curso o división (si lo conocés)"
                      placeholder="Ej: 3° 2da / No lo sé"
                      value={aggressor.courseDivision}
                      onChangeText={(val) => handleAggressorChange(index, 'courseDivision', val)}
                      style={styles.inputSpacing}
                    />
                  </View>
                ))}

                <Button
                  title="+ Agregar otro involucrado"
                  variant="outline"
                  onPress={addAggressor}
                  style={styles.addDynamicButton}
                />
              </View>
            )}
          </Card>

          {/* 3_ ¿Alguien vio lo que pasó? (Testigos) */}
          <Card style={styles.card}>
            <Text style={styles.label}>3_ ¿Alguien vio lo que pasó?</Text>
            <Text style={styles.helperTextNotice}>
              Si conocés testigos, podés indicarlos. No es obligatorio.
            </Text>

            {witnessesList.map((witness, index) => (
              <View key={index} style={styles.witnessRow}>
                <View style={styles.witnessInputWrapper}>
                  <Input
                    label={`Testigo #${index + 1}`}
                    placeholder="Nombre, apellido o apodo"
                    value={witness}
                    onChangeText={(val) => handleWitnessChange(index, val)}
                  />
                </View>
                <TouchableOpacity onPress={() => removeWitness(index)} style={styles.removeWitnessBtn}>
                  <Text style={styles.removeWitnessText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Button
              title="+ Agregar testigo"
              variant="outline"
              onPress={addWitness}
              style={styles.addDynamicButton}
            />
          </Card>

          {/* 4_ Descripción de lo sucedido */}
          <Card style={styles.card}>
            <Text style={styles.label}>4_ Descripción de lo sucedido</Text>
            <Text style={styles.helperTextNotice}>
              Contá con tus palabras qué pasó, qué hicieron o dijeron las personas involucradas, cuándo ocurrió y cómo te sentiste. No te preocupes si no recordás todos los detalles.
            </Text>
            <Input
              placeholder="Escribe aquí la descripción de lo sucedido..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
            />
            <Text style={styles.helperText}>Mínimo 15 caracteres. Recordá que no se podrá editar una vez enviado.</Text>
          </Card>

          <View style={styles.rowButtons}>
            <Button
              title="Atrás"
              variant="outline"
              onPress={() => setCurrentStep(1)}
              style={styles.halfButton}
            />
            <Button
              title="Continuar al Paso 3"
              onPress={handleNext}
              style={styles.halfButton}
            />
          </View>
        </View>
      )}

      {/* ===================== PASO 3 ===================== */}
      {currentStep === 3 && (
        <View style={styles.stepContainer}>
          <Card style={styles.card}>
            <Text style={styles.sectionHeader}>Archivos Adjuntos (Opcional)</Text>
            <Text style={styles.sectionHelp}>
              Puedes adjuntar hasta 5 fotos (máximo 25 MB en total) y hasta 1 video (máximo 40 MB).
            </Text>

            <View style={styles.mediaButtonsRow}>
              <Button
                title="+ Foto / Captura"
                variant="outline"
                onPress={() => pickMedia('image')}
                style={styles.mediaPickerButton}
              />
              <Button
                title="+ Video"
                variant="outline"
                onPress={() => pickMedia('video')}
                style={styles.mediaPickerButton}
              />
            </View>

            <View style={styles.meterContainer}>
              <Text style={styles.meterText}>Espacio utilizado: {totalSizeMB} MB / 65 MB</Text>
              <Text style={styles.meterDetail}>
                Fotos: {attachments.filter((a) => a.type === 'image').length}/5 | Video:{' '}
                {attachments.filter((a) => a.type === 'video').length}/1
              </Text>
            </View>

            {attachments.length > 0 && (
              <View style={styles.attachmentsList}>
                {attachments.map((att, index) => (
                  <View key={index} style={styles.attachmentItem}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                    ) : (
                      <View style={[styles.attachmentThumb, styles.videoThumb]}>
                        <Text style={styles.videoIcon}>🎥</Text>
                      </View>
                    )}
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {att.name}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {(att.size / (1024 * 1024)).toFixed(2)} MB
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeAttachment(index)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <View style={styles.rowButtons}>
            <Button
              title="Atrás"
              variant="outline"
              onPress={() => setCurrentStep(2)}
              style={styles.halfButton}
            />
            <Button
              title="Revisar y Enviar"
              onPress={handleNext}
              style={styles.halfButton}
            />
          </View>
        </View>
      )}

      {/* ===================== PASO 4 ===================== */}
      {currentStep === 4 && (
        <View style={styles.stepContainer}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryHeader}>Resumen de la Comunicación</Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Afectado(s):</Text>{' '}
              {affectedPersonOption === 'me_affected'
                ? 'El propio estudiante que reporta'
                : affectedPersonOption === 'both_affected'
                ? `El estudiante que reporta y otra persona (${affectedPersonOtherName.trim()})`
                : `Otra persona (${affectedPersonOtherName.trim()})`}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Situación(es):</Text> {getFormattedSituations()}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Lugar(es):</Text> {getFormattedLocations()}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Frecuencia:</Text> {frequency}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Involucrados:</Text> {getFormattedInvolvedPersons()}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Adjuntos:</Text> {attachments.length} archivo(s) ({totalSizeMB} MB)
            </Text>
          </Card>

          {/* Aviso obligatorio de urgencia (Definición I-06 / Marco Tesis) */}
          <Card style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠️ AVISO IMPORTANTE SOBRE URGENCIAS</Text>
            <Text style={styles.alertText}>
              Centinel es un canal de comunicación escolar confidencial para seguimiento institucional y no reemplaza servicios de emergencia inmediata ni líneas de auxilio policial o médico.
            </Text>
            <Text style={styles.alertSubtext}>
              Si te encuentras o alguien se encuentra en peligro físico inminente, comunícate de inmediato con las líneas telefónicas de emergencia (911 o 102 de Protección a la Niñez y Adolescencia) o avisa a un adulto de confianza inmediatamente.
            </Text>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setDisclaimerAccepted(!disclaimerAccepted)}
            >
              <View style={[styles.checkbox, disclaimerAccepted && styles.checkboxActive]}>
                {disclaimerAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                He leído y comprendo este aviso, y confirmo que deseo enviar este reporte a las autoridades escolares.
              </Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.rowButtons}>
            <Button
              title="Atrás"
              variant="outline"
              onPress={() => setCurrentStep(3)}
              style={styles.halfButton}
              disabled={isSubmitting}
            />
            <Button
              title={isSubmitting ? 'Enviando...' : 'Confirmar y Enviar'}
              onPress={handleSubmit}
              style={styles.halfButton}
              disabled={!disclaimerAccepted || isSubmitting}
            />
          </View>

          {isSubmitting && (
            <View style={styles.submittingContainer}>
              <ActivityIndicator size="small" color="#1E3A8A" />
              <Text style={styles.submittingText}>Subiendo reporte y archivos...</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 36,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#1E3A8A',
  },
  stepCircleCompleted: {
    backgroundColor: '#2563EB',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  stepTextActive: {
    color: '#FFFFFF',
  },
  stepSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 16,
  },
  stepContainer: {
    gap: 16,
  },
  card: {
    padding: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  multiSelectHelp: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
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
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  checkboxRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareSelected: {
    borderColor: '#1E3A8A',
    backgroundColor: '#1E3A8A',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  checkboxText: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  customInput: {
    marginTop: 8,
  },
  inputSpacing: {
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'justify',
  },
  helperTextNotice: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'justify',
  },
  dynamicListContainer: {
    marginTop: 10,
    gap: 12,
  },
  dynamicItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  dynamicItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dynamicItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  removeText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  addDynamicButton: {
    marginTop: 6,
  },
  witnessRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  witnessInputWrapper: {
    flex: 1,
  },
  removeWitnessBtn: {
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: 2,
  },
  removeWitnessText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  halfButton: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionHelp: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
    textAlign: 'justify',
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaPickerButton: {
    flex: 1,
  },
  meterContainer: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  meterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  meterDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  videoThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 20,
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  attachmentSize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '700',
  },
  summaryCard: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  summaryHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 18,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: '700',
  },
  alertCard: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 8,
  },
  alertText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
    textAlign: 'justify',
  },
  alertSubtext: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
    marginBottom: 16,
    textAlign: 'justify',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#DC2626',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#7F1D1D',
    lineHeight: 16,
    textAlign: 'justify',
  },
  submittingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  submittingText: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
  },
});
