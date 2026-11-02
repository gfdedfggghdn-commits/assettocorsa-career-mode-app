import { currentSeason, driverPositionOf, driverStandings, midSeasonRound, pointsFor, uid } from "./engine";
import { PLAYER_DRIVER_ID, type CareerData, type ContractOffer, type DriverRole, type SeasonRecord } from "./types";

export const isDriverCareer = (data: CareerData) => data.mode === "driver";
export const isRealistic = (data: CareerData) => isDriverCareer(data) && data.driverCareer?.contractSystem !== "basic";
export const clampReputation = (value: number) => Math.max(0, Math.min(1000, value));
export const clampChance = (value: number) => Math.max(5, Math.min(100, value));
export const objectiveText = (position?: number) => `Finish ${position ?? 20}${ordinalSuffix(position ?? 20)} in the drivers' championship`;
function ordinalSuffix(n: number) { return n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"); }

export function h2h(season: SeasonRecord, otherId: string | null | undefined, startRound = 1) {
  const totals: Record<"points" | "finishes" | "podiums" | "total", [number, number]> = { points: [0, 0], finishes: [0, 0], podiums: [0, 0], total: [0, 0] };
  if (!otherId) return totals;
  for (const race of season.results.filter(r => r.round >= startRound)) {
    const a = race.positions[PLAYER_DRIVER_ID]; const b = race.positions[otherId];
    if (a == null || b == null) continue;
    totals.points[0] += pointsFor(a); totals.points[1] += pointsFor(b);
    if (a < b) totals.finishes[0]++; else if (b < a) totals.finishes[1]++;
    if (a <= 3) totals.podiums[0]++; if (b <= 3) totals.podiums[1]++;
  }
  for (const values of [totals.points, totals.finishes, totals.podiums]) {
    if ((values[0] ?? 0) > (values[1] ?? 0)) totals.total[0]++;
    else if ((values[1] ?? 0) > (values[0] ?? 0)) totals.total[1]++;
  }
  return totals;
}

export function addOffer(season: SeasonRecord, teamId: string, role: DriverRole, source: ContractOffer["source"], replaceDriverId?: string) {
  season.offers ??= [];
  if (source !== "debug" && season.offers.some(o => o.teamId === teamId && o.source === source)) return;
  season.offers.push({ id: uid(), teamId, role, source, ...(replaceDriverId ? { replaceDriverId } : {}), roundReceived: season.results.length, status: "pending" });
}

export function requiredReputation(data: CareerData, teamId: string) {
  const team = data.db.teams.find(t => t.id === teamId);
  const academy = (data.db.academies ?? []).find(a => a.id === data.driverCareer?.academyId);
  const discount = academy && team?.academyId === academy.id ? academy.reputationDiscount : 0;
  return Math.max(0, (team?.contractRequirement ?? 0) - discount);
}

export function advanceDriverRace(data: CareerData, season: SeasonRecord, positions: Record<string, number>, random = Math.random) {
  const driver = data.driverCareer;
  if (!driver) return;
  const realistic = isRealistic(data);
  const old = driver.reputation;
  const rules = data.db.reputationRules ?? { beatTeamMate: 25, loseToTeamMate: 15, beatObjective: 100, missObjective: 75 };
  const a = positions[PLAYER_DRIVER_ID]; const b = season.teamMateId ? positions[season.teamMateId] : undefined;
  if (realistic && a != null && b != null && a !== b)
    driver.reputation = clampReputation(driver.reputation + (a < b ? rules.beatTeamMate : -rules.loseToTeamMate));
  const count = season.results.length; const half = midSeasonRound(season.calendar.length);
  if (realistic && !season.teamRolls) {
    season.teamRolls = {}; season.offerRounds = {};
    for (const team of data.db.teams.filter(t => t.active !== false)) {
      season.teamRolls[team.id] = random() * 100 < clampChance(data.db.contractChance ?? 50);
      season.offerRounds[team.id] = half + Math.floor(random() * Math.max(1, season.calendar.length - half + 1));
    }
  }
  if (count >= half && !season.rivalId) season.rivalSelectionRequired = true;
  const final = count >= season.calendar.length;
  if (realistic && final && !season.reputationFinalized) {
    const pos = driverPositionOf(data, season, PLAYER_DRIVER_ID);
    driver.reputation = clampReputation(driver.reputation + (pos != null && pos <= (season.objectivePosition ?? 20) ? rules.beatObjective : -rules.missObjective));
    season.reputationFinalized = true;
  }
  if (realistic && count >= half) {
    for (const team of data.db.teams.filter(t => t.active !== false)) {
      if (season.teamRolls?.[team.id] && driver.reputation >= requiredReputation(data, team.id) && count >= (season.offerRounds?.[team.id] ?? half))
        addOffer(season, team.id, 2, "chance");
    }
  }
  if (realistic && final && !season.h2hOffersFinalized) {
    const mate = h2h(season, season.teamMateId, season.teamMateStartRound ?? 1);
    if ((mate.total[0] ?? 0) > (mate.total[1] ?? 0) && season.playerTeamId) addOffer(season, season.playerTeamId, 1, "teammate");
    const rival = h2h(season, season.rivalId, season.rivalStartRound ?? half + 1);
    const rivalTeam = season.rivalId ? season.driverTeams[season.rivalId] : undefined;
    if ((rival.total[0] ?? 0) > (rival.total[1] ?? 0) && rivalTeam)
      addOffer(season, rivalTeam, season.driverRoles?.[season.rivalId ?? ""] ?? 2, "rival", season.rivalId ?? undefined);
    season.h2hOffersFinalized = true;
  }
  driver.lastReputationChange = realistic ? driver.reputation - old : null;
}

export function transferPlayer(data: CareerData, season: SeasonRecord, teamId: string) {
  if (!data.driverCareer) return;
  // Freeze all already-raced affiliations before changing the current lineup.
  for (const race of season.results) {
    race.teams ??= {};
    for (const id of Object.keys(race.positions)) if (!(id in race.teams)) race.teams[id] = id === PLAYER_DRIVER_ID ? season.playerTeamId ?? "" : season.driverTeams[id] ?? "";
  }
  season.playerTeamId = teamId; season.driverTeams[PLAYER_DRIVER_ID] = teamId;
  data.driverCareer.teamId = teamId;
  season.teamMateId = Object.keys(season.driverTeams).find(id => id !== PLAYER_DRIVER_ID && season.driverTeams[id] === teamId) ?? null;
  season.teamMateStartRound = season.results.length + 1;
  season.rivalId = null; delete season.rivalStartRound; season.rivalSelectionRequired = true;
}

export function startDriverSeason(data: CareerData, number: number, calendar: string[], selectedTeam: string) {
  const driver = data.driverCareer;
  if (!driver) throw new Error("Choose a driver career first.");
  const previous = currentSeason(data);
  const accepted = previous?.offers?.find(o => o.status === "accepted");
  const teamId = accepted?.teamId ?? selectedTeam;
  const team = data.db.teams.find(t => t.id === teamId && t.active !== false);
  if (!team) throw new Error("Choose an active team.");
  const mapping: Record<string, string> = previous ? { ...previous.driverTeams } : Object.fromEntries(data.db.season1.flatMap(e => e.driverIds.filter(Boolean).map(id => [id, e.teamId])));
  delete mapping[PLAYER_DRIVER_ID];
  const role = accepted?.role ?? driver.role;
  const teammates = Object.keys(mapping).filter(id => mapping[id] === teamId);
  const sameTeam = previous?.playerTeamId === teamId;
  const replaced = accepted?.replaceDriverId ?? (!sameTeam ? teammates.find(id => (previous?.driverRoles?.[id] ?? (teammates.indexOf(id) + 1)) === role) : undefined);
  if (replaced) delete mapping[replaced];
  mapping[PLAYER_DRIVER_ID] = teamId;
  driver.teamId = teamId; driver.role = role; driver.academyLocked = true; driver.lastReputationChange = null;
  if (number === 1) driver.reputation = clampReputation(team.startingReputation ?? 0);
  const driverRoles: Record<string, DriverRole> = {};
  for (const t of data.db.teams) Object.keys(mapping).filter(id => mapping[id] === t.id).forEach((id, i) => { driverRoles[id] = id === PLAYER_DRIVER_ID ? role : (i === 0 ? 1 : 2); });
  const mate = Object.keys(mapping).find(id => id !== PLAYER_DRIVER_ID && mapping[id] === teamId) ?? null;
  if (mate) driverRoles[mate] = role === 1 ? 2 : 1;
  const season: SeasonRecord = { number, calendar, results: [], driverTeams: mapping, playerTeamId: teamId, playerRole: role, driverRoles,
    objectivePosition: team.objectivePosition ?? 20, teamMateId: mate, majorSponsorId: null, minorSponsorIds: [], powerUnitId: team.powerUnitId,
    contractWindowMode: "END", midSeasonWindowUsed: false, completed: false, majorObjectiveMet: null, offers: [], rivalId: null, teamMateStartRound: 1 };
  data.seasons.push(season);
  return season;
}