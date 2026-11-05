"use client";

import { SPORTS, SPORT_BY_ID, activityLine } from "@/lib/sports";
import { formatLong, pacificDate } from "@/lib/time";
import { fmtWeight } from "@/lib/units";
import { useApp } from "./AppContext";
import { IconPlus, IconScale, IconTrain } from "./Icons";
import Modal from "./Modal";
import { SportIcon } from "./Sports";

/** Everything done on one day, and buttons to log more for it (a missed workout, a game, a weigh-in). */
export function DayDialog({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { data, unit, openWorkout, openActivity, openBodyWeight, openPastWorkout } = useApp();
  if (!date) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const workouts = data.sessions.filter((s) => s.date === date);
  const sports = data.activities.filter((a) => a.date === date);
  const bw = data.bodyWeights.find((b) => b.date === date);
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const empty = !workouts.length && !sports.length && !bw;
  const isToday = date === pacificDate();

  return (
    <Modal open onClose={onClose} title={formatLong(date)} size="sm">
      <div className="day">
        {empty ? (
          <p className="muted">Nothing logged{isToday ? " yet today" : " on this day"}.</p>
        ) : (
          <ul className="day-list">
            {workouts.map((s) => (
              <li key={s.id}>
                <button onClick={then(() => openWorkout(s.id))}>
                  <IconTrain />
                  <span>
                    <strong>{s.name}</strong>
                    <span className="muted small">{Math.round((s.finishedAt - s.startedAt) / 60_000)} min</span>
                  </span>
                </button>
              </li>
            ))}
            {sports.map((a) => (
              <li key={a.id}>
                <button onClick={then(() => openActivity({ id: a.id }))}>
                  <SportIcon sport={a.sport} />
                  <span>
                    <strong>{SPORT_BY_ID[a.sport].name}</strong>
                    <span className="muted small">{activityLine(a, data.settings.distanceUnit)}</span>
                  </span>
                </button>
              </li>
            ))}
            {bw && (
              <li>
                <button onClick={then(() => openBodyWeight(date))}>
                  <IconScale />
                  <span>
                    <strong>Bodyweight {bw.kg != null ? `${fmtWeight(bw.kg, unit)} ${unit}` : ""}</strong>
                    {bw.note && <span className="muted small">{bw.note}</span>}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
        <h3>Log for this day</h3>
        <div className="sport-chips wrap">
          <button className="chip" onClick={then(() => openPastWorkout(date))}>
            <IconPlus /> Workout
          </button>
          {SPORTS.map((s) => (
            <button key={s.id} className="chip sport-chip" onClick={then(() => openActivity({ sport: s.id, date }))}>
              <SportIcon sport={s.id} /> {s.short}
            </button>
          ))}
          {!bw && (
            <button className="chip" onClick={then(() => openBodyWeight(date))}>
              <IconScale /> Bodyweight
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
