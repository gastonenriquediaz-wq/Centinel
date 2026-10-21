export type UserRole = 'student' | 'authority';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'inactive';

export interface Institution {
  id: string;
  name: string;
  address: string | null;
  identification_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  institution_id: string;
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

export interface UserSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  institution?: Institution;
}
