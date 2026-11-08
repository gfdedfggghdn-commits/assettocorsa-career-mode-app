import { POINTS, type CareerDatabases, type PointsSystem, type Team } from "./types";

export const POINTS_PRESETS: PointsSystem[] = [
  { id: "modern-f1", name: "Modern F1 (race finish)", points: [...POINTS] },
  { id: "pre-2010-f1", name: "F1 2003–2009", points: [10, 8, 6, 5, 4, 3, 2, 1] },
  { id: "indycar", name: "IndyCar (race finish)", points: [50, 40, 35, 32, 30, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
];

export function selectedPointsSystem(db: CareerDatabases): PointsSystem {
  return structuredClone((db.pointsSystems ?? POINTS_PRESETS).find(s => s.id === db.selectedPointsSystemId) ?? { id: "modern-f1", name: "Modern F1 (race finish)", points: [...POINTS] });
}

export function teamIdentity(team: Team, seasonNumber: number) {
  const state = team.states?.find(s => s.id === team.seasonStates?.[String(seasonNumber)]);
  return state ? { name: state.name, colour: state.colour } : { name: team.name, colour: team.colour };
}

/** Keep all existing team pickers in sync without changing the team's stable id. */
export function applyTeamStates(db: CareerDatabases, seasonNumber: number) {
  for (const team of db.teams) Object.assign(team, teamIdentity(team, seasonNumber));
}

export const DEFAULT_REPUTATION_RULES = {
  beatTeamMate: 25, loseToTeamMate: 15, beatObjective: 100, missObjective: 75,
  beatExpectation: 50, missExpectation: 30, beatAverage: 5, beatRival: 15, loseToRival: 10,
};