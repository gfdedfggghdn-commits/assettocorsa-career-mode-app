import {
  BASE_UPGRADE_COST,
  MAX_UPGRADES,
  PLAYER_TEAM_ID,
  POINTS,
  type CareerData,
  type Development,
  type Driver,
  type SeasonRecord,
} from "./types";

export const money = (n: number) =>
  (n < 0 ? "-" : "") +
  "$" +
  Math.abs(Math.round(n)).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const driverName = (d: Driver) => `${d.firstName} ${d.lastName.toUpperCase()}`;

export const overallRating = (d: Driver) => {
  const weighted = (d.racecraft * 3 + d.pace * 2 + d.aggressiveness * 2) / 7;
  return Math.round((weighted + (d.f1Years || 0)) * 10) / 10;
};

export const pointsFor = (position: number) => POINTS[position - 1] ?? 0;

export const currentSeason = (data: CareerData): SeasonRecord | undefined =>
  data.seasons[data.seasons.length - 1];

export const seasonByNumber = (data: CareerData, n: number) =>
  data.seasons.find((s) => s.number === n);

export const midSeasonRound = (calendarLength: number) => Math.ceil(calendarLength / 2);

export const totalUpgrades = (dev: Development) =>
  dev.powerUnit + dev.chassis + dev.operations + dev.infrastructure;

export const developmentPercentage = (dev: Development) =>
  totalUpgrades(dev) / (MAX_UPGRADES * 4);

export const upgradeCost = (level: number, dev: Development, section: keyof Development) => {
  const base = BASE_UPGRADE_COST * Math.pow(1.15, level);
  if (section === "infrastructure") return Math.round(base);
  const discount = Math.min(0.75, dev.infrastructure * 0.05);
  return Math.round(base * (1 - discount));
};

export const acRestrictor = (dev: Development) => Math.max(0, 60 - dev.powerUnit * 5);
export const acBallast = (dev: Development) => Math.max(0, 40 - dev.chassis * 2);

/** Average finishing position per team across all completed rounds of a season. */
export function teamAverageFinish(season: SeasonRecord): Record<string, number> {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const race of season.results) {
    for (const [driverId, pos] of Object.entries(race.positions)) {
      const teamId = season.driverTeams[driverId];
      if (!teamId) continue;
      sums[teamId] ??= { total: 0, count: 0 };
      sums[teamId].total += pos;
      sums[teamId].count += 1;
    }
  }
  const out: Record<string, number> = {};
  for (const [teamId, v] of Object.entries(sums)) out[teamId] = v.total / v.count;
  return out;
}

/** 0-100 performance score for the player's team relative to the rest of the field. */
export function performanceScore(season: SeasonRecord | undefined): number | null {
  if (!season || season.results.length === 0) return null;
  const averages = teamAverageFinish(season);
  const mine = averages[PLAYER_TEAM_ID];
  if (mine == null) return null;
  const values = Object.values(averages).sort((a, b) => a - b);
  if (values.length < 2) return 50;
  const best = values[0]!;
  const worst = values[values.length - 1]!;
  if (worst === best) return 50;
  return Math.round(((worst - mine) / (worst - best)) * 100);
}

export function competitiveness(data: CareerData): number {
  const devPct = developmentPercentage(data.development) * 100;
  const season = currentSeason(data);
  const perf = performanceScore(season);
  if (perf === null) {
    const tier = data.db.startingTiers.find((t) => t.id === data.team.startingTierId);
    const base = tier?.startingCompetitiveness ?? 0;
    return Math.max(0, Math.min(100, Math.round(devPct * 0.6 + base * 0.4)));
  }
  return Math.max(0, Math.min(100, Math.round(devPct * 0.6 + perf * 0.4)));
}

export function isMajorSponsorUnlocked(
  sponsor: { minCompetitiveness: number; operationsUnlock: number },
  comp: number,
  operations: number,
) {
  if (sponsor.operationsUnlock > 0 && operations >= sponsor.operationsUnlock) return true;
  return comp >= sponsor.minCompetitiveness;
}

export type StandingRow = {
  id: string;
  label: string;
  colour: string;
  cells: (number | null)[];
  total: number;
};

export function driverStandings(data: CareerData, season: SeasonRecord): StandingRow[] {
  const rounds = season.calendar.length;
  const rows: StandingRow[] = data.db.drivers.map((d) => {
    const cells: (number | null)[] = Array.from({ length: rounds }, () => null);
    let total = 0;
    for (const race of season.results) {
      const pos = race.positions[d.id];
      if (pos != null) {
        cells[race.round - 1] = pos;
        total += pointsFor(pos);
      }
    }
    const teamId = season.driverTeams[d.id];
    return {
      id: d.id,
      label: driverName(d),
      colour: teamColour(data, teamId),
      cells,
      total,
    };
  });
  return rows
    .filter((r) => r.cells.some((c) => c != null) || season.driverTeams[r.id])
    .sort((a, b) => b.total - a.total);
}

export function teamColour(data: CareerData, teamId: string | undefined): string {
  if (!teamId) return "transparent";
  if (teamId === PLAYER_TEAM_ID) return data.team.colour || "#e10600";
  return data.db.teams.find((t) => t.id === teamId)?.colour ?? "#888888";
}

export function teamLabel(data: CareerData, teamId: string | undefined): string {
  if (!teamId) return "Free Agent";
  if (teamId === PLAYER_TEAM_ID) return data.team.name || "My Team";
  return data.db.teams.find((t) => t.id === teamId)?.name ?? "Free Agent";
}

export function constructorStandings(data: CareerData, season: SeasonRecord): StandingRow[] {
  const rounds = season.calendar.length;
  const teamIds = Array.from(new Set(Object.values(season.driverTeams).filter(Boolean)));
  if (!teamIds.includes(PLAYER_TEAM_ID)) teamIds.unshift(PLAYER_TEAM_ID);

  const rows: StandingRow[] = teamIds.map((teamId) => {
    const cells: (number | null)[] = Array.from({ length: rounds }, () => null);
    let total = 0;
    for (const race of season.results) {
      let pts = 0;
      let scored = false;
      for (const [driverId, pos] of Object.entries(race.positions)) {
        if (season.driverTeams[driverId] === teamId) {
          pts += pointsFor(pos);
          scored = true;
        }
      }
      if (scored) {
        cells[race.round - 1] = pts;
        total += pts;
      }
    }
    return { id: teamId, label: teamLabel(data, teamId), colour: teamColour(data, teamId), cells, total };
  });
  return rows.sort((a, b) => b.total - a.total);
}

export function constructorPosition(data: CareerData, season: SeasonRecord): number {
  const rows = constructorStandings(data, season);
  const idx = rows.findIndex((r) => r.id === PLAYER_TEAM_ID);
  return idx === -1 ? rows.length : idx + 1;
}

export function prizeMoneyFor(data: CareerData, position: number): number {
  return data.db.prizeMoney.find((p) => p.position === position)?.amount ?? 0;
}

/** Drivers racing for the player's own team this season. */
export function playerDriverIds(season: SeasonRecord): string[] {
  return Object.entries(season.driverTeams)
    .filter(([, t]) => t === PLAYER_TEAM_ID)
    .map(([id]) => id);
}

export type MinorOutcome = { id: string; name: string; met: boolean; reward: number };

/** Checks each contracted minor sponsor's race objective against one race's positions. */
export function evaluateMinorSponsors(
  data: CareerData,
  season: SeasonRecord,
  positions: Record<string, number>,
): MinorOutcome[] {
  const mine = playerDriverIds(season);
  const teamMateId = season.teamMateId;
  const ownIds = mine.filter((id) => id !== teamMateId);
  const bestOf = (ids: string[]) => {
    const vals = ids.map((id) => positions[id]).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const myBest = bestOf(ownIds.length ? ownIds : mine);

  const out: MinorOutcome[] = [];
  for (const id of season.minorSponsorIds) {
    const s = data.db.minorSponsors.find((x) => x.id === id);
    if (!s) continue;
    const type = s.objectiveType ?? "MANUAL";
    let met = true;
    if (type === "FINISH_POSITION") {
      met = myBest != null && myBest <= (s.objectivePosition ?? 20);
    } else if (type === "AHEAD_OF_TEAMMATE") {
      const mate = teamMateId ? positions[teamMateId] : undefined;
      met = myBest != null && mate != null && myBest < mate;
    } else if (type === "AHEAD_OF_TEAM") {
      const rivals = Object.entries(season.driverTeams)
        .filter(([, t]) => t === s.objectiveTeamId)
        .map(([d]) => positions[d])
        .filter((v): v is number => v != null);
      met = myBest != null && rivals.length > 0 && rivals.some((r) => myBest < r);
    }
    out.push({ id: s.id, name: s.name, met, reward: s.raceReward });
  }
  return out;
}

/** Income for a single race: major sponsor retainer plus every minor sponsor whose goal was met. */
export function raceIncome(
  data: CareerData,
  season: SeasonRecord,
  positions?: Record<string, number>,
): number {
  const major = data.db.majorSponsors.find((s) => s.id === season.majorSponsorId);
  let income = major?.weeklyIncome ?? 0;
  if (!positions) return income;
  for (const o of evaluateMinorSponsors(data, season, positions)) {
    if (o.met) income += o.reward;
  }
  return income;
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
