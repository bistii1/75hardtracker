export const START_DATE = "2026-06-08";
export const TOTAL_DAYS = 75;

export const PEOPLE = [
  {
    id: "you",
    name: "You",
    colorName: "pink",
  },
  {
    id: "karthik",
    name: "Karthik",
    colorName: "blue",
  },
] as const;

export const GOALS = [
  "Accomplished a dietary goal",
  "1 hour of exercise",
  "Drank at least 4 water bottles",
  "Read 10 pages of nonfiction",
  "Took daily progress pictures",
] as const;

export type PersonId = (typeof PEOPLE)[number]["id"];
export type GoalId = number;

export type DayProgress = Partial<Record<PersonId, GoalId[]>>;
export type ProgressState = Record<string, DayProgress>;

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function getChallengeDay(dateKey = toDateKey(new Date())) {
  const start = new Date(`${START_DATE}T00:00:00.000Z`).getTime();
  const current = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const diff = Math.floor((current - start) / 86_400_000);

  if (diff < 0) {
    return 0;
  }

  return Math.min(diff + 1, TOTAL_DAYS);
}

export function isComplete(goals: GoalId[] | undefined) {
  return goals?.length === GOALS.length;
}

export function getEmptyProgress(): ProgressState {
  return {};
}
