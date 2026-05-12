export type UserRole = "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  class_id?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Class {
  id: string;
  class_name: string;
  major: string;
  grade: string;
  created_at: string;
  student_count?: number;
}

export interface Material {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  topic?: string;
  meeting?: number;
  file_url?: string;
  file_type?: string;
  created_at: string;
  class?: Class;
}

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  deadline: string;
  attachment_url?: string;
  created_at: string;
  class?: Class;
  submission_count?: number;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url?: string;
  score?: number;
  feedback?: string;
  submitted_at: string;
  assignment?: Assignment;
  student?: User;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  timestamp: string;
  student?: User;
  class?: Class;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  time_limit?: number;
  created_at: string;
  class?: Class;
  question_count?: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "a" | "b" | "c" | "d";
  order_number?: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  score?: number;
  completed_at?: string;
  started_at: string;
}

export interface Grade {
  id: string;
  student_id: string;
  class_id: string;
  assignment_id?: string;
  score: number;
  comment?: string;
  created_at: string;
  student?: User;
  assignment?: Assignment;
}

export interface DashboardStats {
  totalStudents?: number;
  totalClasses?: number;
  totalAssignments?: number;
  recentSubmissions?: number;
  activeClasses?: number;
  upcomingAssignments?: number;
  recentGrades?: number;
  attendanceRate?: number;
}
