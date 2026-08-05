const DAYS_SHOWN = 30;

export type DayCount = { day: string; count: number };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fills gaps so a quiet day is a gap in the chart, not a missing bar. */
function toSeries(rows: DayCount[], days: number): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r.count]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = isoDay(d);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="font-display text-2xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function SiteStats({
  views,
  taps,
  published,
}: {
  views: DayCount[];
  taps: Record<string, number>;
  published: boolean;
}) {
  const series = toSeries(views, DAYS_SHOWN);
  const total = series.reduce((a, b) => a + b.count, 0);
  const thisWeek = series.slice(-7).reduce((a, b) => a + b.count, 0);
  const lastWeek = series.slice(-14, -7).reduce((a, b) => a + b.count, 0);
  const peak = Math.max(1, ...series.map((s) => s.count));

  const trend =
    lastWeek === 0
      ? thisWeek > 0
        ? "first visitors this week"
        : "no visits yet"
      : thisWeek >= lastWeek
        ? `up from ${lastWeek} last week`
        : `down from ${lastWeek} last week`;

  if (!published) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-paper p-5">
        <p className="font-display text-sm font-semibold tracking-tight">
          how your site is doing
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Nothing to show yet. Publish the site and this fills in with who
          visited and what they tapped.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="font-display text-sm font-semibold tracking-tight">
        how your site is doing
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat
          value={thisWeek.toLocaleString()}
          label={`visit${thisWeek === 1 ? "" : "s"} this week`}
          hint={trend}
        />
        <Stat
          value={(taps.call ?? 0).toLocaleString()}
          label="tapped your phone"
          hint="people trying to call"
        />
        <Stat
          value={(taps.directions ?? 0).toLocaleString()}
          label="asked for directions"
          hint="opened your map link"
        />
        <Stat
          value={total.toLocaleString()}
          label="visits in 30 days"
          hint="everyone who opened it"
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-paper p-4">
        <div className="flex h-24 items-end gap-[3px]" aria-hidden="true">
          {series.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.count}`}
              className="flex-1 rounded-t-sm bg-flame/70"
              // A day with no visits still gets a sliver, so the row reads as
              // a timeline rather than a gap.
              style={{
                height: `${Math.max(2, Math.round((d.count / peak) * 100))}%`,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-faint">
          <span>30 days ago</span>
          <span>today</span>
        </div>
        <p className="sr-only">
          {total} visits over the last {DAYS_SHOWN} days, {thisWeek} of them in
          the last seven.
        </p>
      </div>
    </div>
  );
}
