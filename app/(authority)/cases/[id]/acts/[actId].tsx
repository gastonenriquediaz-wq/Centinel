import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../../src/components/ui/Card';
import { Button } from '../../../../../src/components/ui/Button';
import { useAuthStore } from '../../../../../src/store/auth.store';
import { CasesService } from '../../../../../src/services/cases.service';
import { Case, CaseAct } from '../../../../../src/types/database.types';
import { getActTypeLabel } from '../../../../../src/utils/textMigration';

export default function AuthorityCaseActDetailScreen() {
  const { id, actId } = useLocalSearchParams<{ id: string; actId: string }>();
  const { institution } = useAuthStore();
  const [act, setAct] = useState<CaseAct | null>(null);
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'digital' | 'printable'>('digital');

  useEffect(() => {
    if (actId) {
      loadActData();
    }
  }, [actId, id]);

  const loadActData = async () => {
    try {
      const [actRes, caseRes] = await Promise.all([
        CasesService.getCaseActDetails(actId as string),
        id ? CasesService.getCaseDetails(id as string) : Promise.resolve({ data: null, error: null }),
      ]);

      if (actRes.data) {
        setAct(actRes.data);
      }
      if (caseRes.data) {
        setCaseItem(caseRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
      ];
      const month = months[d.getMonth()] || 'octubre';
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
      hours = hours % 12 || 12;
      return `${day} de ${month} de ${year} · ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('directivo') || r.includes('director')) {
      return { bg: '#EFF6FF', text: '#1E3A8A' };
    }
    if (r.includes('estudiante')) {
      return { bg: '#E0F2FE', text: '#0284C7' };
    }
    if (r.includes('familiar') || r.includes('padre') || r.includes('tutor') || r.includes('madre')) {
      return { bg: '#FEF3C7', text: '#D97706' };
    }
    if (r.includes('gabinete') || r.includes('eoe') || r.includes('orientador')) {
      return { bg: '#F3E8FF', text: '#7C3AED' };
    }
    if (r.includes('docente') || r.includes('preceptor')) {
      return { bg: '#DCFCE7', text: '#16A34A' };
    }
    return { bg: '#F1F5F9', text: '#475569' };
  };

  // Parsear participantes para armar casilleros de firma
  const parsedParticipants = useMemo(() => {
    if (!act?.participants) return [];
    const sep = act.participants.includes(';') ? ';' : ',';
    return act.participants
      .split(sep)
      .map((pStr) => {
        const trimmed = pStr.trim();
        if (!trimmed) return null;
        const [rolePart, ...rest] = trimmed.split(':');
        const hasRole = rest.length > 0;
        const role = hasRole ? rolePart.trim() : 'Compareciente / Interviniente';
        const name = hasRole ? rest.join(':').trim() : trimmed;
        return { role, name };
      })
      .filter((x): x is { role: string; name: string } => x !== null);
  }, [act]);

  // Generar texto formal completo para imprimir / exportar
  const buildPrintableDocumentText = () => {
    if (!act) return '';
    const instName = institution?.name || 'ESTABLECIMIENTO EDUCATIVO';
    const instAddress = institution?.address ? `Dirección: ${institution.address}\n` : '';
    const actTypeLabel = getActTypeLabel(act.act_type, act.title);
    const dateFormatted = formatDateTime(act.occurred_at);
    const creatorName = act.creator
      ? `${act.creator.first_name} ${act.creator.last_name} (${act.creator.position || 'Autoridad Escolar'})`
      : 'Autoridad Escolar';

    const participantsLines =
      parsedParticipants.length > 0
        ? parsedParticipants.map((p, idx) => `   ${idx + 1}. [${p.role}] ${p.name}`).join('\n')
        : `   • ${act.participants}`;

    const signatureBlocks =
      parsedParticipants.length > 0
        ? parsedParticipants
            .map(
              (p) =>
                `\n\n_________________________________________\nFirma: ${p.name}\nCarácter / Rol: ${p.role}\nDNI N°: _______________________________`
            )
            .join('\n')
        : `\n\n_________________________________________\nFirma y Aclaración del Compareciente\nDNI N°: _______________________________`;

    return (
      `==================================================\n` +
      `${instName.toUpperCase()}\n` +
      `${instAddress}` +
      `PROTOCOLO DE CONVIVENCIA ESCOLAR (LEY N° 26.892)\n` +
      `==================================================\n\n` +
      `ACTA DE ACTUACIÓN INSTITUCIONAL\n\n` +
      `• EXPEDIENTE VINCULADO: ${caseItem?.title || 'Intervención Escolar'}\n` +
      `• MODALIDAD DE ACTUACIÓN: ${actTypeLabel}\n` +
      `• TÍTULO: ${act.title}\n` +
      `• FECHA Y HORA: ${dateFormatted}\n` +
      `• AUTORIDAD RESPONSABLE: ${creatorName}\n\n` +
      `--------------------------------------------------\n` +
      `1. PERSONAS PRESENTES / INTERVINIENTES\n` +
      `--------------------------------------------------\n` +
      `En las instalaciones de ${instName}, en la fecha y hora indicadas, comparecen las siguientes personas:\n` +
      `${participantsLines}\n\n` +
      `--------------------------------------------------\n` +
      `2. DESARROLLO DE LA ACTUACIÓN, ACUERDOS Y ACCIONES\n` +
      `--------------------------------------------------\n` +
      `${act.content}\n\n` +
      `--------------------------------------------------\n` +
      `3. RATIFICACIÓN Y FIRMAS OLÓGRAFAS DE CONFORMIDAD\n` +
      `--------------------------------------------------\n` +
      `No siendo para más, previa lectura en voz alta y ratificación íntegra de lo expuesto en la presente acta, firman al pie de conformidad los comparecientes junto a la autoridad educativa actuante:\n` +
      `${signatureBlocks}\n\n` +
      `_________________________________________\n` +
      `Sello del Establecimiento y Firma Directiva\n` +
      `Responsable: ${creatorName}\n` +
      `Registro Digital Centinel: ${formatDateTime(act.created_at)}\n` +
      `==================================================`
    );
  };

  const handleExportOrPrint = async () => {
    try {
      const docText = buildPrintableDocumentText();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
        setViewMode('printable');
        setTimeout(() => window.print(), 250);
        return;
      }

      await Share.share({
        title: `Acta Institucional - ${act?.title || 'Centinel'}`,
        message: docText,
      });
    } catch (err: any) {
      Alert.alert('Error al exportar', err.message || 'No se pudo compartir el documento.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (!act) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Detalle del Acta', headerBackTitle: 'Volver' }} />
        <Card style={styles.card}>
          <Text style={styles.emptyTitle}>Acta no encontrada</Text>
          <Text style={styles.emptyText}>
            No se pudo encontrar la información del acta digital solicitada.
          </Text>
          <Button title="Volver al Expediente" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Detalle de la Actuación',
          headerBackTitle: 'Expediente',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      {/* Selector de Modo de Visualización: Lectura Digital vs. Protocolo Físico con Firmas */}
      <View style={styles.modeSelectorWrap}>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'digital' && styles.modeTabActive]}
          onPress={() => setViewMode('digital')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={16}
            color={viewMode === 'digital' ? '#FFFFFF' : '#475569'}
          />
          <Text style={[styles.modeTabText, viewMode === 'digital' && styles.modeTabTextActive]}>
            Vista Digital
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'printable' && styles.modeTabActive]}
          onPress={() => setViewMode('printable')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="print-outline"
            size={16}
            color={viewMode === 'printable' ? '#FFFFFF' : '#475569'}
          />
          <Text style={[styles.modeTabText, viewMode === 'printable' && styles.modeTabTextActive]}>
            Protocolo con Firmas
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'digital' ? (
        <>
          {/* 1. Contexto del Caso vinculado */}
          {caseItem && (
            <Card style={styles.caseContextCard}>
              <View style={styles.caseContextRow}>
                <View style={styles.caseIconContainer}>
                  <Ionicons name="folder-outline" size={20} color="#1E3A8A" />
                </View>
                <View style={styles.caseContextTextContainer}>
                  <Text style={styles.caseContextLabel}>Expediente vinculado</Text>
                  <Text style={styles.caseContextTitle} numberOfLines={2}>
                    {caseItem.title}
                  </Text>
                  {caseItem.report?.student && (
                    <Text style={styles.caseContextStudent}>
                      👤 {caseItem.report.student.first_name} {caseItem.report.student.last_name}
                      {caseItem.report.course
                        ? ` · ${caseItem.report.course.year}° "${caseItem.report.course.division}"`
                        : ''}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          )}

          {/* 2. Tarjeta Principal de la Actuación */}
          <Card style={styles.actMainCard}>
            {/* Cabecera de la Actuación */}
            <View style={styles.actTopHeader}>
              <View style={styles.actBadge}>
                <Text style={styles.actBadgeText}>{getActTypeLabel(act.act_type, act.title)}</Text>
              </View>
              <View style={styles.actDateRow}>
                <Ionicons name="calendar-outline" size={14} color="#64748B" style={styles.metaIcon} />
                <Text style={styles.actDateText}>{formatDateTime(act.occurred_at)}</Text>
              </View>
            </View>

            <Text style={styles.actTitle}>{act.title}</Text>

            {/* Participantes estructurados */}
            <View style={styles.sectionDivider} />
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="people-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
              <Text style={styles.sectionLabel}>Personas presentes / intervinientes</Text>
            </View>

            <View style={styles.participantsBox}>
              {parsedParticipants.length > 0 ? (
                <View style={styles.participantsListCol}>
                  {parsedParticipants.map((p, i) => {
                    const bStyle = getRoleBadgeStyle(p.role);
                    return (
                      <View key={i} style={styles.participantItemRow}>
                        <View style={[styles.participantRoleBadge, { backgroundColor: bStyle.bg }]}>
                          <Text style={[styles.participantRoleText, { color: bStyle.text }]}>
                            {p.role}
                          </Text>
                        </View>
                        <Text style={styles.participantNameText}>{p.name}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.participantsText}>{act.participants}</Text>
              )}
            </View>

            {/* Contenido Completo del Acta */}
            <View style={styles.sectionDivider} />
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="document-text-outline" size={18} color="#1E3A8A" style={styles.sectionIcon} />
              <Text style={styles.sectionLabel}>Desarrollo y relato de la actuación</Text>
            </View>
            <View style={styles.contentBox}>
              <Text style={styles.contentText}>{act.content}</Text>
            </View>

            {/* Firma digital y Responsable */}
            <View style={styles.sectionDivider} />
            <View style={styles.authorSection}>
              <View style={styles.authorIconContainer}>
                <Ionicons name="shield-checkmark" size={20} color="#1E3A8A" />
              </View>
              <View style={styles.authorTextContainer}>
                <Text style={styles.authorLabel}>Responsable del labrado:</Text>
                <Text style={styles.authorName}>
                  {act.creator?.first_name} {act.creator?.last_name}
                  {act.creator?.position ? ` (${act.creator.position})` : ' (Autoridad escolar)'}
                </Text>
                <Text style={styles.createdDateText}>
                  Registro digital: {formatDateTime(act.created_at)}
                </Text>
              </View>
            </View>
          </Card>
        </>
      ) : (
        /* MODO PROTOCOLO FÍSICO CON ESPACIO PARA FIRMAS OLÓGRAFAS */
        <View style={styles.paperSheet}>
          {/* Membrete Institucional */}
          <View style={styles.paperHeader}>
            <Text style={styles.paperInstName}>
              {(institution?.name || 'ESTABLECIMIENTO EDUCATIVO').toUpperCase()}
            </Text>
            {institution?.address ? (
              <Text style={styles.paperInstSub}>{institution.address}</Text>
            ) : null}
            <Text style={styles.paperLawLegend}>
              PROTOCOLO DE CONVIVENCIA ESCOLAR — LEY NACIONAL N° 26.892
            </Text>
          </View>

          <View style={styles.paperDoubleDivider} />

          {/* Título del Documento */}
          <Text style={styles.paperDocTitle}>ACTA DE ACTUACIÓN INSTITUCIONAL</Text>

          {/* Metadatos de Carátula */}
          <View style={styles.paperMetaBox}>
            <Text style={styles.paperMetaLine}>
              <Text style={styles.paperMetaBold}>Expediente vinculado: </Text>
              {caseItem?.title || 'Actuación Escolar'}
            </Text>
            <Text style={styles.paperMetaLine}>
              <Text style={styles.paperMetaBold}>Tipo de actuación: </Text>
              {getActTypeLabel(act.act_type, act.title)}
            </Text>
            <Text style={styles.paperMetaLine}>
              <Text style={styles.paperMetaBold}>Asunto / Carátula: </Text>
              {act.title}
            </Text>
            <Text style={styles.paperMetaLine}>
              <Text style={styles.paperMetaBold}>Fecha y hora: </Text>
              {formatDateTime(act.occurred_at)}
            </Text>
          </View>

          {/* Fórmula de Apertura */}
          <Text style={styles.paperParagraph}>
            En las instalaciones de{' '}
            <Text style={styles.paperMetaBold}>
              {institution?.name || 'la institución educativa'}
            </Text>
            , siendo la fecha y hora arriba consignadas, se reúnen ante la autoridad escolar actuante las personas que se detallan a continuación con el objeto de labrar la presente acta institucional:
          </Text>

          {/* Comparecientes */}
          <Text style={styles.paperSectionHeading}>1. PERSONAS PRESENTES / INTERVINIENTES</Text>
          <View style={styles.paperParticipantsList}>
            {parsedParticipants.map((p, idx) => (
              <Text key={idx} style={styles.paperParticipantRow}>
                • <Text style={styles.paperMetaBold}>{p.role}:</Text> {p.name}
              </Text>
            ))}
          </View>

          {/* Cuerpo del Acta */}
          <Text style={styles.paperSectionHeading}>
            2. DESARROLLO DE LA ACTUACIÓN, COMPROMISOS Y PAUTAS
          </Text>
          <View style={styles.paperBodyBox}>
            <Text style={styles.paperBodyText}>{act.content}</Text>
          </View>

          {/* Fórmula de Ratificación y Cierre */}
          <Text style={styles.paperParagraph}>
            No siendo para más, previa lectura íntegra y ratificación de todo lo expuesto en la presente actuación, firman al pie de conformidad los comparecientes por ante mí que certifico.
          </Text>

          {/* Grilla de Firmas Ológrafas */}
          <Text style={styles.paperSectionHeading}>
            3. FIRMAS DE CONFORMIDAD Y ACLARACIÓN
          </Text>

          <View style={styles.signaturesGrid}>
            {parsedParticipants.map((p, idx) => (
              <View key={idx} style={styles.signatureBox}>
                <View style={styles.signatureBlankSpace} />
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{p.name}</Text>
                <Text style={styles.signatureRole}>{p.role}</Text>
                <Text style={styles.signatureDni}>DNI: _______________________</Text>
              </View>
            ))}

            {/* Casillero para Sello Escolar y Certificación */}
            <View style={[styles.signatureBox, styles.stampBox]}>
              <View style={styles.signatureBlankSpace} />
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {act.creator?.first_name} {act.creator?.last_name}
              </Text>
              <Text style={styles.signatureRole}>
                {act.creator?.position || 'Autoridad Escolar'} — Sello Institucional
              </Text>
              <Text style={styles.signatureDni}>Certificación de Actuación</Text>
            </View>
          </View>

          <View style={styles.paperFooter}>
            <Text style={styles.paperFooterText}>
              Documento generado mediante Sistema Centinel · Registro Digital: {formatDateTime(act.created_at)}
            </Text>
          </View>
        </View>
      )}

      {/* Botón Principal para Compartir / Exportar para Impresión */}
      <TouchableOpacity
        style={styles.exportPrintBtn}
        onPress={handleExportOrPrint}
        activeOpacity={0.8}
      >
        <Ionicons name="share-outline" size={20} color="#FFFFFF" />
        <Text style={styles.exportPrintBtnText}>
          Compartir / Exportar Acta con Espacio para Firmas
        </Text>
      </TouchableOpacity>

      {/* Callout Informativo de Reserva */}
      <View style={styles.noticeCallout}>
        <Ionicons name="lock-closed-outline" size={20} color="#1E3A8A" style={styles.noticeIcon} />
        <View style={styles.noticeTextContainer}>
          <Text style={styles.noticeTitle}>Validez documental y protocolo físico</Text>
          <Text style={styles.noticeDesc}>
            Podés alternar a la pestaña "Protocolo con Firmas" o exportar el documento formal para imprimirlo y recabar las firmas ológrafas de los padres, tutores y alumnos en el legajo físico.
          </Text>
        </View>
      </View>

      {/* Botón de Regreso */}
      <Button
        title="Volver al Expediente"
        variant="outline"
        onPress={() => router.back()}
        style={styles.backButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
    gap: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  modeSelectorWrap: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#1E3A8A',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  caseContextCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  caseContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caseIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  caseContextTextContainer: {
    flex: 1,
  },
  caseContextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  caseContextTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  caseContextStudent: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  actMainCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  actBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  actDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 4,
  },
  actDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  actTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  participantsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  participantsListCol: {
    gap: 6,
  },
  participantItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  participantRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  participantNameText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  participantsText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  contentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contentText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
  },
  authorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  authorTextContainer: {
    flex: 1,
  },
  authorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  authorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#15803D',
    marginTop: 1,
  },
  createdDateText: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 2,
  },
  /* ESTILOS DE HOJA DE PROTOCOLO FÍSICO CON FIRMAS */
  paperSheet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  paperHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  paperInstName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  paperInstSub: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  paperLawLegend: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  paperDoubleDivider: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#0F172A',
    marginVertical: 10,
  },
  paperDocTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginVertical: 8,
  },
  paperMetaBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 10,
    marginVertical: 8,
    gap: 4,
  },
  paperMetaLine: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  paperMetaBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  paperParagraph: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 19,
    textAlign: 'justify',
    marginVertical: 8,
  },
  paperSectionHeading: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 3,
  },
  paperParticipantsList: {
    paddingLeft: 6,
    gap: 4,
    marginBottom: 6,
  },
  paperParticipantRow: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  paperBodyBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#FAFAFA',
    marginVertical: 4,
  },
  paperBodyText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 20,
  },
  signaturesGrid: {
    marginTop: 12,
    gap: 14,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  stampBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#94A3B8',
  },
  signatureBlankSpace: {
    height: 38,
  },
  signatureLine: {
    width: '80%',
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  signatureRole: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  signatureDni: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  paperFooter: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  paperFooterText: {
    fontSize: 10.5,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  exportPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  exportPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noticeCallout: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  noticeIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  noticeDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  backButton: {
    marginTop: 4,
  },
});
