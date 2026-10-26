export type UserRole = 'student' | 'authority';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'inactive';

export type ShiftType = 'Mañana' | 'Tarde' | 'Noche' | 'Jornada Completa';

export type ReportStatus = 'sent' | 'in_progress' | 'closed_no_case' | 'finalized';

export type AttachmentType = 'image' | 'video';

export interface Institution {
  id: string;
  name: string;
  address: string | null;
  identification_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  institution_id: string;
  year: number;
  division: string;
  shift: ShiftType;
  school_year: number;
  estimated_students: number;
  created_at: string;
  updated_at: string;
}

export interface QRCode {
  id: string;
  course_id: string;
  institution_id: string;
  created_by: string;
  code_token: string;
  expires_at: string;
  created_at: string;
}

export interface QRValidationResult {
  valid: boolean;
  error?: string;
  course_id?: string;
  institution_id?: string;
  institution_name?: string;
  course_name?: string;
  school_year?: number;
  expires_at?: string;
}

export interface Profile {
  id: string;
  institution_id: string;
  course_id: string | null;
  role: UserRole;
  first_name: string;
  last_name: string;
  dni: string | null;
  birth_date: string | null;
  position: 'Director' | 'Vicedirector' | null;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  institution_id: string;
  course_id: string | null;
  student_id: string;
  situation_type: string;
  location: string;
  occurred_at: string;
  frequency: string;
  involved_persons: string;
  description: string;
  status: ReportStatus;
  close_reason: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionales
  student?: Profile;
  course?: Course;
  attachments?: ReportAttachment[];
}

export interface ReportAttachment {
  id: string;
  report_id: string;
  storage_path: string;
  file_type: AttachmentType;
  file_size_bytes: number;
  original_name: string;
  created_at: string;
  public_url?: string;
}

export interface AuditLog {
  id: string;
  institution_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  details: any;
  created_at: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  institution?: Institution;
  course?: Course;
}
