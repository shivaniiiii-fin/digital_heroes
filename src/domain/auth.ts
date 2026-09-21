import { Role, SubscriptionStatus, UserProfile } from './types';

export function isSubscriber(user: UserProfile | null): boolean {
  if (!user) return false;
  return (
    (user.role === 'subscriber' || user.role === 'admin') &&
    user.status === 'active'
  );
}

export function isAdmin(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

export function canEnterDraw(user: UserProfile | null): boolean {
  if (!user) return false;
  return isSubscriber(user) && user.scores.length > 0;
}
