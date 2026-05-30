import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  GOALS,
  getEmptyProgress,
  PEOPLE,
  type GoalId,
  type PersonId,
  type ProgressState,
} from "@/lib/challenge";

const STORE_KEY = "75-hard-progress";
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "progress.json");

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function getRedis() {
  const config = getRedisConfig();

  if (!config) {
    return null;
  }

  return new Redis(config);
}

async function readFromRedis(redis: Redis) {
  return (await redis.get<ProgressState>(STORE_KEY)) ?? getEmptyProgress();
}

async function writeToRedis(redis: Redis, progress: ProgressState) {
  await redis.set(STORE_KEY, progress);
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
  const redis = getRedis();

  if (redis) {
    return readFromRedis(redis);
  }

  return readLocal();
}

export async function saveProgress(progress: ProgressState) {
  const redis = getRedis();

  if (redis) {
    await writeToRedis(redis, progress);
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
