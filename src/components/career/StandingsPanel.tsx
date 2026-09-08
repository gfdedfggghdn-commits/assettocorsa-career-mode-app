import { useState } from "react";
import { constructorStandings, driverStandings } from "@/lib/career/engine";
import type { CareerData } from "@/lib/career/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function StandingsPanel({ data }: { data: CareerData }) {
  const seasons = data.seasons;
  const [index, setIndex] = useState(Math.max(0, seasons.length - 1));
  const [view, setView] = useState<"drivers" | "constructors">("drivers");
  const season = seasons[Math.min(index, seasons.length - 1)];

  if (!season) return <p className="text-sm text-muted-foreground">No season has started yet.</p>;

  const rows = view === "drivers" ? driverStandings(data, season) : constructorStandings(data, season);
  const trackName = (id: string) => {
    const t = data.db.tracks.find((x) => x.id === id);
    return t ? t.country : "?";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            className="disabled:opacity-30"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            aria-label="Previous season"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="headline text-2xl">Season {season.number}</span>
          <button
            className="disabled:opacity-30"
            disabled={index >= seasons.length - 1}
            onClick={() => setIndex(index + 1)}
            aria-label="Next season"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="flex gap-1 rounded-md bg-surface-2 p-1">
          {(["drivers", "constructors"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`label-caps rounded px-3 py-1.5 ${
                view === v ? "bg-primary text-primary-foreground" : "hover:text-foreground"
              }`}
            >
              {v === "drivers" ? "Drivers" : "Constructors"}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="label-caps px-2 py-2 text-right">#</th>
              <th className="label-caps sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left">
                {view === "drivers" ? "Driver" : "Team"}
              </th>
              {season.calendar.map((id, i) => (
                <th key={i} className="label-caps px-2 py-2 text-center whitespace-nowrap">
                  <span className="block font-mono text-[10px] opacity-60">R{i + 1}</span>
                  {trackName(id)}
                </th>
              ))}
              <th className="label-caps px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="sticky left-0 z-10 bg-surface-1 px-3 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-1 rounded-sm"
                      style={{ background: r.colour }}
                      aria-hidden
                    />
                    {r.label}
                  </span>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-2 py-2 text-center font-mono">
                    {c ?? ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-bold">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
