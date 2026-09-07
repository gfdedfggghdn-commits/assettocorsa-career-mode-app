export type CareerState =
  | "PRESEASON"
  | "ACTIVE_SEASON"
  | "MID_SEASON_CONTRACT_WINDOW"
  | "END_OF_SEASON_SPONSOR_WINDOW"
  | "END_OF_SEASON_CONTRACT_WINDOW"
  | "SEASON_COMPLETE";

export const PLAYER_TEAM_ID = "PLAYER";

export type MajorSponsor = {
  id: string;
  name: string;
  description: string;
  signingBonus: number;
  seasonObjective: string;
  objectiveReward: number;
  weeklyIncome: number;
  minCompetitiveness: number;
  operationsUnlock: number;
};

export type MinorObjectiveType =
  | "FINISH_POSITION"
  | "AHEAD_OF_TEAM"
  | "AHEAD_OF_TEAMMATE"
  | "BEAT_POSITION_GAINS"
  | "MANUAL";

export type MinorSponsor = {
  id: string;
  name: string;
  description: string;
  raceObjective: string;
  /** how the app checks the goal after every race */
  objectiveType?: MinorObjectiveType;
  /** e.g. finish 20th or better */
  objectivePosition?: number;
  /** team whose drivers you must beat (AHEAD_OF_TEAM) */
  objectiveTeamId?: string;
  raceReward: number;
  minCompetitiveness: number;
};


export type Driver = {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  racecraft: number;
  pace: number;
  aggressiveness: number;
  f1Years: number;
  contractCost: number;
};

export type Team = {
  id: string;
  name: string;
  nationality: string;
  powerUnitId: string;
  colour: string;
};

export type PowerUnit = {
  id: string;
  name: string;
  colour: string;
  basePerformance: number;
  baseDurability: number;
  cost: number;
  active: boolean;
};

export type Track = {
  id: string;
  country: string;
  city: string;
  acExactId: string;
  acApproxId: string;
};

export type StartingTier = {
  id: string;
  label: string;
  startingCash: number;
  startingCompetitiveness: number;
};

export type PrizeMoneyRow = { position: number; amount: number };

/** teamId -> driverIds (season 1 line-up) */
export type Season1Entry = { teamId: string; driverIds: string[] };

export type CareerDatabases = {
  majorSponsors: MajorSponsor[];
  minorSponsors: MinorSponsor[];
  drivers: Driver[];
  teams: Team[];
  powerUnits: PowerUnit[];
  tracks: Track[];
  season1: Season1Entry[];
  startingTiers: StartingTier[];
  prizeMoney: PrizeMoneyRow[];
};

export type Development = {
  powerUnit: number;
  chassis: number;
  operations: number;
  infrastructure: number;
};

export type RaceResult = {
  round: number;
  trackId: string;
  /** driverId -> finishing position (1-based) */
  positions: Record<string, number>;
  uploadedAt: string;
  sourceKey: string;
};

export type SeasonRecord = {
  number: number;
  calendar: string[];
  results: RaceResult[];
  /** driverId -> teamId | PLAYER_TEAM_ID  (snapshot that stays true for this season) */
  driverTeams: Record<string, string>;
  majorSponsorId: string | null;
  minorSponsorIds: (string | null)[];
  teamMateId: string | null;
  powerUnitId: string | null;
  contractWindowMode: "END" | "MID_AND_END";
  midSeasonWindowUsed: boolean;
  completed: boolean;
  majorObjectiveMet: boolean | null;
};

export type CareerData = {
  db: CareerDatabases;
  team: {
    name: string;
    colour: string;
    description: string;
    startingTierId: string | null;
  };
  cash: number;
  development: Development;
  seasons: SeasonRecord[];
  preseasonPhase: number;
  /** carried into the upcoming season while still in the windows */
  pendingMajorSponsorId: string | null;
  pendingTeamMateId: string | null;
};

export type Career = {
  id: string;
  name: string;
  state: CareerState;
  season: number;
  data: CareerData;
};

export const MAX_UPGRADES = 20;
export const BASE_UPGRADE_COST = 250000;
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const emptyDatabases = (): CareerDatabases => ({
  majorSponsors: [],
  minorSponsors: [],
  drivers: [],
  teams: [],
  powerUnits: [],
  tracks: [],
  season1: [],
  startingTiers: [
    { id: "small", label: "Small", startingCash: 5000000, startingCompetitiveness: 20 },
    { id: "medium", label: "Medium", startingCash: 12000000, startingCompetitiveness: 40 },
    { id: "big", label: "Big", startingCash: 25000000, startingCompetitiveness: 60 },
  ],
  prizeMoney: [],
});

export const emptyCareerData = (): CareerData => ({
  db: emptyDatabases(),
  team: { name: "", colour: "#e10600", description: "", startingTierId: null },
  cash: 0,
  development: { powerUnit: 0, chassis: 0, operations: 0, infrastructure: 0 },
  seasons: [],
  preseasonPhase: 1,
  pendingMajorSponsorId: null,
  pendingTeamMateId: null,
});

export type SetKind =
  | "majorSponsors"
  | "minorSponsors"
  | "drivers"
  | "teams"
  | "powerUnits"
  | "season1"
  | "startingTiers"
  | "prizeMoney"
  | "tracks";
