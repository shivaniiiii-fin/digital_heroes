export type Plan = 'monthly' | 'yearly';
export type Role = 'visitor' | 'subscriber' | 'admin';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive';
export type DrawMode = 'random' | 'algorithmic';
export type DrawStatus = 'simulation' | 'published';
export type ProofStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type DonationSource = 'subscription' | 'independent';

export interface Score {
  id: string;
  userId?: string;
  date: string; // ISO format: YYYY-MM-DD
  value: number; // Stableford points: 1 - 45
  createdAt?: string;
}

export interface CharityEvent {
  id: string;
  charityId: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
}

export interface Charity {
  id: string;
  name: string;
  category: string;
  description: string;
  impact: string;
  image: string;
  websiteUrl?: string;
  featured?: boolean;
  events?: CharityEvent[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  plan: Plan;
  status: SubscriptionStatus;
  renewalDate: string;
  charityId: string;
  contributionPercent: number; // 10 to 100
  scores: Score[];
  winnings: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface DrawWinner {
  id: string;
  userId: string;
  userName: string;
  tier: 3 | 4 | 5;
  matches: number;
  share: number;
  proofStatus: ProofStatus;
  proofUrl?: string;
  adminNotes?: string;
}

export interface PrizeTierResult {
  tier: 3 | 4 | 5;
  percentage: number; // 40, 35, or 25
  totalPoolAllocated: number;
  winnerCount: number;
  sharePerWinner: number;
}

export interface Draw {
  id: string;
  month: string; // e.g. "September 2026" or "2026-09"
  numbers: number[]; // 5 sorted unique numbers (1-45)
  mode: DrawMode;
  status: DrawStatus;
  prizePool: number;
  jackpotRollover: number;
  nextJackpotRollover?: number;
  tierAllocations: PrizeTierResult[];
  winners: DrawWinner[];
  eligibleParticipantsCount: number;
  publishedAt?: string;
  createdAt: string;
}

export interface WinnerProofSubmission {
  id: string;
  winnerId: string;
  userId: string;
  drawId: string;
  tier: 3 | 4 | 5;
  prizeAmount: number;
  storagePath: string;
  filePreviewUrl?: string;
  status: ProofStatus;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
}

export interface PayoutRecord {
  id: string;
  winnerId: string;
  userId: string;
  userName: string;
  drawMonth: string;
  tier: 3 | 4 | 5;
  amount: number;
  status: ProofStatus;
  paidAt?: string;
  notes?: string;
}

export interface DonationRecord {
  id: string;
  userId?: string;
  charityId: string;
  charityName: string;
  amount: number;
  source: DonationSource;
  date: string;
}
