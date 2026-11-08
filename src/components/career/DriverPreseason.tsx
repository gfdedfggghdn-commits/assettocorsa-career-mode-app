import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatabasesPanel } from "./DatabasesPanel";
import { Flag } from "@/lib/career/flags";
import { captureSnapshot, currentSeason } from "@/lib/career/engine";
import { objectiveText, startDriverSeason } from "@/lib/career/driver";
import type { Career, CareerData } from "@/lib/career/types";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DriverPreseason({ career, persist, start }: { career: Career; persist: (data: CareerData) => Promise<void>; start: (data: CareerData) => Promise<void> }) {
  const [data, setData] = useState(() => structuredClone(career.data));
  const [phase, setPhase] = useState(career.data.preseasonPhase || 1);
  const [calendar, setCalendar] = useState<string[]>(currentSeason(career.data)?.calendar ?? []);
  const [track, setTrack] = useState("");
  const [busy, setBusy] = useState(false);
  const [databaseDirty, setDatabaseDirty] = useState(false);
  const previous = currentSeason(data);
  const accepted = previous?.offers?.find(o => o.status === "accepted");
  const update = async (fn: (d: CareerData) => void) => { const next = structuredClone(data); fn(next); await persist(next); setData(next); };
  const teamId = accepted?.teamId ?? data.driverCareer?.teamId;
  return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
    <header><p className="label-caps">Driver Career · Season {career.season}</p><h1 className="headline text-4xl">{career.name}</h1></header>
    <nav className="flex flex-wrap gap-2">{["Databases", "Team & Academy", "Calendar"].map((label, i) => <Button key={label} disabled={databaseDirty && i !== 0} variant={phase === i + 1 ? "default" : "secondary"} onClick={() => setPhase(i + 1)}>{i + 1}. {label}</Button>)}</nav>
    {phase === 1 && <DatabasesPanel data={data} update={update} seasonNumber={career.season} onDirtyChange={setDatabaseDirty} />}
    {phase === 2 && <div className="space-y-6">
      <h2 className="headline text-2xl">Your team</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.db.teams.filter(t => t.active !== false).map(team => <Button key={team.id}
        variant="secondary" disabled={data.driverCareer?.contractSystem === "realistic" && !!previous && teamId !== team.id} aria-pressed={teamId === team.id}
        className={`relative h-auto min-h-36 justify-start overflow-hidden p-5 text-left whitespace-normal ${teamId === team.id ? "ring-2 ring-primary" : ""}`}
        onClick={() => update(d => { if (d.driverCareer) d.driverCareer.teamId = team.id; })}>
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: team.colour }} />
        <span className="space-y-2"><Flag nationality={team.nationality} /><span className="headline block text-2xl">{team.name}</span><span className="block text-sm text-muted-foreground">{objectiveText(team.objectivePosition)}</span></span>
      </Button>)}</div>
      {data.driverCareer?.contractSystem === "realistic" && <div className="space-y-3">
        <h2 className="headline text-2xl">Driver academy</h2>
        <div className="flex flex-wrap gap-2"><Button variant={!data.driverCareer.academyId ? "default" : "secondary"} disabled={data.driverCareer.academyLocked} onClick={() => update(d => { if (d.driverCareer) d.driverCareer.academyId = null; })}>No academy</Button>
          {(data.db.academies ?? []).map(academy => <Button key={academy.id} disabled={data.driverCareer?.academyLocked} variant={data.driverCareer?.academyId === academy.id ? "default" : "secondary"}
            onClick={() => update(d => { if (d.driverCareer) d.driverCareer.academyId = academy.id; })}><span className="mr-2 h-4 w-1" style={{ backgroundColor: academy.colour }} />{academy.name}</Button>)}
        </div><p className="text-xs text-muted-foreground">{data.driverCareer.academyLocked ? "Your academy membership is permanent." : "Academy selection becomes permanent when season 1 starts."}</p>
      </div>}
    </div>}
    {phase === 3 && <section className="space-y-5">
      <h2 className="headline text-2xl">Season calendar</h2>
      <p className="text-sm text-muted-foreground">Choose your rival after the halfway point, before the next race.{data.driverCareer?.contractSystem === "realistic" && " Contract offers arrive between halfway and the final race, for the following season."}</p>
      <div className="divide-y divide-border">{calendar.map((id, i) => <div key={`${id}-${i}`} className="flex items-center gap-3 py-3"><span className="font-mono">R{i + 1}</span><Flag nationality={data.db.tracks.find(t => t.id === id)?.country ?? ""} /><span className="flex-1">{data.db.tracks.find(t => t.id === id)?.country}</span><Button size="icon" variant="ghost" aria-label={`Remove round ${i + 1}`} onClick={() => setCalendar(calendar.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>)}</div>
      <div className="flex gap-2"><Label className="sr-only" htmlFor="driver-track">Track</Label><select id="driver-track" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-surface-2 px-2" value={track} onChange={e => setTrack(e.target.value)}><option value="">Select a track</option>{data.db.tracks.map(t => <option key={t.id} value={t.id}>{t.country} · {t.city}</option>)}</select><Button disabled={!track} onClick={() => { setCalendar([...calendar, track]); setTrack(""); }}><Plus className="mr-2 size-4" />Add</Button></div>
    </section>}
    <footer className="flex justify-between gap-4"><Button variant="secondary" disabled={phase === 1 || busy} onClick={() => setPhase(phase - 1)}>Back</Button><Button disabled={busy || databaseDirty} onClick={async () => {
      if (phase === 2 && !teamId) { toast.error("Choose your team."); return; }
      if (phase === 3 && (!calendar.length || !teamId || !data.db.playerNames[0]?.name)) { toast.error("Choose a team, add your driver name and at least one race."); return; }
      setBusy(true);
      try {
        if (phase < 3) { const next = { ...data, preseasonPhase: phase + 1 }; await persist(next); setPhase(phase + 1); }
        else { const next = structuredClone(data); const season = startDriverSeason(next, career.season, calendar, teamId ?? ""); captureSnapshot(next, season); await start(next); }
      } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save your season."); } finally { setBusy(false); }
    }}>{phase === 3 ? <><Check className="mr-2 size-4" />Start season {career.season}</> : "Confirm"}</Button></footer>
  </main>;
}