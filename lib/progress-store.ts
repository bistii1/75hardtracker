import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GOALS,
  getDefaultState,
  normalizeState,
  PEOPLE,
  type AppState,
  type GoalId,
  type PersonId,
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
    .maybeSingle<{ progress: unknown }>();

  if (error) {
    throw error;
  }

  return normalizeState(data?.progress);
}

async function writeToSupabase(supabase: SupabaseClient, state: AppState) {
  const { error } = await supabase.from(TABLE_NAME).upsert({
    id: STORE_KEY,
    progress: state,
  });

  if (error) {
    throw error;
  }
}

async function readLocal() {
  try {
    const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getDefaultState();
    }

    throw error;
  }
}

async function writeLocal(state: AppState) {
  await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(state, null, 2));
}

export async function getProgress() {
  const supabase = getSupabase();

  if (supabase) {
    return readFromSupabase(supabase);
  }

  return readLocal();
}

export async function saveProgress(state: AppState) {
  const supabase = getSupabase();

  if (supabase) {
    await writeToSupabase(supabase, state);
    return;
  }

  await writeLocal(state);
}

export function isPersonId(value: unknown): value is PersonId {
  return PEOPLE.some((person) => person.id === value);
}

export function isGoalId(value: unknown): value is GoalId {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < DEFAULT_GOALS.length;
}
