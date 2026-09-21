export type Plan = 'monthly' | 'yearly';
export type Role = 'visitor' | 'subscriber' | 'admin';
export type DrawMode = 'random' | 'algorithmic';
export type DrawStatus = 'simulation' | 'published';
export type ProofStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Charity { id: string; name: string; category: string; description: string; impact: string; image: string; featured?: boolean; }
export interface Score { id: string; date: string; value: number; }
export interface User { id: string; name: string; email: string; role: Role; plan: Plan; active: boolean; renewalDate: string; charityId: string; contributionPercent: number; scores: Score[]; winnings: number; }
export interface Draw { id: string; month: string; numbers: number[]; mode: DrawMode; status: DrawStatus; pool: number; winners: { tier: 3 | 4 | 5; count: number; share: number }[]; }
export interface AppState { user: User | null; charities: Charity[]; draws: Draw[]; notice: string | null; }

export const charities: Charity[] = [
  { id: 'clean-water', name: 'Water for All', category: 'Clean water', description: 'We fund durable water systems and local training so families can spend less time searching for water and more time building a future.', impact: '£18 provides safe water for one person for a year.', image: 'https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=1000&q=80', featured: true },
  { id: 'youth-sport', name: 'Open Field Futures', category: 'Youth & community', description: 'Opening safe spaces and coaching to young people who deserve more places to belong, move and lead.', impact: '£25 funds a month of coaching for a young person.', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=80', featured: true },
  { id: 'climate', name: 'Rewild Together', category: 'Climate', description: 'Restoring local habitats with communities, one native tree and one living river at a time.', impact: '£12 protects 10 square metres of habitat.', image: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1000&q=80' }
];

export const initialState: AppState = { user: null, charities, draws: [{ id: 'draw-sept', month: 'September 2026', numbers: [4, 11, 19, 27, 36], mode: 'random', status: 'published', pool: 12480, winners: [{ tier: 5, count: 0, share: 4992 }, { tier: 4, count: 3, share: 1456 }, { tier: 3, count: 18, share: 173 }] }], notice: null };

export function contributionAmount(plan: Plan, percentage: number): number { const fee = plan === 'monthly' ? 12 : 120; return Math.round(fee * percentage) / 100; }
export function validateScore(value: number, date: string, scores: Score[], editingId?: string): string | null { if (!date) return 'Choose the date you played.'; if (!Number.isInteger(value) || value < 1 || value > 45) return 'Stableford scores must be a whole number from 1 to 45.'; if (scores.some(score => score.date === date && score.id !== editingId)) return 'You already have a score for that date.'; return null; }
export function saveScore(scores: Score[], score: Score): Score[] { return [score, ...scores.filter(item => item.id !== score.id)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5); }
export function generateNumbers(mode: DrawMode, scores: Score[], random = Math.random): number[] { const weighted = scores.length ? scores.map(score => Math.max(1, Math.min(45, score.value))) : []; const numbers: number[] = []; let attempts = 0; while (numbers.length < 5 && attempts < 100) { const candidate = mode === 'algorithmic' && weighted.length ? weighted[Math.floor(random() * weighted.length)] : Math.floor(random() * 45) + 1; if (!numbers.includes(candidate)) numbers.push(candidate); attempts += 1; } for (let candidate = 1; numbers.length < 5; candidate += 1) if (!numbers.includes(candidate)) numbers.push(candidate); return numbers.sort((a, b) => a - b); }
export function matchCount(ticket: number[], numbers: number[]): number { return ticket.filter(number => numbers.includes(number)).length; }
export function calculatePrizes(pool: number, winnerCounts: { tier: 3 | 4 | 5; count: number }[], rollover = 0) { const allocation: Record<3 | 4 | 5, number> = { 3: pool * .25, 4: pool * .35, 5: pool * .4 + rollover }; return ([3, 4, 5] as const).map(tier => ({ tier, total: winnerCounts.find(item => item.tier === tier)?.count ? allocation[tier] : tier === 5 ? allocation[tier] : 0, each: (winnerCounts.find(item => item.tier === tier)?.count || 0) ? allocation[tier] / (winnerCounts.find(item => item.tier === tier)?.count || 1) : 0 })); }
