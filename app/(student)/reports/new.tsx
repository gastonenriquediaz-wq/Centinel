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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/auth.store';
import { ReportsService, AttachmentInput } from '../../../src/services/reports.service';

const SITUATION_TYPES = [
  'Agresión física',
  'Hostigamiento verbal / insultos',
  'Ciberacoso / Difamación digital',
  'Exclusión o aislamiento social',
  'Amenazas o coacción',
  'Daño a pertenencias materiales',
  'Otro tipo de situación',
];

const FREQUENCIES = [
  'Ocurrió una sola vez',
  'Ocurre de forma ocasional',
  'Ocurre frecuentemente (semanal)',
  'Ocurre de forma continua / diaria',
];

const LOCATIONS = [
  'Dentro del aula',
  'Patio / Recreo',
  'Baños',
  'Entrada / Salida del colegio',
  'En las inmediaciones del colegio',
  'Redes sociales / Mensajería digital',
  'Otro lugar',
];

export default function NewReportScreen() {
  const { profile, institution } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [situationType, setSituationType] = useState('');
  const [customSituation, setCustomSituation] = useState('');
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [occurredAtDate, setOccurredAtDate] = useState(new Date().toISOString().split('T')[0]);
  const [frequency, setFrequency] = useState('');
  const [involvedPersons, setInvolvedPersons] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Selector de multimedia
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
        const fileSize = asset.fileSize || 1024 * 500; // Aproximado si el OS no lo expone

        // Validar tamaño individual y límites acumulados
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

  // Cálculos de tamaños de archivos
  const totalSizeBytes = attachments.reduce((sum, a) => sum + a.size, 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  // Navegación de pasos y validaciones
  const handleNext = () => {
    if (currentStep === 1) {
      const selectedType = situationType === 'Otro tipo de situación' ? customSituation : situationType;
      const selectedLoc = location === 'Otro lugar' ? customLocation : location;

      if (!selectedType.trim()) {
        Alert.alert('Campo requerido', 'Por favor selecciona o especifica el tipo de situación.');
        return;
      }
      if (!selectedLoc.trim()) {
        Alert.alert('Campo requerido', 'Por favor selecciona o especifica el lugar del hecho.');
        return;
      }
      if (!frequency) {
        Alert.alert('Campo requerido', 'Por favor selecciona con qué frecuencia ocurre la situación.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!involvedPersons.trim()) {
        Alert.alert('Campo requerido', 'Por favor indica las personas involucradas o testigos.');
        return;
      }
      if (!description.trim() || description.trim().length < 15) {
        Alert.alert('Descripción insuficiente', 'Por favor proporciona una descripción detallada de lo sucedido (mínimo 15 caracteres).');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
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
      const finalSituation = situationType === 'Otro tipo de situación' ? customSituation : situationType;
      const finalLocation = location === 'Otro lugar' ? customLocation : location;

      const { data, error } = await ReportsService.createReport(
        {
          institution_id: institution.id,
          course_id: profile.course_id,
          student_id: profile.id,
          situation_type: finalSituation,
          location: finalLocation,
          occurred_at: new Date(occurredAtDate).toISOString(),
          frequency: frequency,
          involved_persons: involvedPersons,
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
    <ScrollView contentContainerStyle={styles.container}>
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
        {currentStep === 2 && 'Paso 2: Relato y Personas'}
        {currentStep === 3 && 'Paso 3: Evidencia Multimedia (Opcional)'}
        {currentStep === 4 && 'Paso 4: Confirmación y Envío'}
      </Text>

      {/* PASO 1 */}
      {currentStep === 1 && (
        <View style={styles.stepContainer}>
          <Card style={styles.card}>
            <Text style={styles.label}>¿Qué tipo de situación deseas comunicar?</Text>
            {SITUATION_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.radioItem, situationType === type && styles.radioItemSelected]}
                onPress={() => setSituationType(type)}
              >
                <View style={[styles.radioDot, situationType === type && styles.radioDotSelected]} />
                <Text style={styles.radioText}>{type}</Text>
              </TouchableOpacity>
            ))}

            {situationType === 'Otro tipo de situación' && (
              <Input
                label="Especifica el tipo de situación"
                placeholder="Escribe aquí el tipo..."
                value={customSituation}
                onChangeText={setCustomSituation}
                style={styles.customInput}
              />
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.label}>¿Dónde ocurrió o suele ocurrir?</Text>
            {LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.radioItem, location === loc && styles.radioItemSelected]}
                onPress={() => setLocation(loc)}
              >
                <View style={[styles.radioDot, location === loc && styles.radioDotSelected]} />
                <Text style={styles.radioText}>{loc}</Text>
              </TouchableOpacity>
            ))}

            {location === 'Otro lugar' && (
              <Input
                label="Especifica el lugar"
                placeholder="Escribe el lugar aquí..."
                value={customLocation}
                onChangeText={setCustomLocation}
                style={styles.customInput}
              />
            )}
          </Card>

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

          <Button title="Continuar al Paso 2" onPress={handleNext} style={styles.navButton} />
        </View>
      )}

      {/* PASO 2 */}
      {currentStep === 2 && (
        <View style={styles.stepContainer}>
          <Card style={styles.card}>
            <Input
              label="Personas involucradas o testigos"
              placeholder="Ej: Nombres, apodos, cursos de quienes participaron o presenciaron el hecho..."
              value={involvedPersons}
              onChangeText={setInvolvedPersons}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.helperText}>
              Indica con la mayor precisión posible a las personas para que las autoridades puedan investigar.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Input
              label="Descripción de lo sucedido"
              placeholder="Describe lo ocurrido con el mayor detalle posible: qué pasó, cuándo comenzó, qué se dijeron o hicieron..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
            />
            <Text style={styles.helperText}>Mínimo 15 caracteres. Recuerda que no se podrá editar una vez enviado.</Text>
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

      {/* PASO 3 */}
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

      {/* PASO 4 */}
      {currentStep === 4 && (
        <View style={styles.stepContainer}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryHeader}>Resumen de la Comunicación</Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Situación:</Text>{' '}
              {situationType === 'Otro tipo de situación' ? customSituation : situationType}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Lugar:</Text>{' '}
              {location === 'Otro lugar' ? customLocation : location}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Frecuencia:</Text> {frequency}
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.bold}>Involucrados:</Text> {involvedPersons}
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
    marginBottom: 12,
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
  customInput: {
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  navButton: {
    marginTop: 8,
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
  },
  alertSubtext: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
    marginBottom: 16,
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
