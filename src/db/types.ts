export type Role = 'arm_member' | 'intern'

export type EventStatus = 'active' | 'scheduled' | 'ended'

export type LeaderboardPeriod = 'today' | 'week' | 'month' | 'all'

export interface Profile {
  id: number
  student_number: string
  full_name: string
  role: Role
  course: string
  organization: string | null
  created_at: string
}

export interface ProfileWithStats extends Profile {
  project_count: number
  sign_in_count: number
}

export interface Project {
  id: number
  profile_id: number
  title: string
  description: string | null
  created_at: string
}

export interface SignIn {
  id: number
  profile_id: number
  sign_in_date: string
  signed_in_at: string
}

export interface AttendanceEntry extends SignIn {
  full_name: string
  student_number: string
  role: Role
  course: string
}

export interface LeaderboardEntry {
  rank: number
  profile_id: number
  full_name: string
  course: string
  role: Role
  sign_in_count: number
}

export interface EventRecord {
  id: number
  title: string
  description: string | null
  coordinators: string | null
  status: EventStatus
  created_at: string
}

export interface EventWithGuestCount extends EventRecord {
  guest_count: number
}

export interface EventGuest {
  id: number
  event_id: number
  full_name: string
  organization: string | null
  contact: string | null
  checked_in_at: string
}

export interface EventGuestWithEvent extends EventGuest {
  event_title: string
  event_status: EventStatus
}

export interface NewProjectInput {
  title: string
  description?: string | null
}

export interface CreateArmMemberInput {
  role: 'arm_member'
  fullName: string
  studentNumber: string
  course: string
  initialProject: NewProjectInput
}

export interface CreateInternInput {
  role: 'intern'
  fullName: string
  studentNumber: string
  course: string
  organization: string
}

export type CreateProfileInput = CreateArmMemberInput | CreateInternInput

export interface UpdateProfileInput {
  fullName: string
  studentNumber: string
  course: string
  organization?: string | null
}

export interface CreateEventInput {
  title: string
  coordinators?: string | null
  description?: string | null
  status: Exclude<EventStatus, 'ended'>
}

export interface UpdateEventInput {
  title: string
  coordinators?: string | null
  description?: string | null
}

export interface GuestInput {
  fullName: string
  organization?: string | null
  contact?: string | null
}

export type SignInOutcome =
  | { status: 'signed_in'; profile: Profile; signedInAt: string }
  | { status: 'duplicate'; profile: Profile; signedInAt: string }
  | { status: 'not_found'; studentNumber: string }
