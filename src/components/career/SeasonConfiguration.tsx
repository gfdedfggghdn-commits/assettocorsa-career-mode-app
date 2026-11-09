import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityEditor } from "./EntityEditor";
import { POINTS_PRESETS, selectedPointsSystem, teamIdentity } from "@/lib/career/configuration";
import { uid } from "@/lib/career/engine";
import type { CareerDatabases, TeamIdentity } from "@/lib/career/types";
import { Plus, Trash2 } from "lucide-react";

type Props = { db: CareerDatabases; seasonNumber: number; patch: (fn: (db: CareerDatabases) => void) => void };
export function SeasonConfiguration({ db, seasonNumber, patch }: Props) {
  const systems = db.pointsSystems ?? POINTS_PRESETS;
  const selected = selectedPointsSystem(db);
  const edit = (fn: (system: typeof selected) => void) => patch(d => {
    d.pointsSystems ??= structuredClone(POINTS_PRESETS);
    d.selectedPointsSystemId = selected.id;
    const system = d.pointsSystems.find(s => s.id === selected.id);
    if (system) fn(system);
  });
  return <div className="space-y-6">
    <section className="space-y-4 border-y border-border py-5">
      <h3 className="headline text-xl">Points system · Season {seasonNumber}</h3>
      <p className="text-sm text-muted-foreground">Race-finishing points only; qualifying, fastest-lap and laps-led bonuses are not included. Changes apply to the next season you start; existing seasons keep their points.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1"><Label htmlFor="points-system">Selected system</Label><select id="points-system" className="h-9 w-full rounded-md border border-input bg-surface-2 px-2" value={selected.id} onChange={e => patch(d => { d.selectedPointsSystemId = e.target.value; })}>{systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <Button variant="secondary" onClick={() => patch(d => { d.pointsSystems ??= structuredClone(POINTS_PRESETS); const system = { ...structuredClone(selected), id: uid(), name: "Custom points" }; d.pointsSystems.push(system); d.selectedPointsSystemId = system.id; })}><Plus className="mr-2 size-4" />Custom system</Button>
        <Button variant="secondary" onClick={() => patch(d => { d.pointsSystems = [...(d.pointsSystems ?? []).filter(s => !POINTS_PRESETS.some(p => p.id === s.id)), ...structuredClone(POINTS_PRESETS)]; const first = POINTS_PRESETS[0]?.id; if (first) d.selectedPointsSystemId = first; })}>Restore presets</Button>
      </div>
      <Label htmlFor="points-name">System name</Label><Input id="points-name" value={selected.name} onChange={e => edit(s => { s.name = e.target.value; })} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">{selected.points.map((points, index) => <div key={index}><Label htmlFor={`points-${index}`}>P{index + 1}</Label><Input id={`points-${index}`} type="number" min={0} value={points} onChange={e => edit(s => { s.points[index] = Math.max(0, Number(e.target.value) || 0); })} /></div>)}</div>
      <div className="flex gap-2"><Button variant="secondary" onClick={() => edit(s => { s.points.push(0); })}><Plus className="mr-2 size-4" />Position</Button><Button variant="ghost" disabled={selected.points.length <= 1} onClick={() => edit(s => { s.points.pop(); })}><Trash2 className="mr-2 size-4" />Last position</Button></div>
    </section>
    <section className="space-y-4">
      <h3 className="headline text-xl">Team states · Season {seasonNumber}</h3>
      {db.teams.map(team => <div key={team.id} className="space-y-3 border-b border-border pb-5">
        <EntityEditor<TeamIdentity> title={team.name || "Unnamed team"} rows={team.states ?? []} fields={[{ key: "name", label: "State name" }, { key: "colour", label: "Colour", type: "color" }]} makeEmpty={() => ({ id: uid(), name: team.name, colour: team.colour })} onChange={rows => patch(d => { const t = d.teams.find(t => t.id === team.id); if (t) t.states = rows; })} />
        <Label htmlFor={`state-${team.id}`}>State for season {seasonNumber}</Label><select id={`state-${team.id}`} className="h-9 w-full rounded-md border border-input bg-surface-2 px-2" value={team.seasonStates?.[String(seasonNumber)] ?? ""} onChange={e => patch(d => { const t = d.teams.find(t => t.id === team.id); if (!t) return; t.seasonStates ??= {}; t.seasonStates[String(seasonNumber)] = e.target.value; Object.assign(t, teamIdentity(t, seasonNumber)); })}><option value="">Current team name and colour</option>{team.states?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>)}
    </section>
  </div>;
}