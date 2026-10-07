export type CareerState =
  | "PRESEASON"
  | "ACTIVE_SEASON"
  | "MID_SEASON_CONTRACT_WINDOW"
  | "END_OF_SEASON_SPONSOR_WINDOW"
  | "END_OF_SEASON_CONTRACT_WINDOW"
  | "SEASON_COMPLETE";

export const PLAYER_TEAM_ID = "PLAYER";
/** Pseudo driver representing the player themselves in results and standings. */
export const PLAYER_DRIVER_ID = "PLAYER_DRIVER";

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
  /** POINT_FINISHES is checked automatically at the end of the season */
  objectiveType?: MajorObjectiveType;
  /** number of top-10 finishes the team needs (POINT_FINISHES) */
  objectiveCount?: number;
};

export type MinorObjectiveType =
  | "FINISH_POSITION"
  | "AHEAD_OF_TEAM"
  | "AHEAD_OF_TEAMMATE"
  | "BEAT_POSITION_GAINS"
  | "TEAM_POINTS"
  | "MANUAL";

export type MajorObjectiveType = "MANUAL" | "POINT_FINISHES";

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
  /** points the team must score in one race (TEAM_POINTS) */
  objectivePoints?: number;
  /** paid every race while contracted */
  raceReward: number;
  /** extra paid for every race where the goal is met */
  goalBonus?: number;
  minCompetitiveness: number;
  operationsUnlock?: number;
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
  /** legacy: contract cost is now derived from the rating and F1 years */
  contractCost?: number;
};

export type Team = {
  id: string;
  name: string;
  nationality: string;
  powerUnitId: string;
  colour: string;
  /** inactive teams stay in the database but are skipped when picking teams */
  active?: boolean;
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

/** Names the player has raced under, recognised in result files. */
export type PlayerName = {
  id: string;
  name: string;
  nationality: string;
};

export type StartingTier = {
  id: string;
  label: string;
  startingCash: number;
  /** legacy, no longer edited */
  startingCompetitiveness?: number;
  /** upgrades the team starts with in every department (0-20) */
  startingUpgrades?: number;
  /** minor sponsor slots the team starts with (0-7) */
  minorSlots?: number;
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
  playerNames: PlayerName[];
  season1: Season1Entry[];
  startingTiers: StartingTier[];
  prizeMoney: PrizeMoneyRow[];
  /** cost of a driver rated 80; every 10 rating points multiplies it by 1.75 */
  contractCostBase: number;
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
  /** money paid out for this race (taken back if the result is removed) */
  earned?: number;
  /** entered by hand in calendar debugging mode */
  manual?: boolean;
  /** driverId -> teamId at the moment this race was run (points go to that team) */
  teams?: Record<string, string>;
};

/** Frozen copy of everything a past season referenced, so history never breaks. */
export type SeasonSnapshot = {
  drivers: Record<string, { firstName: string; lastName: string; nationality: string }>;
  teams: Record<string, { name: string; colour: string }>;
  tracks: Record<string, { country: string; city: string }>;
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
  snapshot?: SeasonSnapshot;
};

export type CareerData = {
  db: CareerDatabases;
  team: {
    name: string;
    colour: string;
    /** text colour used on the dashboard */
    secondaryColour?: string;
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
  /** money made from the most recent race upload; null between seasons */
  lastRaceEarnings: number | null;
  /** unlocked minor sponsor slots; undefined on older careers = all 7 */
  minorSlots?: number;
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
/** price of minor sponsor slot 1..7 */
export const MINOR_SLOT_COSTS = [200000, 500000, 750000, 1000000, 2000000, 5000000, 10000000];
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** Contract cost defaults: rating 80 -> $6m, rating 90 -> $10.5m. */
export const DEFAULT_CONTRACT_BASE = 6000000;
export const F1_YEAR_BONUS = 250000;

export const emptyDatabases = (): CareerDatabases => ({
  majorSponsors: [],
  minorSponsors: [],
  drivers: [],
  teams: [],
  powerUnits: [],
  tracks: [],
  playerNames: [],
  season1: [],
  startingTiers: [
    { id: "small", label: "Small", startingCash: 5000000, startingUpgrades: 0, minorSlots: 2 },
    { id: "medium", label: "Medium", startingCash: 12000000, startingUpgrades: 2, minorSlots: 3 },
    { id: "big", label: "Big", startingCash: 25000000, startingUpgrades: 4, minorSlots: 4 },
  ],
  prizeMoney: [],
  contractCostBase: DEFAULT_CONTRACT_BASE,
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
  lastRaceEarnings: null,
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
  | "playerNames"
  | "tracks";
