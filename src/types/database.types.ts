export type UserRole = 'student' | 'authority';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'inactive';

export type ShiftType = 'Mañana' | 'Tarde' | 'Noche' | 'Jornada Completa';

export type ReportStatus = 'sent' | 'in_progress' | 'closed_no_case' | 'finalized';

export type CaseStatus = 'open' | 'under_investigation' | 'resolved';

export type ActType =
  | 'interview_student'
  | 'interview_parents'
  | 'mediation'
  | 'psychological_referral'
  | 'disciplinary_measure'
  | 'closure_agreement';

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
  short_code?: string;
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
  // Join opcional
  performer?: Profile;
}

export interface ReportMessage {
  id: string;
  report_id: string;
  sender_id: string;
  sender_role: UserRole;
  content: string;
  read_at: string | null;
  created_at: string;
  // Join opcional
  sender?: Profile;
}

export interface CaseInvolvedStudent {
  id: string;
  name: string;
  role: string;
  course?: string;
  notes?: string;
  source: 'report_reporter' | 'report_aggressor' | 'report_witness' | 'manual';
  addedAt?: string;
}

export interface Case {
  id: string;
  institution_id: string;
  report_id: string;
  created_by: string;
  title: string;
  protocol_level: string;
  status: CaseStatus;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionales
  report?: Report;
  linked_reports?: Report[];
  creator?: Profile;
  acts?: CaseAct[];
  involved_students?: CaseInvolvedStudent[];
}

export interface CaseAct {
  id: string;
  case_id: string;
  institution_id: string;
  created_by: string;
  act_type: ActType;
  title: string;
  participants: string;
  content: string;
  occurred_at: string;
  created_at: string;
  // Joins opcionales
  creator?: Profile;
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
