import { Plan } from './types';

export const MIN_CHARITY_PERCENTAGE = 10;
export const MAX_CHARITY_PERCENTAGE = 100;
export const MONTHLY_PLAN_FEE = 12.0;
export const YEARLY_PLAN_FEE = 120.0;

/**
 * Validates the chosen charity contribution percentage.
 * Must be at least 10% and at most 100%.
 */
export function validateContributionPercentage(percentage: number): string | null {
  if (typeof percentage !== 'number' || isNaN(percentage)) {
    return 'Contribution percentage must be a number.';
  }
  if (percentage < MIN_CHARITY_PERCENTAGE) {
    return `Minimum charitable contribution is ${MIN_CHARITY_PERCENTAGE}% of your subscription.`;
  }
  if (percentage > MAX_CHARITY_PERCENTAGE) {
    return `Maximum contribution percentage is ${MAX_CHARITY_PERCENTAGE}%.`;
  }
  return null;
}

/**
 * Calculates the exact charity contribution in British Pounds (£)
 * derived from the actual subscription plan fee.
 */
export function calculateCharityContribution(plan: Plan, percentage: number): number {
  const baseFee = plan === 'monthly' ? MONTHLY_PLAN_FEE : YEARLY_PLAN_FEE;
  const raw = (baseFee * percentage) / 100;
  return Math.round(raw * 100) / 100;
}

/**
 * Validates an independent direct donation.
 */
export function validateIndependentDonation(amount: number): string | null {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return 'Donation amount must be greater than £0.00.';
  }
  if (amount < 1.0) {
    return 'Minimum donation amount is £1.00.';
  }
  return null;
}
