export function WeeklyDeficit({
  deficit,
  goal,
  hasMissingDays,
}: {
  /** Sum of (calorie burn goal - consumed) from this week's Monday through the selected date */
  deficit: number;
  /** null when the user hasn't set a weekly deficit goal */
  goal: number | null;
  hasMissingDays: boolean;
}) {
  return (
    <section className="weekly-deficit" aria-label="Weekly deficit">
      <div className="weekly-deficit-label">Weekly deficit</div>
      <div className="weekly-deficit-value">
        {deficit} <span className="weekly-deficit-unit">kcal</span>
      </div>
      {goal !== null &&
        (deficit >= goal ? (
          <div className="weekly-deficit-goal">
            Goal met ({goal} kcal) — {Math.round((deficit - goal) * 10) / 10} kcal extra
          </div>
        ) : (
          <div className="weekly-deficit-goal">
            {Math.round((goal - deficit) * 10) / 10} kcal to go to hit your {goal} kcal goal
          </div>
        ))}
      {hasMissingDays && (
        <p className="weekly-deficit-disclaimer">
          Some days this week are missing log entries, so this may not reflect your full week.
        </p>
      )}
    </section>
  );
}
