import { Score } from './types';

export const MIN_STABLEFORD_SCORE = 1;
export const MAX_STABLEFORD_SCORE = 45;
export const MAX_RETAINED_SCORES = 5;

/**
 * Validates a Stableford score submission.
 * Returns null if valid, or a descriptive error message if invalid.
 */
export function validateScore(
  value: number,
  date: string,
  existingScores: Score[],
  editingId?: string
): string | null {
  if (!date || date.trim() === '') {
    return 'Please choose the date you played.';
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Please enter a valid date in YYYY-MM-DD format.';
  }

  // Check valid integer in Stableford range 1-45
  if (!Number.isInteger(value)) {
    return 'Stableford score must be an integer.';
  }

  if (value < MIN_STABLEFORD_SCORE || value > MAX_STABLEFORD_SCORE) {
    return `Stableford scores must be between ${MIN_STABLEFORD_SCORE} and ${MAX_STABLEFORD_SCORE} points.`;
  }

  // Check for duplicate date for this user
  const duplicate = existingScores.some(
    (score) => score.date === date && score.id !== editingId
  );
  if (duplicate) {
    return 'Only one score can exist for a given date. Please edit the existing score instead.';
  }

  return null;
}

/**
 * Saves a score (add or update) and enforces:
 * 1. Reverse chronological order (latest date first).
 * 2. Maximum 5 scores retained.
 * 3. When a 6th score is added, the oldest score is automatically dropped.
 */
export function saveScore(existingScores: Score[], newScore: Score): Score[] {
  // If editing an existing score, replace it; otherwise add new
  const filtered = existingScores.filter((s) => s.id !== newScore.id);
  const updated = [newScore, ...filtered];

  // Sort reverse chronologically (newest played_on first)
  updated.sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    // Secondary fallback to id/creation if same date (though dates are unique per user)
    return b.id.localeCompare(a.id);
  });

  // Keep at most 5 scores
  return updated.slice(0, MAX_RETAINED_SCORES);
}

/**
 * Deletes a score by ID.
 */
export function deleteScore(existingScores: Score[], scoreId: string): Score[] {
  return existingScores.filter((score) => score.id !== scoreId);
}

/**
 * Sorts scores in reverse chronological order.
 */
export function sortScoresDescending(scores: Score[]): Score[] {
  return [...scores].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
