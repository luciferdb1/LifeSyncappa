export enum BloodGroup {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  O_POS = 'O+',
  O_NEG = 'O-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
}

export interface Donor {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  lastDonationDate: string; // YYYY-MM-DD
  totalDonations: number;
  location: string;
  isAvailable: boolean;
  uid?: string;
  addedBy?: string; // UID of the volunteer who added the donor
  agreedToDonate?: boolean; // If the donor agreed to donate after a call
  convincedByUid?: string; // UID of the editor who convinced them
  convincedByName?: string; // Name of the editor who convinced them
  lastRefusalReason?: string;
  lastRefusalDate?: string; // ISO string
  followUp3DayStatus?: 'pending' | 'completed' | 'failed';
  followUp3DayNextReminder?: string; // ISO string
  followUp7DayStatus?: 'pending' | 'completed' | 'failed';
  followUp7DayNextReminder?: string; // ISO string
}

export interface CallRecord {
  id: string;
  callerUid: string;
  callerName: string;
  donorPhone: string;
  donorName: string;
  audioUrl: string;
  storagePath: string;
  timestamp: string;
  duration: number;
}

export interface UserProfile {
  email: string;
  displayName: string;
  phone?: string;
  photoUrl?: string;
  role: 'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user';
  uid: string;
  points?: number; // Total points
  pointsFromAdding?: number; // 20 points per donor
  pointsFromOwnDonors?: number; // 10 points per donation
  pointsFromOtherDonors?: number; // 5 points per donation
  pointsFromConvinced?: number; // 5 points for convincing via call
  donorsAdded?: number; // Total donors added by this user
}

export interface Request {
  id: string;
  donorId: string;
  donorName: string;
  type: 'edit' | 'delete';
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  userEmail: string;
  userUid: string;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ActivityLog {
  id: string;
  donorId: string;
  donorName?: string;
  action: 'call' | 'update' | 'delete' | 'create';
  userEmail: string;
  userUid: string;
  timestamp: string;
  details?: string;
}

export interface PosterSubmission {
  id?: string;
  posterUrl: string;
  submittedByUid: string;
  submittedByName: string;
  donorName: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}
