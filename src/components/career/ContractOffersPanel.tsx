import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currentSeason, midSeasonRound } from "@/lib/career/engine";
import { addOffer, objectiveText } from "@/lib/career/driver";
import { Flag } from "@/lib/career/flags";
import type { CareerData, DriverRole } from "@/lib/career/types";
import { Plus } from "lucide-react";

export function ContractOffersPanel({ data, update }: { data: CareerData; update: (fn: (d: CareerData) => void) => void }) {
  const [selected, setSelected] = useState<string | null>(null); const [debug, setDebug] = useState(false);
  const [teamId, setTeamId] = useState(""); const [role, setRole] = useState<DriverRole>(2);
  const season = currentSeason(data); if (!season) return null;
  const offers = season.offers ?? []; const offer = offers.find(o => o.id === selected); const team = data.db.teams.find(t => t.id === offer?.teamId);
  const locked = offers.some(o => o.status === "accepted"); const windowOpen = season.results.length >= midSeasonRound(season.calendar.length);
  return <section className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="headline text-2xl">Contract offers</h2><Button size="sm" variant="secondary" onClick={() => setDebug(true)}><Plus className="mr-2 size-4" />Debug offer</Button></header>
    {!windowOpen && <p className="text-sm text-muted-foreground">The contract window opens at the halfway point.</p>}
    {locked && <p className="text-sm text-success">Your team for next season is confirmed.</p>}
    {[...offers].reverse().map(o => { const t = data.db.teams.find(t => t.id === o.teamId); return <Button key={o.id} variant="secondary" className={`h-auto w-full justify-start gap-3 py-4 whitespace-normal ${o.status === "declined" ? "opacity-40" : ""}`} onClick={() => setSelected(o.id)}>
      <Flag nationality={t?.nationality ?? ""} /><span className="h-6 w-1.5 shrink-0" style={{ backgroundColor: t?.colour }} /><span className="headline text-xl">{t?.name ?? "Former team"}</span><span className="ml-auto text-right text-sm">{o.role === 1 ? "1st" : "2nd"} driver · {o.status}<span className="block text-xs text-muted-foreground">Round {o.roundReceived}</span></span>
    </Button>; })}
    {!offers.length && <p className="text-sm text-muted-foreground">No contract offers received.</p>}
    <Dialog open={!!offer} onOpenChange={o => { if (!o) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle className="headline text-2xl">{team?.name}</DialogTitle></DialogHeader>
      <div className="space-y-3"><Flag nationality={team?.nationality ?? ""} /><div>Nationality: {team?.nationality}</div><div className="flex items-center gap-2">Colour: <span className="h-4 w-8" style={{ backgroundColor: team?.colour }} /></div><div>Power unit: {data.db.powerUnits.find(p => p.id === team?.powerUnitId)?.name ?? "—"}</div><div>Role: {offer?.role === 1 ? "1st" : "2nd"} driver</div><div>Objective: {objectiveText(team?.objectivePosition)}</div></div>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || !windowOpen || offer?.status !== "pending"} onClick={() => { update(next => { const sea = currentSeason(next); const o = sea?.offers?.find(x => x.id === selected); if (o && !sea?.offers?.some(x => x.status === "accepted")) o.status = "accepted"; }); setSelected(null); }}>Accept</Button><Button variant="secondary" disabled={locked || offer?.status !== "pending"} onClick={() => { update(next => { const o = currentSeason(next)?.offers?.find(x => x.id === selected); if (o) o.status = "declined"; }); setSelected(null); }}>Decline</Button><Button variant="ghost" onClick={() => setSelected(null)}>Go back</Button></div>
    </DialogContent></Dialog>
    <Dialog open={debug} onOpenChange={setDebug}><DialogContent><DialogHeader><DialogTitle>Add contract offer</DialogTitle></DialogHeader>
      <select aria-label="Offer team" className="h-9 rounded-md border border-input bg-surface-2 px-2" value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Choose team</option>{data.db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <div className="flex gap-2">{([1, 2] as const).map(r => <Button key={r} variant={role === r ? "default" : "secondary"} onClick={() => setRole(r)}>{r === 1 ? "1st" : "2nd"} driver</Button>)}</div><Button disabled={!teamId} onClick={() => { update(next => { const sea = currentSeason(next); if (sea) addOffer(sea, teamId, role, "debug"); }); setDebug(false); }}>Add offer</Button>
    </DialogContent></Dialog>
  </section>;
}