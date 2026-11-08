import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
} from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../src/store/auth.store';
import { CasesService } from '../../../../src/services/cases.service';
import { Case, CaseStatus, ActType, CaseInvolvedStudent } from '../../../../src/types/database.types';
import { shareCaseDossierAsPdf } from '../../../../src/utils/pdfExport';

export default function AuthorityCaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, institution } = useAuthStore();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Modal para resolución de caso
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');

  // Modal para agregar estudiante
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentRole, setStudentRole] = useState('Estudiante señalado por la agresión');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // Modal para ver detalle de estudiante
  const [selectedStudent, setSelectedStudent] = useState<CaseInvolvedStudent | null>(null);

  const loadCaseData = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await CasesService.getCaseDetails(id as string);
      if (!error && data) {
        setCaseItem(data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadCaseData();
    }, [loadCaseData])
  );

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'open':
        return { label: 'Abierto', bg: '#EFF6FF', text: '#2563EB' };
      case 'under_investigation':
        return { label: 'En seguimiento', bg: '#FEF3C7', text: '#D97706' };
      case 'resolved':
        return { label: 'Finalizado', bg: '#DCFCE7', text: '#16A34A' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569' };
    }
  };

  const getActTypeLabel = (type: ActType, title?: string) => {
    if (title) {
      const t = title.toLowerCase();
      if (t.includes('observación') || t.includes('seguimiento')) {
        return 'Observación o seguimiento del caso';
      }
      if (t.includes('convivencia')) {
        return 'Intervención de convivencia escolar';
      }
      if (t.includes('padres') || t.includes('familiar') || t.includes('responsable')) {
        return 'Reunión con familiares o responsables';
      }
      if (t.includes('derivación') || t.includes('gabinete') || t.includes('eoe') || t.includes('organismo')) {
        return 'Derivación a equipo u organismo competente';
      }
      if (t.includes('sanción') || t.includes('medida')) {
        return 'Medida institucional adoptada';
      }
      if (t.includes('entrevista') || t.includes('estudiante')) {
        return 'Entrevista individual a estudiante';
      }
      if (t.includes('otra') || t.includes('actuación')) {
        return 'Otra actuación institucional';
      }
    }
    switch (type) {
      case 'interview_student':
        return 'Entrevista individual a estudiante';
      case 'interview_parents':
        return 'Reunión con familiares o responsables';
      case 'mediation':
        return 'Intervención de convivencia escolar';
      case 'psychological_referral':
        return 'Derivación a equipo u organismo competente';
      case 'disciplinary_measure':
        return 'Medida institucional adoptada';
      case 'closure_agreement':
        return 'Observación o seguimiento del caso';
      default:
        return type;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleConfirmResolve = async () => {
    if (!caseItem || !profile) return;
    if (!resolutionSummary.trim() || resolutionSummary.trim().length < 15) {
      Alert.alert(
        'Resumen insuficiente',
        'Por favor ingresá las conclusiones y acuerdos alcanzados (mínimo 15 caracteres).'
      );
      return;
    }

    setResolving(true);
    try {
      const { error } = await CasesService.resolveCase(
        caseItem.id,
        caseItem.report_id,
        resolutionSummary.trim(),
        profile.id,
        profile.institution_id
      );

      if (error) {
        Alert.alert('Error', error);
      } else {
        setResolveModalVisible(false);
        Alert.alert(
          'Caso Finalizado',
          'El caso ha sido concluido formalmente y el reporte asociado ha pasado a estado Finalizado.'
        );
        loadCaseData();
      }
    } finally {
      setResolving(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!caseItem || !profile) return;
    if (!studentName.trim()) {
      Alert.alert('Campo obligatorio', 'Por favor ingresá el nombre y apellido del estudiante.');
      return;
    }

    setSavingStudent(true);
    try {
      const { error } = await CasesService.addInvolvedStudentToCase({
        institution_id: profile.institution_id,
        case_id: caseItem.id,
        performed_by: profile.id,
        name: studentName.trim(),
        role: studentRole,
        course: studentCourse.trim() || undefined,
        notes: studentNotes.trim() || undefined,
      });

      if (error) {
        Alert.alert('Error', error);
      } else {
        setAddStudentModalVisible(false);
        setStudentName('');
        setStudentCourse('');
        setStudentNotes('');
        setStudentRole('Estudiante señalado por la agresión');
        Alert.alert(
          'Estudiante incorporado',
          'El estudiante ha sido añadido al expediente y quedó registrado en el historial de operaciones.'
        );
        loadCaseData();
      }
    } finally {
      setSavingStudent(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Expediente de Caso', headerBackTitle: 'Casos' }} />
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (!caseItem) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Expediente de Caso', headerBackTitle: 'Casos' }} />
        <Text style={styles.errorText}>No se pudo cargar el caso.</Text>
        <Button title="Volver" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    );
  }

  const badge = getStatusBadge(caseItem.status);
  const reportsList =
    caseItem.linked_reports && caseItem.linked_reports.length > 0
      ? caseItem.linked_reports
      : caseItem.report
      ? [caseItem.report]
      : [];

  const involvedStudents = caseItem.involved_students || [];
  const actsList = caseItem.acts || [];

  const handleExportCaseDossier = async () => {
    if (exportingPdf) return;
    try {
      setExportingPdf(true);
      await shareCaseDossierAsPdf({
        caseItem,
        institution,
        profile,
        statusLabel: badge.label,
      });
    } catch (err: any) {
      Alert.alert(
        'Error al generar PDF',
        err.message || 'No se pudo generar el documento PDF del expediente.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Expediente de Caso',
          headerBackTitle: 'Casos',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* 1. Cabecera del Caso */}
      <Card style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.caseTitle}>{caseItem.title}</Text>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <Text style={styles.caseDate}>Apertura: {formatDate(caseItem.created_at)}</Text>
        </View>

        {caseItem.status !== 'resolved' && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => router.push(`/(authority)/cases/${caseItem.id}/acts/new` as any)}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Registrar actuación</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => setResolveModalVisible(true)}
            >
              <Ionicons name="checkmark-outline" size={18} color="#1E3A8A" />
              <Text style={styles.secondaryActionText}>Finalizar caso</Text>
            </TouchableOpacity>
          </View>
        )}

        {caseItem.status === 'resolved' && caseItem.resolution_summary && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionTitle}>Conclusión y Resolución Institucional:</Text>
            <Text style={styles.resolutionText}>{caseItem.resolution_summary}</Text>
          </View>
        )}
      </Card>

      {/* 2. Reportes vinculados */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="document-text-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Reportes vinculados</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {reportsList.length} {reportsList.length === 1 ? 'reporte' : 'reportes'}
            </Text>
          </View>
        </View>

        {reportsList.map((rep) => (
          <TouchableOpacity
            key={rep.id}
            style={styles.itemCard}
            onPress={() => router.push(`/(authority)/reports/${rep.id}` as any)}
          >
            <View style={styles.itemIconWrap}>
              <Ionicons name="document-text-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{rep.situation_type}</Text>
              <Text style={styles.itemSubtitle}>
                {rep.student?.first_name} {rep.student?.last_name}
                {rep.course ? ` · ${rep.course.year}.° ${rep.course.division} (${rep.course.shift})` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        ))}
      </Card>

      {/* 3. Estudiantes involucrados */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="people-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Estudiantes involucrados</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {involvedStudents.length} {involvedStudents.length === 1 ? 'estudiante' : 'estudiantes'}
            </Text>
          </View>
        </View>

        {involvedStudents.map((st) => (
          <TouchableOpacity
            key={st.id}
            style={styles.itemCard}
            onPress={() => setSelectedStudent(st)}
          >
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{st.name}</Text>
              <Text style={styles.itemSubtitle}>{st.role}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        ))}

        {caseItem.status !== 'resolved' && (
          <TouchableOpacity
            style={styles.addActionButton}
            onPress={() => setAddStudentModalVisible(true)}
          >
            <Ionicons name="add" size={18} color="#1E3A8A" />
            <Text style={styles.addActionText}>Agregar estudiante</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* 4. Actuaciones y seguimiento */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="clipboard-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Actuaciones y seguimiento</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {actsList.length} {actsList.length === 1 ? 'actuación' : 'actuaciones'}
            </Text>
          </View>
        </View>

        {actsList.length === 0 ? (
          <Text style={styles.emptyText}>
            Aún no se han registrado actuaciones formales en este expediente.
          </Text>
        ) : (
          actsList.map((act) => (
            <TouchableOpacity
              key={act.id}
              style={styles.actCard}
              onPress={() =>
                router.push(`/(authority)/cases/${caseItem.id}/acts/${act.id}` as any)
              }
            >
              <View style={styles.actTopRow}>
                <View style={styles.actTypeBadge}>
                  <Text style={styles.actTypeBadgeText}>{getActTypeLabel(act.act_type, act.title)}</Text>
                </View>
                <Text style={styles.actDateText}>{formatDate(act.occurred_at)}</Text>
              </View>

              <View style={styles.actTitleRow}>
                <Text style={styles.actTitle}>{act.title}</Text>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </View>

              <Text style={styles.actParticipants}>
                Participantes: {act.participants || 'Autoridad escolar'}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {caseItem.status !== 'resolved' && (
          <TouchableOpacity
            style={styles.addActionButton}
            onPress={() => router.push(`/(authority)/cases/${caseItem.id}/acts/new` as any)}
          >
            <Ionicons name="add" size={18} color="#1E3A8A" />
            <Text style={styles.addActionText}>Registrar nueva actuación</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* 5. Historial de operaciones */}
      <TouchableOpacity
        style={styles.historyCard}
        onPress={() => router.push(`/(authority)/cases/${caseItem.id}/history` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.historyIconWrap}>
          <Ionicons name="time-outline" size={22} color="#2563EB" />
        </View>
        <View style={styles.historyContent}>
          <Text style={styles.historyTitle}>Historial de operaciones</Text>
          <Text style={styles.historySubtitle}>
            Consultá la creación del caso, los cambios de estado y otras acciones realizadas.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </TouchableOpacity>

      {/* 6. Exportar / Imprimir Resumen del Expediente */}
      <TouchableOpacity
        style={[styles.historyCard, exportingPdf && { opacity: 0.6 }]}
        onPress={handleExportCaseDossier}
        disabled={exportingPdf}
        activeOpacity={0.7}
      >
        <View style={[styles.historyIconWrap, { backgroundColor: '#DCFCE7' }]}>
          {exportingPdf ? (
            <ActivityIndicator size="small" color="#15803D" />
          ) : (
            <Ionicons name="print-outline" size={22} color="#15803D" />
          )}
        </View>
        <View style={styles.historyContent}>
          <Text style={styles.historyTitle}>
            {exportingPdf ? 'Generando documento PDF...' : 'Exportar / Imprimir expediente completo'}
          </Text>
          <Text style={styles.historySubtitle}>
            Generá el documento formal consolidado con todas las actuaciones y espacio para firmas.
          </Text>
        </View>
        <Ionicons name="share-outline" size={20} color="#15803D" />
      </TouchableOpacity>

      {/* 7. Confidencialidad */}
      <View style={styles.confidentialityCard}>
        <Ionicons name="information-circle-outline" size={24} color="#1E3A8A" />
        <View style={styles.confidentialityContent}>
          <Text style={styles.confidentialityTitle}>Confidencialidad</Text>
          <Text style={styles.confidentialityText}>
            La información del caso es de uso institucional y debe resguardar la identidad y el
            bienestar de los estudiantes, según la normativa vigente.
          </Text>
        </View>
      </View>

      {/* Modal: Agregar estudiante al caso */}
      <Modal
        visible={addStudentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStudentModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar estudiante</Text>
              <TouchableOpacity onPress={() => setAddStudentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nombre y apellido *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Lucas Fernández"
                value={studentName}
                onChangeText={setStudentName}
              />

              <Text style={styles.fieldLabel}>Rol en la situación *</Text>
              <View style={styles.roleChipsRow}>
                {[
                  'Estudiante señalado por la agresión',
                  'Estudiante afectado',
                  'Estudiante que presenció lo sucedido',
                  'Otro estudiante involucrado',
                ].map((roleOption) => {
                  const isSelected = studentRole === roleOption;
                  return (
                    <TouchableOpacity
                      key={roleOption}
                      style={[
                        styles.roleChip,
                        isSelected && styles.roleChipSelected,
                      ]}
                      onPress={() => setStudentRole(roleOption)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          isSelected && styles.roleChipTextSelected,
                        ]}
                      >
                        {roleOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Curso / División (opcional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. 3.° B (Mañana)"
                value={studentCourse}
                onChangeText={setStudentCourse}
              />

              <Text style={styles.fieldLabel}>Observación o detalle (opcional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Información relevante para el seguimiento institucional..."
                value={studentNotes}
                onChangeText={setStudentNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setAddStudentModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleSaveStudent}
                  disabled={savingStudent}
                >
                  {savingStudent ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Guardar estudiante</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Detalle de estudiante */}
      <Modal
        visible={!!selectedStudent}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información del estudiante</Text>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedStudent && (
              <View style={{ gap: 12 }}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Nombre y apellido:</Text>
                  <Text style={styles.detailValue}>{selectedStudent.name}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Rol en el expediente:</Text>
                  <Text style={styles.detailValue}>{selectedStudent.role}</Text>
                </View>

                {selectedStudent.course && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Curso / División:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.course}</Text>
                  </View>
                )}

                {selectedStudent.notes && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Observación:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.notes}</Text>
                  </View>
                )}

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Origen del registro:</Text>
                  <Text style={styles.detailValue}>
                    {selectedStudent.source === 'manual'
                      ? 'Incorporado manualmente por autoridad escolar'
                      : 'Informado en el reporte de origen'}
                  </Text>
                </View>

                <Button
                  title="Cerrar"
                  onPress={() => setSelectedStudent(null)}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Resolución de Caso */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Concluir Caso Formal</Text>
              <TouchableOpacity onPress={() => setResolveModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>
                Al finalizar el caso, se dejará constancia formal de los acuerdos, medidas
                pedagógicas de reparación y compromisos de convivencia acordados entre las partes.
              </Text>

              <Text style={styles.fieldLabel}>Conclusiones y Acuerdos de Convivencia *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Detallá los compromisos acordados, mediaciones concluidas y seguimiento pedagógico..."
                value={resolutionSummary}
                onChangeText={setResolutionSummary}
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setResolveModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: '#16A34A' }]}
                  onPress={handleConfirmResolve}
                  disabled={resolving}
                >
                  {resolving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Finalizar caso</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    minWidth: 120,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 24,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  caseDate: {
    fontSize: 13,
    color: '#64748B',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '700',
  },
  resolutionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
  },
  resolutionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
    fontStyle: 'italic',
  },
  actCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  actTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  actTypeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  actDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  actTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  actParticipants: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  historyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
    marginRight: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  historySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },
  confidentialityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F4F5FD',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    marginBottom: 20,
  },
  confidentialityContent: {
    flex: 1,
    marginLeft: 12,
  },
  confidentialityTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  confidentialityText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  roleChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  roleChipText: {
    fontSize: 12,
    color: '#475569',
  },
  roleChipTextSelected: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailItem: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
});
