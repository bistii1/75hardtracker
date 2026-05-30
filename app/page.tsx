"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  addDays,
  getChallengeDay,
  GOALS,
  isComplete,
  PEOPLE,
  START_DATE,
  toDateKey,
  TOTAL_DAYS,
  type GoalId,
  type PersonId,
  type ProgressState,
} from "@/lib/challenge";

type SaveState = "idle" | "saving" | "saved" | "error";

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getPersonGoals(progress: ProgressState, dateKey: string, personId: PersonId) {
  return progress[dateKey]?.[personId] ?? [];
}

function subscribeToDateStore() {
  return () => {};
}

function getBrowserDateKey() {
  return toDateKey(new Date());
}

function getServerDateKey() {
  return null;
}

export default function Home() {
  const [progress, setProgress] = useState<ProgressState>({});
  const todayKey = useSyncExternalStore(
    subscribeToDateStore,
    getBrowserDateKey,
    getServerDateKey,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const days = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, index) => ({
        dateKey: addDays(START_DATE, index),
        dayNumber: index + 1,
      })),
    [],
  );

  const challengeDay = todayKey ? getChallengeDay(todayKey) : 0;
  const defaultSelectedDate = todayKey
    ? addDays(START_DATE, Math.max(getChallengeDay(todayKey), 1) - 1)
    : START_DATE;
  const activeDate = selectedDate ?? defaultSelectedDate;
  const selectedDay = days.find((day) => day.dateKey === activeDate);

  useEffect(() => {
    async function loadProgress() {
      const response = await fetch("/api/progress", { cache: "no-store" });
      const data = (await response.json()) as { progress: ProgressState };
      setProgress(data.progress);
    }

    loadProgress().catch(() => setSaveState("error"));
  }, []);

  async function toggleGoal(personId: PersonId, goalId: GoalId, checked: boolean) {
    const previous = progress;
    const day = previous[activeDate] ?? {};
    const goals = new Set(day[personId] ?? []);

    if (checked) {
      goals.add(goalId);
    } else {
      goals.delete(goalId);
    }

    const nextProgress = {
      ...previous,
      [activeDate]: {
        ...day,
        [personId]: Array.from(goals).sort((a, b) => a - b),
      },
    };

    setProgress(nextProgress);
    setSaveState("saving");

    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: activeDate, personId, goalId, checked }),
      });

      if (!response.ok) {
        throw new Error("Progress update failed");
      }

      const data = (await response.json()) as { progress: ProgressState };
      setProgress(data.progress);
      setSaveState("saved");
    } catch {
      setProgress(previous);
      setSaveState("error");
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Starting June 8, 2026</p>
          <h1>75 Hard Tracker</h1>
          <p className="hero-copy">
            A shared daily checklist for you and Karthik. Finish all five habits
            to light up your color on the calendar.
          </p>
        </div>
        <div className="day-counter">
          <span>{challengeDay === 0 ? "Not started" : `Day ${challengeDay}`}</span>
          <strong>{challengeDay === 0 ? "0" : challengeDay}</strong>
          <small>of {TOTAL_DAYS} days</small>
        </div>
      </section>

      <section className="stats-grid">
        {PEOPLE.map((person) => {
          const completeDays = days.filter((day) =>
            isComplete(getPersonGoals(progress, day.dateKey, person.id)),
          ).length;

          return (
            <article className={`stat-card ${person.colorName}`} key={person.id}>
              <span>{person.name}</span>
              <strong>{completeDays}</strong>
              <small>completed days</small>
            </article>
          );
        })}
        <article className="stat-card together">
          <span>Together</span>
          <strong>
            {
              days.filter((day) =>
                PEOPLE.every((person) =>
                  isComplete(getPersonGoals(progress, day.dateKey, person.id)),
                ),
              ).length
            }
          </strong>
          <small>both completed</small>
        </article>
      </section>

      <section className="content-grid">
        <div className="calendar-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Shared Calendar</p>
              <h2>Challenge Days</h2>
            </div>
            <div className="legend">
              <span>
                <i className="dot pink-dot" /> You
              </span>
              <span>
                <i className="dot blue-dot" /> Karthik
              </span>
              <span>
                <i className="dot both-dot" /> Both
              </span>
            </div>
          </div>

          <div className="calendar-grid">
            {days.map((day) => {
              const youDone = isComplete(getPersonGoals(progress, day.dateKey, "you"));
              const karthikDone = isComplete(
                getPersonGoals(progress, day.dateKey, "karthik"),
              );
              const bothDone = youDone && karthikDone;

              return (
                <button
                  className={[
                    "calendar-day",
                    day.dateKey === activeDate ? "selected" : "",
                    day.dateKey === todayKey ? "today" : "",
                    bothDone ? "both-complete" : "",
                  ].join(" ")}
                  key={day.dateKey}
                  onClick={() => setSelectedDate(day.dateKey)}
                  type="button"
                >
                  <span className="day-number">{day.dayNumber}</span>
                  <small>{formatDate(day.dateKey).replace(",", "")}</small>
                  <span className="day-markers">
                    <i className={youDone ? "marker pink" : "marker empty"} />
                    <i className={karthikDone ? "marker blue" : "marker empty"} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="checklist-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {selectedDay ? `Day ${selectedDay.dayNumber}` : "Selected day"}
              </p>
              <h2>{formatDate(activeDate)}</h2>
            </div>
            <span className={`save-pill ${saveState}`}>{saveState}</span>
          </div>

          <div className="people-checklists">
            {PEOPLE.map((person) => {
              const goals = getPersonGoals(progress, activeDate, person.id);

              return (
                <section className="person-panel" key={person.id}>
                  <div className="person-heading">
                    <span className={`avatar ${person.colorName}`}>
                      {person.name.slice(0, 1)}
                    </span>
                    <div>
                      <h3>{person.name}</h3>
                      <p>{goals.length} of 5 complete</p>
                    </div>
                  </div>

                  <div className="goal-list">
                    {GOALS.map((goal, goalId) => {
                      const checked = goals.includes(goalId);

                      return (
                        <label className="goal-row" key={goal}>
                          <input
                            checked={checked}
                            onChange={(event) =>
                              toggleGoal(person.id, goalId, event.target.checked)
                            }
                            type="checkbox"
                          />
                          <span>{goal}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
