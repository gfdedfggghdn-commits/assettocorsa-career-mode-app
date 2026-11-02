import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currentSeason, driverStandings, midSeasonRound, seasonDriverInfo } from "@/lib/career/engine";
import { h2h } from "@/lib/career/driver";
import { Flag } from "@/lib/career/flags";
import { PLAYER_DRIVER_ID, type CareerData, type SeasonRecord } from "@/lib/career/types";
import { UserPlus } from "lucide-react";

export function HeadToHeadPanel({ data, update }: { data: CareerData; update: (fn: (d: CareerData) => void) => void }) {
  const [open, setOpen] = useState(false); const [candidate, setCandidate] = useState<string | null>(null);
  const season = currentSeason(data);
  if (!season) return null;
  const available = !season.completed && (season.rivalSelectionRequired || season.results.length >= midSeasonRound(season.calendar.length));
  return <section className="space-y-5"><h2 className="headline text-2xl">Head to head</h2><div className="grid gap-5 lg:grid-cols-2">
    <H2HCard data={data} season={season} other={season.teamMateId} title="Team-mate" start={season.teamMateStartRound ?? 1} />
      <H2HCard data={data} season={season} other={season.rivalId ?? null} title="Rival" start={season.rivalStartRound ?? 1}>
      {!season.rivalId && <Button disabled={!available} onClick={() => setOpen(true)} variant="secondary"><UserPlus className="mr-2 size-4" />{available ? "Select rival" : "Locked until halfway"}</Button>}
    </H2HCard>
  </div>
    <Dialog open={open && !candidate} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Choose your rival</DialogTitle></DialogHeader>
      {driverStandings(data, season).filter(r => r.id !== PLAYER_DRIVER_ID && r.id !== season.teamMateId && !!season.driverTeams[r.id]).map(row => <Button key={row.id} variant="secondary" className="justify-start whitespace-normal" onClick={() => setCandidate(row.id)}><Flag nationality={row.nationality} /><span className="mx-2">{row.label}</span><span className="ml-auto text-muted-foreground">{row.total} pts</span></Button>)}
    </DialogContent></Dialog>
    <Dialog open={!!candidate} onOpenChange={o => { if (!o) setCandidate(null); }}><DialogContent><DialogHeader><DialogTitle>Make {candidate ? seasonDriverInfo(data, season, candidate).name : ""} your rival?</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">This choice is locked for the rest of the season.</p><div className="flex gap-2"><Button variant="secondary" onClick={() => setCandidate(null)}>Go back</Button><Button onClick={() => {
        if (!candidate) return;
        update(next => { const sea = currentSeason(next); if (!sea || sea.rivalId) return; sea.rivalId = candidate; sea.rivalStartRound = sea.results.length + 1; sea.rivalSelectionRequired = false; });
        setCandidate(null); setOpen(false);
      }}>Confirm rival</Button></div>
    </DialogContent></Dialog>
  </section>;
}

function H2HCard({ data, season, other, title, start, children }: { data: CareerData; season: SeasonRecord; other?: string | null; title: string; start: number; children?: React.ReactNode }) {
  const stats = h2h(season, other, start); const player = seasonDriverInfo(data, season, PLAYER_DRIVER_ID);
  const rival = other ? seasonDriverInfo(data, season, other) : { name: "Not selected", nationality: "" };
  const winning = (stats.total[0] ?? 0) > (stats.total[1] ?? 0); const losing = (stats.total[0] ?? 0) < (stats.total[1] ?? 0);
  return <article className="panel overflow-hidden"><h3 className={`headline px-5 py-3 text-xl ${title === "Team-mate" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>{title}</h3>
    <div className="grid grid-cols-2 gap-4 p-5">{[player, rival].map((info, i) => { const words = info.name.split(" "); const surname = words.pop() ?? ""; return <div key={i} className={i ? "min-w-0 text-right" : "min-w-0"}><Flag nationality={info.nationality} /><p className="mt-2 break-words text-sm">{words.join(" ")}</p><p className="headline break-words text-xl">{surname.toUpperCase()}</p></div>; })}</div>
    <div className="divide-y divide-border">{([ ["POINTS", stats.points], ["FINISHING POSITION", stats.finishes], ["PODIUMS", stats.podiums], ["TOTAL", stats.total] ] as [string, number[]][]).map(([label, values]) => <div key={label} className={`grid grid-cols-[3rem_1fr_3rem] items-center px-4 py-3 ${label === "TOTAL" ? winning ? "bg-success text-success-foreground" : losing ? "bg-destructive text-destructive-foreground" : "" : ""}`}><span className="font-mono text-lg font-bold">{values[0]}</span><span className="label-caps text-center text-current">{label}</span><span className="text-right font-mono text-lg font-bold">{values[1]}</span></div>)}</div>
    {children && <div className="p-4">{children}</div>}
  </article>;
}