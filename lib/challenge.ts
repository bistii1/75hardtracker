export const START_DATE = "2026-06-08";
export const TOTAL_DAYS = 75;

export const PEOPLE = [
  {
    id: "bisti",
    name: "Bisti",
    colorName: "pink",
    emoji: "B",
  },
  {
    id: "karthik",
    name: "Karthik",
    colorName: "blue",
    emoji: "K",
  },
] as const;

export const DEFAULT_GOALS = [
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
export type ProofPhoto = {
  dataUrl: string;
  uploadedAt: string;
};
export type ProofState = Record<string, Partial<Record<PersonId, ProofPhoto>>>;
export type GoalsState = Record<PersonId, string[]>;
export type AppState = {
  goals: GoalsState;
  progress: ProgressState;
  proofs: ProofState;
};

function dateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function utcDayFromDateKey(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  return Date.UTC(year, month - 1, day);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return toDateKey(date);
}

export function getChallengeDay(dateKey = toDateKey(new Date())) {
  const start = utcDayFromDateKey(START_DATE);
  const current = utcDayFromDateKey(dateKey);
  const diff = Math.floor((current - start) / 86_400_000);

  if (diff < 0) {
    return 0;
  }

  return Math.min(diff + 1, TOTAL_DAYS);
}

export function isComplete(goals: GoalId[] | undefined, goalCount: number) {
  return goals?.length === goalCount;
}

export function getGoalsForPerson(state: AppState, personId: PersonId) {
  return state.goals[personId] ?? [...DEFAULT_GOALS];
}

export function hasProof(state: AppState, dateKey: string, personId: PersonId) {
  return Boolean(state.proofs[dateKey]?.[personId]?.dataUrl);
}

export function isDayComplete(
  state: AppState,
  dateKey: string,
  personId: PersonId,
) {
  return (
    isComplete(state.progress[dateKey]?.[personId], getGoalsForPerson(state, personId).length) &&
    hasProof(state, dateKey, personId)
  );
}

export function getDefaultState(): AppState {
  return {
    goals: {
      bisti: [...DEFAULT_GOALS],
      karthik: [...DEFAULT_GOALS],
    },
    progress: {},
    proofs: {},
  };
}

export function normalizeState(value: unknown): AppState {
  const fallback = getDefaultState();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const maybeState = value as Partial<AppState> & { you?: unknown };
  const rawProgress =
    maybeState.progress && typeof maybeState.progress === "object"
      ? (maybeState.progress as Record<string, unknown>)
      : (value as Record<string, unknown>);
  const rawProofs =
    maybeState.proofs && typeof maybeState.proofs === "object"
      ? (maybeState.proofs as Record<string, unknown>)
      : {};
  const goals = normalizeGoals(maybeState.goals, fallback.goals);

  const progress: ProgressState = {};
  const proofs: ProofState = {};

  for (const [dateKey, day] of Object.entries(rawProgress)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !day || typeof day !== "object") {
      continue;
    }

    const dayProgress = day as Record<string, unknown>;
    const bistiGoals = Array.isArray(dayProgress.bisti)
      ? dayProgress.bisti
      : Array.isArray(dayProgress.you)
        ? dayProgress.you
        : [];
    const karthikGoals = Array.isArray(dayProgress.karthik) ? dayProgress.karthik : [];

    progress[dateKey] = {
      bisti: bistiGoals.filter(Number.isInteger) as GoalId[],
      karthik: karthikGoals.filter(Number.isInteger) as GoalId[],
    };
  }

  for (const [dateKey, day] of Object.entries(rawProofs)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !day || typeof day !== "object") {
      continue;
    }

    const dayProofs = day as Record<string, unknown>;

    for (const person of PEOPLE) {
      const proof = dayProofs[person.id];

      if (!proof || typeof proof !== "object") {
        continue;
      }

      const maybeProof = proof as Partial<ProofPhoto>;

      if (
        typeof maybeProof.dataUrl === "string" &&
        maybeProof.dataUrl.startsWith("data:image/") &&
        typeof maybeProof.uploadedAt === "string"
      ) {
        proofs[dateKey] = {
          ...proofs[dateKey],
          [person.id]: {
            dataUrl: maybeProof.dataUrl,
            uploadedAt: maybeProof.uploadedAt,
          },
        };
      }
    }
  }

  return {
    goals,
    progress,
    proofs,
  };
}

function normalizeGoals(value: unknown, fallback: GoalsState): GoalsState {
  if (Array.isArray(value) && value.every((goal) => typeof goal === "string")) {
    return {
      bisti: value,
      karthik: value,
    };
  }

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const possibleGoals = value as Partial<Record<PersonId, unknown>>;

  return {
    bisti:
      Array.isArray(possibleGoals.bisti) &&
      possibleGoals.bisti.every((goal) => typeof goal === "string")
        ? possibleGoals.bisti
        : fallback.bisti,
    karthik:
      Array.isArray(possibleGoals.karthik) &&
      possibleGoals.karthik.every((goal) => typeof goal === "string")
        ? possibleGoals.karthik
        : fallback.karthik,
  };
}
