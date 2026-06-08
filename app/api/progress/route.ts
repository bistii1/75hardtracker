import { NextResponse } from "next/server";
import { DEFAULT_GOALS } from "@/lib/challenge";
import { getProgress, isGoalId, isPersonId, saveProgress } from "@/lib/progress-store";

export const dynamic = "force-dynamic";

const MAX_PROOF_PHOTO_LENGTH = 1_800_000;

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const state = await getProgress();
  return NextResponse.json(state);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    type?: unknown;
    date?: unknown;
    personId?: unknown;
    goalId?: unknown;
    checked?: unknown;
    goals?: unknown;
    dataUrl?: unknown;
  };

  if (body.type === "goals") {
    if (
      !isPersonId(body.personId) ||
      !Array.isArray(body.goals) ||
      body.goals.length !== DEFAULT_GOALS.length ||
      !body.goals.every((goal) => typeof goal === "string" && goal.trim().length > 0)
    ) {
      return NextResponse.json({ error: "Invalid goals update." }, { status: 400 });
    }

    const state = await getProgress();
    state.goals[body.personId] = body.goals.map((goal) => goal.trim());
    await saveProgress(state);

    return NextResponse.json(state);
  }

  if (body.type === "proof") {
    if (!isDateKey(body.date) || !isPersonId(body.personId)) {
      return NextResponse.json({ error: "Invalid proof update." }, { status: 400 });
    }

    if (
      body.dataUrl !== null &&
      (typeof body.dataUrl !== "string" ||
        !body.dataUrl.startsWith("data:image/") ||
        body.dataUrl.length > MAX_PROOF_PHOTO_LENGTH)
    ) {
      return NextResponse.json({ error: "Invalid proof photo." }, { status: 400 });
    }

    const state = await getProgress();
    const dayProofs = state.proofs[body.date] ?? {};

    if (body.dataUrl === null) {
      const remainingProofs = { ...dayProofs };
      delete remainingProofs[body.personId];
      state.proofs[body.date] = remainingProofs;
    } else {
      state.proofs[body.date] = {
        ...dayProofs,
        [body.personId]: {
          dataUrl: body.dataUrl,
          uploadedAt: new Date().toISOString(),
        },
      };
    }

    await saveProgress(state);

    return NextResponse.json(state);
  }

  if (body.type !== "progress") {
    return NextResponse.json({ error: "Invalid update type." }, { status: 400 });
  }

  if (
    !isDateKey(body.date) ||
    !isPersonId(body.personId) ||
    !isGoalId(body.goalId) ||
    typeof body.checked !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid progress update." }, { status: 400 });
  }

  const state = await getProgress();
  const day = state.progress[body.date] ?? {};
  const currentGoals = new Set(day[body.personId] ?? []);

  if (body.checked) {
    currentGoals.add(body.goalId);
  } else {
    currentGoals.delete(body.goalId);
  }

  state.progress[body.date] = {
    ...day,
    [body.personId]: Array.from(currentGoals).sort((a, b) => a - b),
  };

  await saveProgress(state);

  return NextResponse.json(state);
}
