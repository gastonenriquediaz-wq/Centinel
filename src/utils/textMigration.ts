import { Report, Case } from '../types/database.types';

/**
 * Mapeo de términos antiguos de situaciones a la nueva redacción simplificada
 */
export function migrateSituationText(text: string | null | undefined): string {
  if (!text) return '';
  let updated = text;

  updated = updated.replace(/Ciberacoso\s*\/\s*Difamación\s*digital/gi, 'Acoso o agresiones por internet');
  updated = updated.replace(/Hostigamiento\s*verbal\s*\/\s*insultos/gi, 'Burlas, insultos o humillaciones');
  updated = updated.replace(/Amenazas\s*o\s*coacción/gi, 'Amenazas o intimidación');
  updated = updated.replace(/Daño\s*a\s*pertenencias\s*materiales/gi, 'Daño o robo de pertenencias');
  updated = updated.replace(/Otro\s*tipo\s*de\s*situación/gi, 'Otra situación');

  // Solo reemplazar 'Agresión física' si no tiene ya '(golpes, empujones)'
  updated = updated.replace(/Agresión\s*física(?!\s*\(golpes,\s*empujones\))/gi, 'Agresión física (golpes, empujones)');

  return updated;
}

/**
 * Mapeo de lugares antiguos a la nueva redacción simplificada
 */
export function migrateLocationText(text: string | null | undefined): string {
  if (!text) return '';
  let updated = text;

  updated = updated.replace(/Patio\s*\/\s*Recreo/gi, 'Patio o recreo');
  updated = updated.replace(/Entrada\s*\/\s*Salidas?\s*del\s*colegio/gi, 'Entrada o salida del colegio');
  updated = updated.replace(/En\s*las\s*inmediaciones\s*del\s*colegio/gi, 'Cerca del colegio');
  updated = updated.replace(/Redes\s*sociales\s*\/\s*Mensajer[ií]a\s*digital/gi, 'Internet, redes sociales o mensajes');

  return updated;
}

/**
 * Mapeo de frecuencias antiguas a la nueva redacción simplificada
 */
export function migrateFrequencyText(text: string | null | undefined): string {
  if (!text) return '';
  let updated = text;

  updated = updated.replace(/Ocurre\s*de\s*forma\s*ocasional/gi, 'Ocurrió varias veces');
  updated = updated.replace(/Ocurre\s*frecuentemente\s*\(semanal\)/gi, 'Ocurre frecuentemente');
  updated = updated.replace(/Ocurre\s*de\s*forma\s*continua\s*\/\s*diaria/gi, 'Ocurre todos o casi todos los días');

  return updated;
}

/**
 * Transforma un reporte para que sus textos utilicen la nueva redacción
 */
export function migrateReport<T extends Report | null | undefined>(report: T): T {
  if (!report) return report;
  return {
    ...report,
    situation_type: migrateSituationText(report.situation_type),
    location: migrateLocationText(report.location),
    frequency: migrateFrequencyText(report.frequency),
  };
}

/**
 * Transforma una lista de reportes
 */
export function migrateReports(reports: Report[]): Report[] {
  return reports.map(migrateReport);
}

/**
 * Transforma un caso y sus reportes vinculados
 */
export function migrateCase<T extends Case | null | undefined>(caseItem: T): T {
  if (!caseItem) return caseItem;
  return {
    ...caseItem,
    title: migrateSituationText(caseItem.title),
    report: caseItem.report ? migrateReport(caseItem.report) : caseItem.report,
    linked_reports: caseItem.linked_reports ? migrateReports(caseItem.linked_reports) : caseItem.linked_reports,
  };
}

/**
 * Transforma una lista de casos
 */
export function migrateCases(cases: Case[]): Case[] {
  return cases.map(migrateCase);
}
