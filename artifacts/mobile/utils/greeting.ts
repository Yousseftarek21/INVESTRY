/**
 * Reusable greeting utility.
 * Determines a time-of-day greeting based on the device's local time,
 * optionally combined with a user's display name for personalization.
 */

export type GreetingStrings = {
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
};

export function getTimeOfDayGreeting(strings: GreetingStrings, date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return strings.greetingMorning;
  if (hour < 18) return strings.greetingAfternoon;
  return strings.greetingEvening;
}

export function getPersonalizedGreeting(
  strings: GreetingStrings,
  displayName?: string | null,
  date: Date = new Date()
): string {
  const base = getTimeOfDayGreeting(strings, date);
  const trimmed = displayName?.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}
