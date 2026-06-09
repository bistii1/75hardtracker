"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  addDays,
  getDefaultState,
  getChallengeDay,
  getDayWinner,
  getGoalsForPerson,
  isDayComplete,
  PEOPLE,
  START_DATE,
  toDateKey,
  TOTAL_DAYS,
  type AppState,
  type GoalId,
  type PersonId,
} from "@/lib/challenge";

type SaveState = "idle" | "saving" | "saved" | "error";
type CalendarView = "week" | "month" | "all";
const MAX_PROOF_PHOTO_LENGTH = 1_800_000;
const PERSON_STORAGE_KEY = "75-hard-person";
const PERSON_STORAGE_EVENT = "75-hard-person-change";

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getPersonGoals(state: AppState, dateKey: string, personId: PersonId) {
  const progress = state.progress;
  return progress[dateKey]?.[personId] ?? [];
}

function getProofPhoto(state: AppState, dateKey: string, personId: PersonId) {
  return state.proofs[dateKey]?.[personId] ?? null;
}

function compressImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new window.Image();

      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Could not prepare photo."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);

        if (dataUrl.length > MAX_PROOF_PHOTO_LENGTH) {
          reject(new Error("Photo is too large."));
          return;
        }

        resolve(dataUrl);
      };

      image.onerror = () => reject(new Error("Could not read photo."));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("Could not load photo."));
    reader.readAsDataURL(file);
  });
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

function getSavedPerson() {
  if (typeof window === "undefined") {
    return null;
  }

  const savedPerson = window.localStorage.getItem(PERSON_STORAGE_KEY) as PersonId | null;
  return savedPerson && PEOPLE.some((person) => person.id === savedPerson) ? savedPerson : null;
}

function subscribeToPersonStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PERSON_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PERSON_STORAGE_EVENT, onStoreChange);
  };
}

function getServerSavedPerson() {
  return null;
}

function notifyPersonStore() {
  window.dispatchEvent(new Event(PERSON_STORAGE_EVENT));
}

export default function Home() {
  const [state, setState] = useState<AppState>(getDefaultState());
  const activePersonId = useSyncExternalStore(
    subscribeToPersonStore,
    getSavedPerson,
    getServerSavedPerson,
  );
  const todayKey = useSyncExternalStore(
    subscribeToDateStore,
    getBrowserDateKey,
    getServerDateKey,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [confettiRun, setConfettiRun] = useState(0);

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
  const activePerson = PEOPLE.find((person) => person.id === activePersonId);
  const partner = PEOPLE.find((person) => person.id !== activePersonId);
  const activePersonGoals = activePersonId ? getGoalsForPerson(state, activePersonId) : [];
  const partnerGoals = partner ? getGoalsForPerson(state, partner.id) : [];
  const bothCompleteDays = days.filter((day) =>
    PEOPLE.every((person) => isDayComplete(state, day.dateKey, person.id)),
  ).length;
  const todayComplete = activePersonId
    ? isDayComplete(state, activeDate, activePersonId)
    : false;
  const activeDayIndex = Math.max(
    days.findIndex((day) => day.dateKey === activeDate),
    0,
  );
  const visibleDays = useMemo(() => {
    if (calendarView === "all") {
      return days;
    }

    if (calendarView === "week") {
      const weekStart = Math.floor(activeDayIndex / 7) * 7;
      return days.slice(weekStart, weekStart + 7);
    }

    const activeMonth = activeDate.slice(0, 7);
    return days.filter((day) => day.dateKey.startsWith(activeMonth));
  }, [activeDate, activeDayIndex, calendarView, days]);
  const calendarRangeLabel =
    calendarView === "all"
      ? "All 75 days"
      : calendarView === "week"
        ? `Days ${visibleDays[0]?.dayNumber ?? 1}-${visibleDays.at(-1)?.dayNumber ?? 1}`
        : new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
          }).format(new Date(`${activeDate}T12:00:00`));

  useEffect(() => {
    async function loadProgress() {
      const response = await fetch("/api/progress", { cache: "no-store" });
      const data = (await response.json()) as AppState;
      setState(data);
    }

    loadProgress().catch(() => setSaveState("error"));
  }, []);

  function choosePerson(personId: PersonId) {
    window.localStorage.setItem(PERSON_STORAGE_KEY, personId);
    notifyPersonStore();
  }

  function switchProfile() {
    window.localStorage.removeItem(PERSON_STORAGE_KEY);
    notifyPersonStore();
  }

  function updateGoalDraft(personId: PersonId, goalId: GoalId, value: string) {
    setState((current) => ({
      ...current,
      goals: {
        ...current.goals,
        [personId]: getGoalsForPerson(current, personId).map((currentGoal, index) =>
          index === goalId ? value : currentGoal,
        ),
      },
    }));
  }

  function triggerConfetti() {
    setConfettiRun((current) => current + 1);
  }

  function shiftCalendar(direction: -1 | 1) {
    const step = calendarView === "month" ? 30 : 7;
    const nextIndex = Math.min(Math.max(activeDayIndex + direction * step, 0), days.length - 1);
    setSelectedDate(days[nextIndex].dateKey);
  }

  async function toggleGoal(personId: PersonId, goalId: GoalId, checked: boolean) {
    if (personId !== activePersonId) {
      return;
    }

    const previous = state;
    const day = previous.progress[activeDate] ?? {};
    const goals = new Set(day[personId] ?? []);

    if (checked) {
      goals.add(goalId);
    } else {
      goals.delete(goalId);
    }

    const nextState = {
      ...previous,
      progress: {
        ...previous.progress,
        [activeDate]: {
          ...day,
          [personId]: Array.from(goals).sort((a, b) => a - b),
        },
      },
    };
    const wasComplete = isDayComplete(previous, activeDate, personId);
    const isNowComplete = isDayComplete(nextState, activeDate, personId);

    setState(nextState);
    if (!wasComplete && isNowComplete) {
      triggerConfetti();
    }
    setSaveState("saving");

    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "progress",
          date: activeDate,
          personId,
          goalId,
          checked,
        }),
      });

      if (!response.ok) {
        throw new Error("Progress update failed");
      }

      const data = (await response.json()) as AppState;
      setState(data);
      setSaveState("saved");
    } catch {
      setState(previous);
      setSaveState("error");
    }
  }

  async function updateGoal(goalId: GoalId, value: string) {
    if (!activePersonId) {
      return;
    }

    const previous = state;
    const nextGoals = getGoalsForPerson(previous, activePersonId).map((goal, index) =>
      index === goalId ? value : goal,
    );

    setState({
      ...previous,
      goals: {
        ...previous.goals,
        [activePersonId]: nextGoals,
      },
    });

    if (!value.trim()) {
      setSaveState("error");
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "goals", personId: activePersonId, goals: nextGoals }),
      });

      if (!response.ok) {
        throw new Error("Goals update failed");
      }

      const data = (await response.json()) as AppState;
      setState(data);
      setSaveState("saved");
    } catch {
      setState(previous);
      setSaveState("error");
    }
  }

  async function saveProofPhoto(personId: PersonId, file: File | null) {
    if (personId !== activePersonId || !file) {
      return;
    }

    const previous = state;
    setSaveState("saving");

    try {
      const dataUrl = await compressImage(file);
      const nextState = {
        ...previous,
        proofs: {
          ...previous.proofs,
          [activeDate]: {
            ...previous.proofs[activeDate],
            [personId]: {
              dataUrl,
              uploadedAt: new Date().toISOString(),
            },
          },
        },
      };

      setState(nextState);

      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "proof",
          date: activeDate,
          personId,
          dataUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Proof upload failed");
      }

      const data = (await response.json()) as AppState;
      setState(data);
      setSaveState("saved");
    } catch {
      setState(previous);
      setSaveState("error");
    }
  }

  async function removeProofPhoto(personId: PersonId) {
    if (personId !== activePersonId) {
      return;
    }

    const previous = state;
    const dayProofs = previous.proofs[activeDate] ?? {};
    const remainingProofs = { ...dayProofs };
    delete remainingProofs[personId];
    const nextState = {
      ...previous,
      proofs: {
        ...previous.proofs,
        [activeDate]: remainingProofs,
      },
    };

    setState(nextState);
    setSaveState("saving");

    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "proof",
          date: activeDate,
          personId,
          dataUrl: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Proof removal failed");
      }

      const data = (await response.json()) as AppState;
      setState(data);
      setSaveState("saved");
    } catch {
      setState(previous);
      setSaveState("error");
    }
  }

  if (!activePersonId) {
    return (
      <main className="welcome-shell">
        <section className="welcome-card">
          <p className="eyebrow">75 Hard starts June 8</p>
          <h1>Who&apos;s checking in?</h1>
          <p className="hero-copy">
            Pick your profile once, then track your daily goals while keeping an eye on
            each other&apos;s streak.
          </p>

          <div className="profile-picker">
            {PEOPLE.map((person) => (
              <button
                className={`profile-card ${person.colorName}`}
                key={person.id}
                onClick={() => choosePerson(person.id)}
                type="button"
              >
                <span className={`profile-orb ${person.colorName}`}>{person.emoji}</span>
                <strong>{person.name}</strong>
                <small>Enter dashboard</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {confettiRun > 0 ? (
        <div className="confetti-layer" key={confettiRun} aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--drift": `${(index - 14) * 6}px`,
                  animationDelay: `${(index % 8) * 35}ms`,
                  left: `${(index * 37) % 100}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <section className={`hero-card hero-${activePerson?.colorName ?? "pink"}`}>
        <div>
          <p className="eyebrow">Signed in as {activePerson?.name}</p>
          <h1>75 Hard Command Center</h1>
          <p className="hero-copy">
            Today&apos;s mission is simple: finish the list, light up your square,
            and keep the team streak moving.
          </p>
          <div className="hero-actions">
            <button className="ghost-button" onClick={switchProfile} type="button">
              Switch profile
            </button>
            <button className="ghost-button" onClick={() => setSelectedDate(null)} type="button">
              Jump to today
            </button>
          </div>
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
            isDayComplete(state, day.dateKey, person.id),
          ).length;

          return (
            <article
              className={`stat-card ${person.colorName} ${
                person.id === activePersonId ? "active-stat" : ""
              }`}
              key={person.id}
            >
              <span>{person.name}</span>
              <strong>{completeDays}</strong>
              <small>completed days</small>
            </article>
          );
        })}
        <article className="stat-card together">
          <span>Together</span>
          <strong>{bothCompleteDays}</strong>
          <small>both completed</small>
        </article>
      </section>

      <section className="content-grid">
        <div className="calendar-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Shared Calendar</p>
              <h2>Challenge Days</h2>
              <p className="calendar-range">{calendarRangeLabel}</p>
            </div>
            <div className="legend">
              <span>
                <i className="dot pink-dot" /> Bisti
              </span>
              <span>
                <i className="dot blue-dot" /> Karthik
              </span>
              <span>
                <i className="dot both-dot" /> Both
              </span>
            </div>
          </div>

          <div className="calendar-toolbar">
            <div className="calendar-view-toggle" aria-label="Calendar view">
              {(["week", "month", "all"] as const).map((view) => (
                <button
                  className={calendarView === view ? "active" : ""}
                  key={view}
                  onClick={() => setCalendarView(view)}
                  type="button"
                >
                  {view}
                </button>
              ))}
            </div>
            {calendarView !== "all" ? (
              <div className="calendar-stepper">
                <button onClick={() => shiftCalendar(-1)} type="button">
                  Prev
                </button>
                <button onClick={() => shiftCalendar(1)} type="button">
                  Next
                </button>
              </div>
            ) : null}
          </div>

          <div className="calendar-grid">
            {visibleDays.map((day) => {
              const bistiDone = isDayComplete(state, day.dateKey, "bisti");
              const karthikDone = isDayComplete(state, day.dateKey, "karthik");
              const bothDone = bistiDone && karthikDone;
              const winnerId = getDayWinner(state, day.dateKey);
              const winner = PEOPLE.find((person) => person.id === winnerId);

              return (
                <button
                  className={[
                    "calendar-day",
                    day.dateKey === activeDate ? "selected" : "",
                    day.dateKey === todayKey ? "today" : "",
                    bothDone ? "both-complete" : "",
                    winner ? `winner-${winner.colorName}` : "",
                  ].join(" ")}
                  key={day.dateKey}
                  onClick={() => setSelectedDate(day.dateKey)}
                  type="button"
                >
                  <span className="day-number">{day.dayNumber}</span>
                  <small>{formatDate(day.dateKey).replace(",", "")}</small>
                  <span className="day-markers">
                    <i className={bistiDone ? "marker pink" : "marker empty"} />
                    <i className={karthikDone ? "marker blue" : "marker empty"} />
                  </span>
                  {winner ? (
                    <span className={`winner-badge ${winner.colorName}`}>
                      {winner.name} won
                    </span>
                  ) : null}
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

          <div className={`completion-banner ${todayComplete ? "complete" : ""}`}>
            <span>{todayComplete ? "Locked in" : "In progress"}</span>
            <strong>
              {activePerson?.name}: {getPersonGoals(state, activeDate, activePersonId).length} /{" "}
              {activePersonGoals.length} goals complete
            </strong>
            {partner ? (
              <small>
                {partner.name}: {getPersonGoals(state, activeDate, partner.id).length} /{" "}
                {partnerGoals.length} goals complete
              </small>
            ) : null}
          </div>

          <div className="people-checklists">
            {PEOPLE.map((person) => {
              const goals = getPersonGoals(state, activeDate, person.id);
              const personGoalList = getGoalsForPerson(state, person.id);
              const canEdit = person.id === activePersonId;
              const proof = getProofPhoto(state, activeDate, person.id);

              return (
                <section className={`person-panel ${canEdit ? "editable" : "readonly"}`} key={person.id}>
                  <div className="person-heading">
                    <span className={`avatar ${person.colorName}`}>
                      {person.emoji}
                    </span>
                    <div>
                      <h3>{person.name}</h3>
                      <p>{canEdit ? "Your check-in" : "Partner view"} · {goals.length} of {personGoalList.length}</p>
                    </div>
                  </div>

                  <div className={`proof-card ${proof ? "has-proof" : ""}`}>
                    <div className="proof-copy">
                      <span>Optional photo</span>
                      <strong>{proof ? "Photo attached" : "No photo needed"}</strong>
                      <small>
                        {proof
                          ? `Uploaded ${formatDate(proof.uploadedAt.slice(0, 10))}`
                          : "Add one if you want a visual memory for the day."}
                      </small>
                    </div>

                    {proof ? (
                      <Image
                        alt={`${person.name} proof for ${formatDate(activeDate)}`}
                        className="proof-image"
                        height={360}
                        unoptimized
                        src={proof.dataUrl}
                        width={480}
                      />
                    ) : (
                      <div className="proof-placeholder">No proof yet</div>
                    )}

                    {canEdit ? (
                      <div className="proof-actions">
                        <label className="proof-upload-button">
                          {proof ? "Replace photo" : "Upload proof"}
                          <input
                            accept="image/*"
                            onChange={(event) => {
                              saveProofPhoto(person.id, event.target.files?.[0] ?? null);
                              event.target.value = "";
                            }}
                            type="file"
                          />
                        </label>
                        {proof ? (
                          <button
                            className="proof-remove-button"
                            onClick={() => removeProofPhoto(person.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="goal-list">
                    {personGoalList.map((goal, goalId) => {
                      const checked = goals.includes(goalId);

                      return (
                        <label className="goal-row" key={`${person.id}-goal-${goalId}`}>
                          <input
                            checked={checked}
                            disabled={!canEdit}
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

      <section className="goals-editor-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Challenge Rules</p>
            <h2>Edit {activePerson?.name}&apos;s goals</h2>
          </div>
          <p className="editor-note">Changes only affect this profile.</p>
        </div>

        <div className="editable-goals-grid">
          {activePersonGoals.map((goal, goalId) => (
            <label className="editable-goal" key={`${activePersonId}-editor-${goalId}`}>
              <span>Goal {goalId + 1}</span>
              <input
                onBlur={(event) => updateGoal(goalId, event.target.value)}
                onChange={(event) => updateGoalDraft(activePersonId, goalId, event.target.value)}
                value={goal}
              />
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
