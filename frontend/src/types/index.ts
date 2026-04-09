export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role_id: number;
  role_name: string;
  role_display_name: string;
  permissions: Record<string, unknown>;
  constituency_id: number | null;
  area_id: number | null;
  ward_id: number | null;
  booth_id: number | null;
  organization_id: number;
  organization_name?: string;
  avatar_url: string | null;
  status: string;
  last_login: string | null;
  created_at: string;
  constituency_name?: string;
  area_name?: string;
  ward_name?: string;
  booth_name?: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  state: string;
  district: string;
  contact_email: string;
  contact_phone: string;
  plan: 'basic' | 'pro' | 'enterprise';
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  permissions: Record<string, unknown>;
  description: string;
}

// ─── Constituency Structure ───
export interface State {
  id: number;
  name: string;
  code: string;
  district_count?: number;
  constituency_count?: number;
}

export interface District {
  id: number;
  name: string;
  state_id: number;
  state_name?: string;
}

export interface Constituency {
  id: number;
  name: string;
  number: string;
  district_id: number;
  mla_name: string;
  total_voters: number;
  district_name?: string;
  state_name?: string;
}

export interface Area {
  id: number;
  name: string;
  constituency_id: number;
  manager_id: number | null;
  total_voters: number;
  constituency_name?: string;
  manager_name?: string;
}

export interface Ward {
  id: number;
  name: string;
  number: string;
  constituency_id: number;
  area_id: number | null;
  ward_head_id: number | null;
  total_voters: number;
  constituency_name?: string;
  area_name?: string;
  ward_head_name?: string;
}

export interface Booth {
  id: number;
  name: string;
  number: string;
  ward_id: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_voters: number;
  ward_name?: string;
  constituency_name?: string;
}

// ─── Voter ───
export interface Voter {
  id: number;
  voter_id_number: string;
  name: string;
  phone: string;
  address: string;
  age: number;
  gender: string;
  booth_id: number | null;
  ward_id: number | null;
  constituency_id: number | null;
  caste: string;
  scheme_beneficiary: boolean;
  scheme_details: string;
  support_status: 'supporter' | 'neutral' | 'opponent' | 'unknown';
  remarks: string;
  booth_name?: string;
  ward_name?: string;
  area_name?: string;
  constituency_name?: string;
  created_by_name?: string;
  created_at: string;
}

// ─── Survey ───
export interface SurveyIssue {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface Survey {
  id: number;
  voter_id: number | null;
  booth_id: number | null;
  ward_id: number | null;
  surveyor_id: number;
  support_status: string;
  satisfaction_level: number | null;
  remarks: string;
  voter_name?: string;
  voter_phone?: string;
  surveyor_name?: string;
  booth_name?: string;
  ward_name?: string;
  area_name?: string;
  issues?: Array<{ issue_id: number; issue_name: string; severity: number; notes: string }>;
  created_at: string;
}

// ─── Task ───
export interface Task {
  id: number;
  title: string;
  description: string;
  type: string;
  assigned_to: number | null;
  assigned_by: number;
  booth_id: number | null;
  ward_id: number | null;
  constituency_id: number | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string;
  completed_at: string | null;
  remarks: string;
  assigned_to_name?: string;
  assigned_by_name?: string;
  constituency_name?: string;
  area_name?: string;
  ward_name?: string;
  booth_name?: string;
  created_at: string;
}

// ─── Event ───
export interface AppEvent {
  id: number;
  title: string;
  type: string;
  description: string;
  event_date: string;
  location: string;
  constituency_id: number | null;
  ward_id: number | null;
  expected_attendance: number;
  actual_attendance: number;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  constituency_name?: string;
  area_name?: string;
  ward_name?: string;
  created_by_name?: string;
  participant_count?: number;
  attended_count?: number;
  created_at: string;
}

export interface WorkAllocation {
  id: number;
  event_id: number;
  work_type: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'not_completed';
  not_completed_reason?: string;
  due_date: string;
  started_at?: string;
  completed_at?: string;
  before_image_url?: string;
  after_image_url?: string;
  geo_location_before?: { lat: number; lng: number };
  geo_location_after?: { lat: number; lng: number };
  event_title?: string;
  event_date?: string;
  event_location?: string;
  created_by_name?: string;
  assigned_users: Array<{ id: number; name: string }>;
  created_at: string;
}

// ─── Team Member ───
export interface TeamMember {
  id: number;
  user_id: number;
  team_leader_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  booth_id: number | null;
  designation: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  role_name?: string;
  leader_name?: string;
  constituency_name?: string;
  area_name?: string;
  ward_name?: string;
  booth_name?: string;
  joined_at: string;
}

// ─── Messages ───
export interface Message {
  id: number;
  title: string;
  content: string;
  sent_by: number;
  target_type: string;
  target_id: number | null;
  channel: string;
  status: string;
  sender_name?: string;
  recipient_count?: number;
  read_count?: number;
  created_at: string;
}

// ─── API Response ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Dashboard ───
export interface DashboardStats {
  stats: {
    total_users: number;
    total_voters: number;
    total_surveys: number;
    total_tasks: number;
    total_events: number;
    active_workers: number;
    
    // MLA specific
    booth_strength?: {
      strong_booths: number;
      competitive_booths: number;
      weak_booths: number;
    };
    top_issues?: Array<{ name: string; count: string }>;
    
    // Worker specific
    my_completed_tasks?: number;
    my_pending_tasks?: number;
    total_surveys_submitted?: number;
    surveys_today?: number;
  };
  charts: {
    support_stats: Array<{ support_status: string; count: string }>;
    survey_trend: Array<{ date: string; count: string }>;
    worker_performance?: Array<{ name: string; surveys_count: string; tasks_completed: string }>;
  };
  lists: {
    recent_activity: Array<{
      id: number;
      user_name: string;
      action: string;
      module: string;
      created_at: string;
    }>;
    upcoming_events: AppEvent[];
    top_performers: Array<{ name: string; surveys_count: string; tasks_completed: string }>;
    // New Role Specific Lists
    booth_progress?: Array<{ id: number; name: string; voter_count: number; survey_count: number; coverage: string }>;
    tasks?: Task[];
  };
}
