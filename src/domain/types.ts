export const SEED_VERSION = 1;

export type Role = 'owner' | 'dispatcher' | 'technician';
export type JobStatus = 'scheduled' | 'en_route' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type MemberStatus = 'available' | 'en_route' | 'on_job' | 'paused' | 'offline';
export type Priority = 'routine' | 'urgent';
export type InvoiceStatus = 'unbilled' | 'invoiced' | 'paid';
export type PaymentMethod = 'card' | 'cash' | 'invoice';
export type PaymentStatus = 'succeeded' | 'invoiced';
export type JobAction = 'start_travel' | 'start' | 'pause' | 'resume' | 'complete';
export type DemoPersona = 'alex' | 'jordan';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  trade: 'hvac';
  city: string;
  region: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string;
}

export interface ServiceLocation {
  id: string;
  organizationId: string;
  customerId: string;
  label: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface Job {
  id: string;
  organizationId: string;
  customerId: string;
  locationId: string;
  assignedMemberId: string | null;
  title: string;
  summary: string;
  service: string;
  priority: Priority;
  status: JobStatus;
  scheduledStart: string;
  scheduledEnd: string;
  routePosition: number | null;
  amountCents: number;
  currency: 'usd';
  invoiceStatus: InvoiceStatus;
  travelStartedAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  organizationId: string;
  jobId: string;
  label: string;
  required: boolean;
  completed: boolean;
  position: number;
  completedAt: string | null;
}

export interface JobNote {
  id: string;
  organizationId: string;
  jobId: string;
  authorMemberId: string;
  body: string;
  createdAt: string;
}

export interface JobPhoto {
  id: string;
  organizationId: string;
  jobId: string;
  authorMemberId: string;
  uri: string;
  caption: string;
  createdAt: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
}

export interface JobSignature {
  id: string;
  organizationId: string;
  jobId: string;
  signerName: string;
  strokes: Stroke[];
  signedAt: string;
}

export interface Payment {
  id: string;
  organizationId: string;
  jobId: string;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  organizationId: string;
  recipientUserId: string;
  title: string;
  body: string;
  jobId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: string;
  createdAt: string;
}

export interface MagicLink {
  token: string;
  email: string;
  createdAt: string;
}

export interface Database {
  version: number;
  organizations: Organization[];
  users: User[];
  members: Member[];
  customers: Customer[];
  locations: ServiceLocation[];
  jobs: Job[];
  checklistItems: ChecklistItem[];
  notes: JobNote[];
  photos: JobPhoto[];
  signatures: JobSignature[];
  payments: Payment[];
  notifications: AppNotification[];
  pushTokens: PushToken[];
  magicLinks: MagicLink[];
}

export interface Actor {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  organizationId: string;
  organizationName: string;
  memberId: string;
  role: Role;
}

export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  organizationCity: string;
  role: Role;
  memberId: string;
}

export interface JobSummary {
  id: string;
  title: string;
  summary: string;
  service: string;
  priority: Priority;
  status: JobStatus;
  scheduledStart: string;
  scheduledEnd: string;
  routePosition: number | null;
  amountCents: number;
  currency: 'usd';
  invoiceStatus: InvoiceStatus;
  customerName: string;
  customerPhone: string;
  addressLine: string;
  locality: string;
  assignedMemberId: string | null;
  assigneeName: string | null;
}

export interface RouteStop extends JobSummary {
  lat: number;
  lng: number;
  distanceFromPreviousMiles: number | null;
}

export interface NoteView extends JobNote {
  authorName: string;
}

export interface JobDetail extends JobSummary {
  customerEmail: string;
  locationLabel: string;
  line1: string;
  region: string;
  postalCode: string;
  lat: number;
  lng: number;
  checklist: ChecklistItem[];
  notes: NoteView[];
  photos: JobPhoto[];
  signature: JobSignature | null;
  payments: Payment[];
  travelStartedAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
}

export interface TechnicianCard {
  memberId: string;
  userId: string;
  fullName: string;
  status: MemberStatus;
  phone: string;
  activeJobTitle: string | null;
  activeJobId: string | null;
  remainingStops: number;
}

export interface DispatchBoard {
  technicians: TechnicianCard[];
  unassigned: JobSummary[];
}

export interface PhotoInput {
  uri: string;
  caption?: string;
}

export interface SignatureInput {
  signerName: string;
  strokes: Stroke[];
}

export interface PaymentInput {
  method: 'card' | 'cash';
  amountCents: number;
}
