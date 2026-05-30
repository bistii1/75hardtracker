import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  GOALS,
  getEmptyProgress,
  PEOPLE,
  type GoalId,
  type PersonId,
  type ProgressState,
} from "@/lib/challenge";

const STORE_KEY = "main";
const TABLE_NAME = "challenge_progress";
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "progress.json");

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

function getSupabase() {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

async function readFromSupabase(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("progress")
    .eq("id", STORE_KEY)
    .maybeSingle<{ progress: ProgressState }>();

  if (error) {
    throw error;
  }

  return data?.progress ?? getEmptyProgress();
}

async function writeToSupabase(supabase: SupabaseClient, progress: ProgressState) {
  const { error } = await supabase.from(TABLE_NAME).upsert({
    id: STORE_KEY,
    progress,
  });

  if (error) {
    throw error;
  }
}

async function readLocal() {
  try {
    const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
    return JSON.parse(raw) as ProgressState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getEmptyProgress();
    }

    throw error;
  }
}

async function writeLocal(progress: ProgressState) {
  await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(progress, null, 2));
}

export async function getProgress() {
  const supabase = getSupabase();

  if (supabase) {
    return readFromSupabase(supabase);
  }

  return readLocal();
}

export async function saveProgress(progress: ProgressState) {
  const supabase = getSupabase();

  if (supabase) {
    await writeToSupabase(supabase, progress);
    return;
  }

  await writeLocal(progress);
}

export function isPersonId(value: unknown): value is PersonId {
  return PEOPLE.some((person) => person.id === value);
}

export function isGoalId(value: unknown): value is GoalId {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < GOALS.length;
}
