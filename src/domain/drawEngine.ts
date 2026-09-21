import { DrawMode, DrawWinner, PrizeTierResult, Score, UserProfile } from './types';

export const DRAW_BALL_MIN = 1;
export const DRAW_BALL_MAX = 45;
export const NUMBERS_PER_DRAW = 5;

export const TIER_ALLOCATION_PERCENTAGES: Record<3 | 4 | 5, number> = {
  5: 0.40, // 40%
  4: 0.35, // 35%
  3: 0.25, // 25%
};

/**
 * Generates 5 unique numbers between 1 and 45.
 * - In 'random' mode: uniform random selection.
 * - In 'algorithmic' mode: weighted by score frequency of the active player pool.
 */
export function generateDrawNumbers(
  mode: DrawMode,
  allPlayerScores: Score[] = [],
  randomFn: () => number = Math.random
): number[] {
  const chosen = new Set<number>();

  if (mode === 'algorithmic' && allPlayerScores.length > 0) {
    // Build frequency weight map from valid Stableford scores (1-45)
    const validScores = allPlayerScores
      .map((s) => s.value)
      .filter((v) => v >= DRAW_BALL_MIN && v <= DRAW_BALL_MAX);

    if (validScores.length >= NUMBERS_PER_DRAW) {
      // Create weighted distribution
      const weightedList: number[] = [];
      for (const val of validScores) {
        weightedList.push(val);
      }

      let attempts = 0;
      while (chosen.size < NUMBERS_PER_DRAW && attempts < 300) {
        attempts++;
        const randomIndex = Math.floor(randomFn() * weightedList.length);
        const candidate = weightedList[randomIndex];
        if (candidate >= DRAW_BALL_MIN && candidate <= DRAW_BALL_MAX) {
          chosen.add(candidate);
        }
      }
    }
  }

  // Fill remaining slots uniformly if needed
  let attempts = 0;
  while (chosen.size < NUMBERS_PER_DRAW && attempts < 500) {
    attempts++;
    const candidate = Math.floor(randomFn() * DRAW_BALL_MAX) + DRAW_BALL_MIN;
    chosen.add(candidate);
  }

  // Fallback if random was somehow starved
  if (chosen.size < NUMBERS_PER_DRAW) {
    for (let n = DRAW_BALL_MIN; n <= DRAW_BALL_MAX && chosen.size < NUMBERS_PER_DRAW; n++) {
      chosen.add(n);
    }
  }

  return Array.from(chosen).sort((a, b) => a - b);
}

/**
 * Counts the number of matches between a player's ticket (their scores) and the drawn numbers.
 * Duplicate numbers in ticket are counted as unique matches against the drawn set.
 */
export function calculateMatches(playerTicket: number[], drawnNumbers: number[]): number {
  const drawSet = new Set(drawnNumbers);
  const uniquePlayerNumbers = new Set(playerTicket);
  let count = 0;
  for (const num of uniquePlayerNumbers) {
    if (drawSet.has(num)) {
      count++;
    }
  }
  return count;
}

export interface DrawSimulationResult {
  numbers: number[];
  mode: DrawMode;
  prizePool: number;
  jackpotRollover: number;
  nextJackpotRollover: number;
  tierAllocations: PrizeTierResult[];
  winners: DrawWinner[];
  eligibleParticipantsCount: number;
}

/**
 * Runs a draw execution (either simulation or final).
 * Calculates matches for all eligible subscribers, allocates prize tiers,
 * splits prizes equally among tier winners, and calculates any unclaimed rollover.
 */
export function executeDraw(
  participants: UserProfile[],
  prizePool: number,
  existingRollover: number = 0,
  mode: DrawMode = 'random',
  explicitNumbers?: number[],
  randomFn: () => number = Math.random
): DrawSimulationResult {
  // 1. Gather all participant scores for algorithmic weighting if requested
  const allScores = participants.flatMap((p) => p.scores);

  // 2. Determine drawn numbers
  const numbers =
    explicitNumbers && explicitNumbers.length === NUMBERS_PER_DRAW
      ? [...explicitNumbers].sort((a, b) => a - b)
      : generateDrawNumbers(mode, allScores, randomFn);

  // 3. Filter eligible participants: must be active subscriber with at least 1 score
  const eligible = participants.filter((p) => p.status === 'active' && p.scores.length > 0);

  // 4. Calculate matches and determine winners
  const winners: DrawWinner[] = [];
  const tierWinners: Record<3 | 4 | 5, UserProfile[]> = { 3: [], 4: [], 5: [] };

  for (const participant of eligible) {
    const ticket = participant.scores.map((s) => s.value);
    const matches = calculateMatches(ticket, numbers);

    if (matches === 5) {
      tierWinners[5].push(participant);
    } else if (matches === 4) {
      tierWinners[4].push(participant);
    } else if (matches === 3) {
      tierWinners[3].push(participant);
    }
  }

  // 5. Calculate prize pool tiers
  // 5-match tier pool includes any rollover jackpot from previous draws
  const tier5Base = prizePool * TIER_ALLOCATION_PERCENTAGES[5];
  const tier5Total = Math.round((tier5Base + existingRollover) * 100) / 100;
  const tier4Total = Math.round(prizePool * TIER_ALLOCATION_PERCENTAGES[4] * 100) / 100;
  const tier3Total = Math.round(prizePool * TIER_ALLOCATION_PERCENTAGES[3] * 100) / 100;

  let nextJackpotRollover = 0;

  // If 5-match tier has NO winners, the entire tier 5 pool rolls over to the next jackpot!
  if (tierWinners[5].length === 0) {
    nextJackpotRollover = tier5Total;
  }

  const tierAllocations: PrizeTierResult[] = [
    {
      tier: 5,
      percentage: 40,
      totalPoolAllocated: tier5Total,
      winnerCount: tierWinners[5].length,
      sharePerWinner:
        tierWinners[5].length > 0
          ? Math.round((tier5Total / tierWinners[5].length) * 100) / 100
          : 0,
    },
    {
      tier: 4,
      percentage: 35,
      totalPoolAllocated: tier4Total,
      winnerCount: tierWinners[4].length,
      sharePerWinner:
        tierWinners[4].length > 0
          ? Math.round((tier4Total / tierWinners[4].length) * 100) / 100
          : 0,
    },
    {
      tier: 3,
      percentage: 25,
      totalPoolAllocated: tier3Total,
      winnerCount: tierWinners[3].length,
      sharePerWinner:
        tierWinners[3].length > 0
          ? Math.round((tier3Total / tierWinners[3].length) * 100) / 100
          : 0,
    },
  ];

  // 6. Build winner records
  for (const tierResult of tierAllocations) {
    const list = tierWinners[tierResult.tier];
    for (const winner of list) {
      winners.push({
        id: `win-${tierResult.tier}-${winner.id}`,
        userId: winner.id,
        userName: winner.name,
        tier: tierResult.tier,
        matches: tierResult.tier,
        share: tierResult.sharePerWinner,
        proofStatus: 'pending',
      });
    }
  }

  return {
    numbers,
    mode,
    prizePool,
    jackpotRollover: existingRollover,
    nextJackpotRollover,
    tierAllocations,
    winners,
    eligibleParticipantsCount: eligible.length,
  };
}
