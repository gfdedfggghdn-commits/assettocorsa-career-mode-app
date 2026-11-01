import { currentSeason, driverStandings, seasonDriverInfo, seasonTeamInfo } from "@/lib/career/engine";
import { objectiveText } from "@/lib/career/driver";
import { Flag } from "@/lib/career/flags";
import { PLAYER_DRIVER_ID, type CareerData } from "@/lib/career/types";

export function SeasonOverviewPanel({ data }: { data: CareerData }) {
  const season = currentSeason(data);
  if (!season) return null;
  const team = seasonTeamInfo(data, season, season.playerTeamId);
  const standings = driverStandings(data, season);
  const ids = season.playerRole === 1 ? [PLAYER_DRIVER_ID, season.teamMateId] : [season.teamMateId, PLAYER_DRIVER_ID];
  return <section className="space-y-5"><h2 className="headline border-l-4 pl-3 text-3xl" style={{ borderColor: team.colour }}>{team.name}</h2>
    <div className="grid gap-4 md:grid-cols-2">{ids.map((id, index) => {
      const info = id ? seasonDriverInfo(data, season, id) : { name: "Vacant seat", nationality: "" };
      const rank = standings.findIndex(row => row.id === id);
      return <article key={index} className="panel space-y-4 p-5"><h3 className="headline flex items-center gap-2 text-2xl"><Flag nationality={info.nationality} />{info.name}</h3>
        <dl className="space-y-2 text-sm"><div>Role: {index + 1}{index === 0 ? "st" : "nd"} driver</div><div>Objective: {objectiveText(season.objectivePosition)}</div><div>Points: {standings[rank]?.total ?? 0}</div><div>Championship standing: {rank >= 0 ? `P${rank + 1}` : "—"}</div></dl></article>;
    })}</div>
  </section>;
}