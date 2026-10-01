import {
  BASE_UPGRADE_COST,
  DEFAULT_CONTRACT_BASE,
  F1_YEAR_BONUS,
  MAX_UPGRADES,
  PLAYER_DRIVER_ID,
  PLAYER_TEAM_ID,
  POINTS,
  type CareerData,
  type CareerDatabases,
  type Development,
  type Driver,
  type SeasonRecord,
  type SeasonSnapshot,
} from "./types";

export const money = (n: number) =>
  (n < 0 ? "-" : "") +
  "$" +
  Math.abs(Math.round(n)).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const driverName = (d: Driver) => `${d.firstName} ${d.lastName.toUpperCase()}`;

/** F1 experience deliberately excluded — it only feeds the contract cost. */
export const overallRating = (d: Driver) => {
  const weighted = (d.racecraft * 3 + d.pace * 2 + d.aggressiveness * 2) / 7;
  return Math.round(weighted * 10) / 10;
};

/** Rating 80 costs the base value; every 10 rating points multiplies it by 1.75. */
export const CONTRACT_GROWTH = Math.pow(1.75, 1 / 10);

export function driverCost(db: CareerDatabases, d: Driver): number {
  const base = db.contractCostBase || DEFAULT_CONTRACT_BASE;
  const skill = base * Math.pow(CONTRACT_GROWTH, overallRating(d) - 80);
  return Math.round((skill + (d.f1Years || 0) * F1_YEAR_BONUS) / 1000) * 1000;
}

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

/* ---------------- history-safe lookups ---------------- */

export const playerLabel = (data: CareerData) => data.db.playerNames[0]?.name || "You";
export const playerNationality = (data: CareerData) => data.db.playerNames[0]?.nationality ?? "";

/** Freezes the current names/colours of everything this season uses. */
export function captureSnapshot(data: CareerData, season: SeasonRecord) {
  const snap: SeasonSnapshot = season.snapshot ?? { drivers: {}, teams: {}, tracks: {} };
  const ids = new Set<string>([
    ...Object.keys(season.driverTeams),
    ...season.results.flatMap((r) => Object.keys(r.positions)),
  ]);
  for (const d of data.db.drivers) if (ids.has(d.id)) ids.add(d.id);
  for (const id of ids) {
    const d = data.db.drivers.find((x) => x.id === id);
    if (d) snap.drivers[id] = { firstName: d.firstName, lastName: d.lastName, nationality: d.nationality };
  }
  for (const t of data.db.teams) {
    if (Object.values(season.driverTeams).includes(t.id)) {
      snap.teams[t.id] = { name: t.name, colour: t.colour };
    }
  }
  for (const trackId of season.calendar) {
    const t = data.db.tracks.find((x) => x.id === trackId);
    if (t) snap.tracks[trackId] = { country: t.country, city: t.city };
  }
  season.snapshot = snap;
}

export function seasonDriverInfo(
  data: CareerData,
  season: SeasonRecord,
  id: string,
): { name: string; nationality: string } {
  if (id === PLAYER_DRIVER_ID) {
    return { name: playerLabel(data).toUpperCase(), nationality: playerNationality(data) };
  }
  const live = data.db.drivers.find((d) => d.id === id);
  if (live) return { name: driverName(live), nationality: live.nationality };
  const snap = season.snapshot?.drivers[id];
  if (snap) return { name: `${snap.firstName} ${snap.lastName.toUpperCase()}`, nationality: snap.nationality };
  return { name: "Unknown driver", nationality: "" };
}

export function seasonTeamInfo(
  data: CareerData,
  season: SeasonRecord,
  teamId: string | undefined,
): { name: string; colour: string } {
  if (!teamId) return { name: "Free Agent", colour: "transparent" };
  if (teamId === PLAYER_TEAM_ID) return { name: data.team.name || "My Team", colour: data.team.colour || "#e10600" };
  const live = data.db.teams.find((t) => t.id === teamId);
  if (live) return { name: live.name, colour: live.colour };
  const snap = season.snapshot?.teams[teamId];
  if (snap) return { name: snap.name, colour: snap.colour };
  return { name: "Former team", colour: "#888888" };
}

export function seasonTrackInfo(
  data: CareerData,
  season: SeasonRecord,
  trackId: string,
): { country: string; city: string } {
  const live = data.db.tracks.find((t) => t.id === trackId);
  if (live) return { country: live.country, city: live.city };
  const snap = season.snapshot?.tracks[trackId];
  if (snap) return snap;
  return { country: "", city: "" };
}

/* ---------------- competitiveness ---------------- */

/** Average finishing position per team across all completed rounds of a season. */
export function teamAverageFinish(season: SeasonRecord): Record<string, number> {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const race of season.results) {
    for (const [driverId, pos] of Object.entries(race.positions)) {
      const teamId = season.driverTeams[driverId];
      if (!teamId) continue;
      sums[teamId] ??= { total: 0, count: 0 };
      sums[teamId]!.total += pos;
      sums[teamId]!.count += 1;
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
  sponsor: { minCompetitiveness: number; operationsUnlock?: number },
  comp: number,
  operations: number,
) {
  if ((sponsor.operationsUnlock ?? 0) > 0 && operations >= (sponsor.operationsUnlock ?? 0)) return true;
  return comp >= sponsor.minCompetitiveness;
}

/* ---------------- standings ---------------- */

export type StandingRow = {
  id: string;
  label: string;
  nationality: string;
  teamName: string;
  colour: string;
  cells: (number | null)[];
  /** how often this entrant finished P1, P2, P3 … used for countback */
  posCounts: number[];
  total: number;
};

const COUNTBACK_DEPTH = 30;

/** Points first, then most 1st places, most 2nd places, and so on. */
function compareRows(a: StandingRow, b: StandingRow) {
  if (b.total !== a.total) return b.total - a.total;
  for (let i = 0; i < COUNTBACK_DEPTH; i++) {
    const diff = (b.posCounts[i] ?? 0) - (a.posCounts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.label.localeCompare(b.label);
}

/** All entrant ids that took part in a season, including the player. */
export function seasonDriverIds(data: CareerData, season: SeasonRecord): string[] {
  const ids = new Set<string>([PLAYER_DRIVER_ID]);
  for (const id of Object.keys(season.driverTeams)) ids.add(id);
  for (const r of season.results) for (const id of Object.keys(r.positions)) ids.add(id);
  for (const d of data.db.drivers) if (season.driverTeams[d.id]) ids.add(d.id);
  return [...ids];
}

export function driverStandings(data: CareerData, season: SeasonRecord): StandingRow[] {
  const rounds = season.calendar.length;
  const rows: StandingRow[] = seasonDriverIds(data, season).map((id) => {
    const cells: (number | null)[] = Array.from({ length: rounds }, () => null);
    const posCounts: number[] = Array.from({ length: COUNTBACK_DEPTH }, () => 0);
    let total = 0;
    let raced = false;
    for (const race of season.results) {
      const pos = race.positions[id];
      if (pos != null) {
        cells[race.round - 1] = pos;
        total += pointsFor(pos);
        if (pos >= 1 && pos <= COUNTBACK_DEPTH) posCounts[pos - 1] = (posCounts[pos - 1] ?? 0) + 1;
        raced = true;
      }
    }
    const teamId = season.driverTeams[id];
    const info = seasonDriverInfo(data, season, id);
    const team = seasonTeamInfo(data, season, teamId);
    return {
      id,
      label: info.name,
      nationality: info.nationality,
      teamName: team.name,
      colour: team.colour,
      cells,
      posCounts,
      total,
      _raced: raced,
    } as StandingRow & { _raced: boolean };
  });
  return rows
    .filter((r) => (r as StandingRow & { _raced: boolean })._raced || season.driverTeams[r.id])
    .sort(compareRows);
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
    const posCounts: number[] = Array.from({ length: COUNTBACK_DEPTH }, () => 0);
    let total = 0;
    for (const race of season.results) {
      let pts = 0;
      let scored = false;
      for (const [driverId, pos] of Object.entries(race.positions)) {
        if (season.driverTeams[driverId] === teamId) {
          pts += pointsFor(pos);
          scored = true;
          if (pos >= 1 && pos <= COUNTBACK_DEPTH) posCounts[pos - 1] = (posCounts[pos - 1] ?? 0) + 1;
        }
      }
      if (scored) {
        cells[race.round - 1] = pts;
        total += pts;
      }
    }
    const info = seasonTeamInfo(data, season, teamId);
    return {
      id: teamId,
      label: info.name,
      nationality: "",
      teamName: info.name,
      colour: info.colour,
      cells,
      posCounts,
      total,
    };
  });
  return rows.sort(compareRows);
}

export function constructorPosition(data: CareerData, season: SeasonRecord): number {
  const rows = constructorStandings(data, season);
  const idx = rows.findIndex((r) => r.id === PLAYER_TEAM_ID);
  return idx === -1 ? rows.length : idx + 1;
}

export function driverPositionOf(data: CareerData, season: SeasonRecord, id: string | null): number | null {
  if (!id) return null;
  const idx = driverStandings(data, season).findIndex((r) => r.id === id);
  return idx === -1 ? null : idx + 1;
}

export function prizeMoneyFor(data: CareerData, position: number): number {
  return data.db.prizeMoney.find((p) => p.position === position)?.amount ?? 0;
}

/** Drivers racing for the player's own team this season. */
export function playerDriverIds(season: SeasonRecord): string[] {
  const ids = Object.entries(season.driverTeams)
    .filter(([, t]) => t === PLAYER_TEAM_ID)
    .map(([id]) => id);
  if (!ids.includes(PLAYER_DRIVER_ID)) ids.push(PLAYER_DRIVER_ID);
  return ids;
}

export type MinorOutcome = { id: string; name: string; met: boolean; reward: number };

/** Checks each contracted minor sponsor's race objective against one race's positions. */
export function evaluateMinorSponsors(
  data: CareerData,
  season: SeasonRecord,
  positions: Record<string, number>,
): MinorOutcome[] {
  const teamMateId = season.teamMateId;
  const myBest = positions[PLAYER_DRIVER_ID] ?? null;

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
    out.push({
      id: s.id,
      name: s.name,
      met,
      reward: (s.raceReward || 0) + (met ? s.goalBonus || 0 : 0),
    });
  }
  return out;
}

/** Income for a single race: major sponsor retainer plus each minor sponsor's race income and any goal bonus earned. */
export function raceIncome(
  data: CareerData,
  season: SeasonRecord,
  positions?: Record<string, number>,
): number {
  const major = data.db.majorSponsors.find((s) => s.id === season.majorSponsorId);
  let income = major?.weeklyIncome ?? 0;
  if (!positions) return income;
  for (const o of evaluateMinorSponsors(data, season, positions)) income += o.reward;
  return income;
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
