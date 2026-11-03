import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Case, CaseAct, Institution, Profile } from '../types/database.types';
import { getActTypeLabel } from './textMigration';

function escapeHtml(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 55);
}

export function formatFormalDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Sin fecha registrada';
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
    return `${day} de ${month} de ${year} a las ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

export interface ParsedParticipant {
  role: string;
  name: string;
}

export function parseActParticipants(participantsRaw?: string | null): ParsedParticipant[] {
  if (!participantsRaw) return [];
  const sep = participantsRaw.includes(';') ? ';' : ',';
  return participantsRaw
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
    .filter((x): x is ParsedParticipant => x !== null);
}

function buildActHtml(params: {
  act: CaseAct;
  caseItem?: Case | null;
  institution?: Institution | null;
}): string {
  const { act, caseItem, institution } = params;
  const instName = escapeHtml(institution?.name || 'ESTABLECIMIENTO EDUCATIVO');
  const instAddress = institution?.address ? escapeHtml(institution.address) : '';
  const instCode = institution?.identification_code ? escapeHtml(institution.identification_code) : '';
  const actTypeLabel = escapeHtml(getActTypeLabel(act.act_type, act.title));
  const actTitle = escapeHtml(act.title);
  const caseTitle = escapeHtml(caseItem?.title || 'Expediente de Convivencia Escolar');
  const occurredDate = escapeHtml(formatFormalDateTime(act.occurred_at));
  const createdDate = escapeHtml(formatFormalDateTime(act.created_at));
  const folioCode = escapeHtml(act.id.slice(0, 8).toUpperCase());

  const creatorName = act.creator
    ? escapeHtml(`${act.creator.first_name} ${act.creator.last_name}`)
    : 'Autoridad Escolar';
  const creatorPosition = act.creator?.position
    ? escapeHtml(act.creator.position)
    : 'Equipo Directivo / Convivencia';

  const participants = parseActParticipants(act.participants);

  const participantsRowsHtml =
    participants.length > 0
      ? participants
          .map(
            (p, idx) => `
            <tr>
              <td class="td-num">${idx + 1}</td>
              <td class="td-role"><span class="role-pill">${escapeHtml(p.role)}</span></td>
              <td class="td-name">${escapeHtml(p.name)}</td>
              <td class="td-status">Presente</td>
            </tr>`
          )
          .join('')
      : `
        <tr>
          <td class="td-num">1</td>
          <td class="td-role"><span class="role-pill">Intervinientes</span></td>
          <td class="td-name">${escapeHtml(act.participants)}</td>
          <td class="td-status">Presente</td>
        </tr>`;

  const signatureCardsHtml =
    participants.length > 0
      ? participants
          .map(
            (p) => `
            <div class="sig-box">
              <div class="sig-space"></div>
              <div class="sig-line">FIRMA OLÓGRAFA DEL COMPARECIENTE</div>
              <div class="sig-meta">
                <div><strong>Aclaración:</strong> ${escapeHtml(p.name)}</div>
                <div><strong>Carácter / Rol:</strong> ${escapeHtml(p.role)}</div>
                <div><strong>DNI N°:</strong> ......................................................</div>
              </div>
            </div>`
          )
          .join('')
      : `
        <div class="sig-box">
          <div class="sig-space"></div>
          <div class="sig-line">FIRMA OLÓGRAFA DEL COMPARECIENTE</div>
          <div class="sig-meta">
            <div><strong>Aclaración:</strong> ......................................................</div>
            <div><strong>Carácter / Rol:</strong> Interviniente</div>
            <div><strong>DNI N°:</strong> ......................................................</div>
          </div>
        </div>`;

  const formattedContentParagraphs = escapeHtml(act.content)
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p class="content-p">${p.trim()}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Acta Institucional - ${actTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 16mm 18mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.48;
      background-color: #FFFFFF;
    }
    .document-border {
      border: 1.5px solid #1E3A8A;
      padding: 18px 22px 22px 22px;
      border-radius: 4px;
    }
    /* ENCABEZADO */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #1E3A8A;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-left {
      width: 68%;
      vertical-align: top;
      padding-bottom: 10px;
    }
    .header-right {
      width: 32%;
      vertical-align: top;
      text-align: right;
      padding-bottom: 10px;
    }
    .inst-badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      color: #1E3A8A;
      background-color: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 3px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .inst-name {
      font-size: 15pt;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 2px 0 3px 0;
    }
    .inst-sub {
      font-size: 9pt;
      color: #475569;
      margin: 0;
    }
    .folio-box {
      display: inline-block;
      border: 1px solid #CBD5E1;
      background-color: #F8FAFC;
      border-radius: 4px;
      padding: 6px 10px;
      text-align: right;
    }
    .folio-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .folio-value {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1E3A8A;
      margin-top: 1px;
    }
    .law-banner {
      background-color: #1E3A8A;
      color: #FFFFFF;
      text-align: center;
      padding: 7px 12px;
      border-radius: 4px;
      margin-bottom: 14px;
    }
    .law-banner-title {
      font-size: 11.5pt;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 0;
    }
    .law-banner-sub {
      font-size: 8pt;
      color: #DBEAFE;
      margin: 2px 0 0 0;
    }
    /* TABLA METADATOS */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9.5pt;
    }
    .meta-table td {
      border: 1px solid #CBD5E1;
      padding: 6px 10px;
      vertical-align: top;
    }
    .meta-label {
      background-color: #F1F5F9;
      font-weight: 700;
      color: #334155;
      width: 24%;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.3px;
    }
    .meta-value {
      color: #0F172A;
      font-weight: 600;
      width: 26%;
    }
    /* SECCIONES */
    .section-header {
      background-color: #F1F5F9;
      border-left: 4px solid #1E3A8A;
      padding: 5px 10px;
      font-size: 9.5pt;
      font-weight: 800;
      color: #1E3A8A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    .clause-p {
      font-size: 10pt;
      color: #334155;
      text-align: justify;
      margin: 0 0 8px 0;
    }
    /* TABLA INTERVINIENTES */
    .participants-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9.5pt;
    }
    .participants-table th {
      background-color: #EFF6FF;
      color: #1E3A8A;
      border: 1px solid #BFDBFE;
      padding: 6px 8px;
      text-align: left;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .participants-table td {
      border: 1px solid #CBD5E1;
      padding: 6px 8px;
    }
    .td-num {
      width: 8%;
      text-align: center;
      font-weight: 700;
      color: #475569;
    }
    .td-role {
      width: 30%;
    }
    .td-name {
      width: 46%;
      font-weight: 700;
      color: #0F172A;
    }
    .td-status {
      width: 16%;
      text-align: center;
      font-size: 8.5pt;
      color: #15803D;
      font-weight: 700;
    }
    .role-pill {
      display: inline-block;
      background-color: #F1F5F9;
      border: 1px solid #CBD5E1;
      color: #1E293B;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 8.5pt;
      font-weight: 700;
    }
    /* CUERPO DEL ACTA */
    .content-box {
      border: 1px solid #CBD5E1;
      background-color: #FAFAFA;
      border-radius: 4px;
      padding: 12px 14px;
      min-height: 120px;
      margin-bottom: 14px;
    }
    .content-p {
      margin: 0 0 8px 0;
      text-align: justify;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #0F172A;
    }
    .content-p:last-child {
      margin-bottom: 0;
    }
    /* GRILLA DE FIRMAS */
    .signatures-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 10px;
      margin-bottom: 14px;
    }
    .sig-box {
      width: calc(50% - 6px);
      border: 1px dashed #64748B;
      border-radius: 4px;
      padding: 10px 12px;
      background-color: #FFFFFF;
      page-break-inside: avoid;
    }
    .sig-space {
      height: 52px;
    }
    .sig-line {
      border-top: 1px solid #334155;
      padding-top: 4px;
      text-align: center;
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.4px;
      margin-bottom: 6px;
    }
    .sig-meta {
      font-size: 8.5pt;
      color: #1E293B;
      line-height: 1.45;
    }
    /* CERTIFICACION DIRECTIVA Y SELLO */
    .authority-footer-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      page-break-inside: avoid;
    }
    .authority-footer-table td {
      width: 50%;
      border: 1px solid #94A3B8;
      background-color: #F8FAFC;
      padding: 10px 14px;
      vertical-align: bottom;
    }
    .auth-sig-space {
      height: 55px;
    }
    .auth-sig-line {
      border-top: 1.5px solid #1E3A8A;
      padding-top: 5px;
      text-align: center;
      font-size: 8.5pt;
      font-weight: 800;
      color: #1E3A8A;
      text-transform: uppercase;
    }
    .auth-sig-sub {
      text-align: center;
      font-size: 8.5pt;
      color: #334155;
      margin-top: 2px;
    }
    .footer-note {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      font-size: 7.5pt;
      color: #64748B;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="document-border">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="inst-badge">Documento Institucional Oficial</div>
          <div class="inst-name">${instName}</div>
          <p class="inst-sub">
            ${instAddress ? `Dirección: ${instAddress}` : 'Gabinete de Convivencia y Orientación Escolar'}
            ${instCode ? ` · Código/CUE: ${instCode}` : ''}
          </p>
        </td>
        <td class="header-right">
          <div class="folio-box">
            <div class="folio-label">Acta Folio Digital</div>
            <div class="folio-value">N° ${folioCode}</div>
          </div>
        </td>
      </tr>
    </table>

    <div class="law-banner">
      <div class="law-banner-title">Acta de Actuación Institucional de Convivencia Escolar</div>
      <div class="law-banner-sub">Labrada conforme al Protocolo de Intervención Institucional — Ley Nacional N° 26.892</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">Expediente Vinculado</td>
        <td class="meta-value" colspan="3">${caseTitle}</td>
      </tr>
      <tr>
        <td class="meta-label">Modalidad de Acta</td>
        <td class="meta-value">${actTypeLabel}</td>
        <td class="meta-label">Fecha y Hora</td>
        <td class="meta-value">${occurredDate}</td>
      </tr>
      <tr>
        <td class="meta-label">Asunto / Motivo</td>
        <td class="meta-value">${actTitle}</td>
        <td class="meta-label">Autoridad Actuante</td>
        <td class="meta-value">${creatorName} (${creatorPosition})</td>
      </tr>
    </table>

    <div class="section-header">I. Comparecientes y Personas Intervinientes</div>
    <p class="clause-p">
      En las instalaciones del establecimiento educativo <strong>${instName}</strong>, a los <strong>${occurredDate}</strong>, ante la autoridad escolar actuante comparecen las personas que se consignan a continuación a fin de celebrar la presente actuación institucional:
    </p>

    <table class="participants-table">
      <thead>
        <tr>
          <th style="text-align: center;">N°</th>
          <th>Carácter / Rol</th>
          <th>Nombre y Apellido</th>
          <th style="text-align: center;">Condición</th>
        </tr>
      </thead>
      <tbody>
        ${participantsRowsHtml}
      </tbody>
    </table>

    <div class="section-header">II. Desarrollo de la Actuación, Exposición y Acuerdos</div>
    <div class="content-box">
      ${formattedContentParagraphs}
    </div>

    <div class="section-header">III. Lectura, Ratificación y Firmas Ológrafas de Conformidad</div>
    <p class="clause-p">
      No siendo para más, previa lectura en voz alta y ratificación íntegra del contenido expuesto en la presente acta, firman al pie en prueba de conformidad los comparecientes junto a la autoridad educativa interviniente, quedando archivado el ejemplar original en el legajo institucional del caso.
    </p>

    <div class="signatures-grid">
      ${signatureCardsHtml}
    </div>

    <table class="authority-footer-table">
      <tr>
        <td>
          <div class="auth-sig-space"></div>
          <div class="auth-sig-line">Firma de la Autoridad Escolar Actuante</div>
          <div class="auth-sig-sub"><strong>${creatorName}</strong> · ${creatorPosition}</div>
        </td>
        <td>
          <div class="auth-sig-space"></div>
          <div class="auth-sig-line">Sello Oficial del Establecimiento Educativo</div>
          <div class="auth-sig-sub">${instName}</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      <span>Documento confidencial amparado por la normativa de protección integral de niños, niñas y adolescentes.</span>
      <span>Registro Digital Centinel: ${createdDate}</span>
    </div>
  </div>
</body>
</html>`;
}

function buildCaseDossierHtml(params: {
  caseItem: Case;
  institution?: Institution | null;
  profile?: Profile | null;
  statusLabel: string;
}): string {
  const { caseItem, institution, profile, statusLabel } = params;
  const instName = escapeHtml(institution?.name || 'ESTABLECIMIENTO EDUCATIVO');
  const instAddress = institution?.address ? escapeHtml(institution.address) : '';
  const caseTitle = escapeHtml(caseItem.title);
  const caseFolio = escapeHtml(caseItem.id.slice(0, 8).toUpperCase());
  const openedDate = escapeHtml(formatFormalDateTime(caseItem.created_at));
  const authorityName = profile
    ? escapeHtml(`${profile.first_name} ${profile.last_name}`)
    : 'Autoridad Escolar';
  const authorityRole = escapeHtml(profile?.position || 'Equipo Directivo');

  const involvedStudents = caseItem.involved_students || [];
  const actsList = caseItem.acts || [];

  const studentsRowsHtml =
    involvedStudents.length > 0
      ? involvedStudents
          .map(
            (s, idx) => `
            <tr>
              <td style="text-align:center;font-weight:700;">${idx + 1}</td>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td><span class="role-pill">${escapeHtml(s.role)}</span></td>
              <td>${escapeHtml(s.course || 'No especificado')}</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="text-align:center;color:#64748B;">Sin estudiantes adicionales registrados en la nómina del caso.</td></tr>`;

  const actsHtml =
    actsList.length > 0
      ? actsList
          .map(
            (a, idx) => `
            <div class="act-block">
              <div class="act-block-header">
                <span class="act-index">Actuación #${idx + 1} — ${escapeHtml(getActTypeLabel(a.act_type, a.title))}</span>
                <span class="act-date">${escapeHtml(formatFormalDateTime(a.occurred_at))}</span>
              </div>
              <div class="act-title">${escapeHtml(a.title)}</div>
              <div class="act-participants"><strong>Intervinientes:</strong> ${escapeHtml(a.participants)}</div>
              <div class="act-body">${escapeHtml(a.content).replace(/\n/g, '<br/>')}</div>
            </div>`
          )
          .join('')
      : `<p class="clause-p" style="color:#64748B;">Aún no se han labrado actuaciones institucionales en este expediente.</p>`;

  const resolutionHtml =
    caseItem.status === 'resolved' && caseItem.resolution_summary
      ? `
      <div class="section-header">IV. Resolución Institucional y Acuerdos de Convivencia</div>
      <div class="resolution-box">
        <div style="font-size:9pt;font-weight:700;color:#15803D;margin-bottom:4px;text-transform:uppercase;">
          Caso Resuelto el ${escapeHtml(formatFormalDateTime(caseItem.updated_at))}
        </div>
        <div style="font-size:10.5pt;color:#0F172A;line-height:1.5;">
          ${escapeHtml(caseItem.resolution_summary).replace(/\n/g, '<br/>')}
        </div>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Expediente Institucional - ${caseTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 16mm 18mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 0;
      font-size: 10.5pt;
      line-height: 1.45;
      background-color: #FFFFFF;
    }
    .document-border {
      border: 1.5px solid #1E3A8A;
      padding: 18px 22px 22px 22px;
      border-radius: 4px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #1E3A8A;
      margin-bottom: 14px;
    }
    .header-left { width: 68%; vertical-align: top; padding-bottom: 10px; }
    .header-right { width: 32%; vertical-align: top; text-align: right; padding-bottom: 10px; }
    .inst-badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      color: #1E3A8A;
      background-color: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 3px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .inst-name { font-size: 14.5pt; font-weight: 800; color: #0F172A; text-transform: uppercase; margin: 2px 0; }
    .inst-sub { font-size: 9pt; color: #475569; margin: 0; }
    .folio-box {
      display: inline-block;
      border: 1px solid #CBD5E1;
      background-color: #F8FAFC;
      border-radius: 4px;
      padding: 6px 10px;
      text-align: right;
    }
    .folio-label { font-size: 7.5pt; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .folio-value { font-size: 10.5pt; font-weight: 800; color: #1E3A8A; }
    .law-banner {
      background-color: #1E3A8A;
      color: #FFFFFF;
      text-align: center;
      padding: 7px 12px;
      border-radius: 4px;
      margin-bottom: 14px;
    }
    .law-banner-title { font-size: 11.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; }
    .law-banner-sub { font-size: 8pt; color: #DBEAFE; margin-top: 2px; }
    .meta-table, .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9.5pt;
    }
    .meta-table td, .data-table td, .data-table th {
      border: 1px solid #CBD5E1;
      padding: 6px 9px;
      vertical-align: top;
    }
    .data-table th {
      background-color: #EFF6FF;
      color: #1E3A8A;
      font-size: 8.5pt;
      text-transform: uppercase;
      text-align: left;
    }
    .meta-label {
      background-color: #F1F5F9;
      font-weight: 700;
      color: #334155;
      width: 24%;
      text-transform: uppercase;
      font-size: 8pt;
    }
    .meta-value { font-weight: 600; color: #0F172A; width: 26%; }
    .section-header {
      background-color: #F1F5F9;
      border-left: 4px solid #1E3A8A;
      padding: 5px 10px;
      font-size: 9.5pt;
      font-weight: 800;
      color: #1E3A8A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    .role-pill {
      display: inline-block;
      background-color: #F1F5F9;
      border: 1px solid #CBD5E1;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 8.5pt;
      font-weight: 700;
    }
    .act-block {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background-color: #FAFAFA;
      page-break-inside: avoid;
    }
    .act-block-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    .act-index { font-weight: 800; color: #1E3A8A; text-transform: uppercase; }
    .act-date { color: #64748B; font-weight: 600; }
    .act-title { font-size: 10.5pt; font-weight: 800; color: #0F172A; margin-bottom: 4px; }
    .act-participants { font-size: 9pt; color: #334155; margin-bottom: 6px; }
    .act-body { font-size: 9.8pt; color: #1E293B; line-height: 1.5; text-align: justify; }
    .resolution-box {
      border: 1.5px solid #86EFAC;
      background-color: #F0FDF4;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .authority-footer-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .authority-footer-table td {
      width: 50%;
      border: 1px solid #94A3B8;
      background-color: #F8FAFC;
      padding: 10px 14px;
      vertical-align: bottom;
    }
    .auth-sig-space { height: 55px; }
    .auth-sig-line {
      border-top: 1.5px solid #1E3A8A;
      padding-top: 5px;
      text-align: center;
      font-size: 8.5pt;
      font-weight: 800;
      color: #1E3A8A;
      text-transform: uppercase;
    }
    .auth-sig-sub { text-align: center; font-size: 8.5pt; color: #334155; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="document-border">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="inst-badge">Expediente Oficial de Convivencia</div>
          <div class="inst-name">${instName}</div>
          <p class="inst-sub">${instAddress || 'Dirección y Equipo de Convivencia Escolar'}</p>
        </td>
        <td class="header-right">
          <div class="folio-box">
            <div class="folio-label">Expediente N°</div>
            <div class="folio-value">${caseFolio}</div>
          </div>
        </td>
      </tr>
    </table>

    <div class="law-banner">
      <div class="law-banner-title">Expediente Institucional de Convivencia Escolar</div>
      <div class="law-banner-sub">Compendio de Reporte de Origen, Intervinientes y Actuaciones — Ley Nacional N° 26.892</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">Carátula del Caso</td>
        <td class="meta-value" colspan="3">${caseTitle}</td>
      </tr>
      <tr>
        <td class="meta-label">Estado Actual</td>
        <td class="meta-value">${escapeHtml(statusLabel)}</td>
        <td class="meta-label">Fecha de Apertura</td>
        <td class="meta-value">${openedDate}</td>
      </tr>
    </table>

    <div class="section-header">I. Datos del Reporte de Origen</div>
    <table class="meta-table">
      <tr>
        <td class="meta-label">Tipo de Situación</td>
        <td class="meta-value">${escapeHtml(caseItem.report?.situation_type || 'No especificada')}</td>
        <td class="meta-label">Lugar del Hecho</td>
        <td class="meta-value">${escapeHtml(caseItem.report?.location || 'No especificado')}</td>
      </tr>
      <tr>
        <td class="meta-label">Frecuencia</td>
        <td class="meta-value" colspan="3">${escapeHtml(caseItem.report?.frequency || 'No especificada')}</td>
      </tr>
      <tr>
        <td class="meta-label">Relato Inicial</td>
        <td class="meta-value" colspan="3" style="font-weight:400;text-align:justify;">
          ${escapeHtml(caseItem.report?.description || 'Sin descripción registrada.').replace(/\n/g, '<br/>')}
        </td>
      </tr>
    </table>

    <div class="section-header">II. Nómina de Estudiantes Involucrados (${involvedStudents.length})</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:8%;text-align:center;">N°</th>
          <th style="width:42%;">Estudiante</th>
          <th style="width:28%;">Rol en el Caso</th>
          <th style="width:22%;">Curso / División</th>
        </tr>
      </thead>
      <tbody>
        ${studentsRowsHtml}
      </tbody>
    </table>

    <div class="section-header">III. Historial de Actuaciones Institucionales Labradas (${actsList.length})</div>
    ${actsHtml}

    ${resolutionHtml}

    <table class="authority-footer-table">
      <tr>
        <td>
          <div class="auth-sig-space"></div>
          <div class="auth-sig-line">Firma y Certificación Directiva</div>
          <div class="auth-sig-sub"><strong>${authorityName}</strong> · ${authorityRole}</div>
        </td>
        <td>
          <div class="auth-sig-space"></div>
          <div class="auth-sig-line">Sello Oficial del Establecimiento Educativo</div>
          <div class="auth-sig-sub">${instName}</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

async function generateAndSharePdfHtml(html: string, baseFileName: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  let finalUri = uri;
  try {
    const cleanName = `${sanitizeFileName(baseFileName) || 'Documento_Centinel'}.pdf`;
    const sourceFile = new File(uri);
    const targetFile = new File(Paths.cache, cleanName);
    if (targetFile.exists) {
      targetFile.delete();
    }
    sourceFile.moveSync(targetFile);
    finalUri = targetFile.uri;
  } catch {
    finalUri = uri;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ html });
  }
}

export async function shareActAsPdf(params: {
  act: CaseAct;
  caseItem?: Case | null;
  institution?: Institution | null;
}): Promise<void> {
  const html = buildActHtml(params);
  const fileName = `Acta_Institucional_${params.act.title || 'Convivencia'}`;
  await generateAndSharePdfHtml(
    html,
    fileName,
    `Compartir Acta Institucional (PDF) - ${params.act.title}`
  );
}

export async function printActDirectly(params: {
  act: CaseAct;
  caseItem?: Case | null;
  institution?: Institution | null;
}): Promise<void> {
  const html = buildActHtml(params);
  await Print.printAsync({ html });
}

export async function shareCaseDossierAsPdf(params: {
  caseItem: Case;
  institution?: Institution | null;
  profile?: Profile | null;
  statusLabel: string;
}): Promise<void> {
  const html = buildCaseDossierHtml(params);
  const fileName = `Expediente_${params.caseItem.title || 'Convivencia'}`;
  await generateAndSharePdfHtml(
    html,
    fileName,
    `Exportar Expediente Institucional (PDF) - ${params.caseItem.title}`
  );
}
