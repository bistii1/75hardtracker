import { NextResponse } from "next/server";
import { getProgress, isGoalId, isPersonId, saveProgress } from "@/lib/progress-store";

export const dynamic = "force-dynamic";

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const progress = await getProgress();
  return NextResponse.json({ progress });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    date?: unknown;
    personId?: unknown;
    goalId?: unknown;
    checked?: unknown;
  };

  if (
    !isDateKey(body.date) ||
    !isPersonId(body.personId) ||
    !isGoalId(body.goalId) ||
    typeof body.checked !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid progress update." }, { status: 400 });
  }

  const progress = await getProgress();
  const day = progress[body.date] ?? {};
  const currentGoals = new Set(day[body.personId] ?? []);

  if (body.checked) {
    currentGoals.add(body.goalId);
  } else {
    currentGoals.delete(body.goalId);
  }

  progress[body.date] = {
    ...day,
    [body.personId]: Array.from(currentGoals).sort((a, b) => a - b),
  };

  await saveProgress(progress);

  return NextResponse.json({ progress });
}
