/** The squad test's movement values. Times are seconds, and speeds are per second. */
export const MOVEMENT = {
  /** Closer than this counts as arriving. */
  arriveDistance: 0.9,
  /** A unit must get this much closer than its best so far to count as progress. */
  minProgress: 0.25,
  /** Time without progress along its route before a unit gives up. */
  giveUpSeconds: 0.7,
  /** An idle unit further than this from its slot walks back. */
  slotReturnDistance: 2.2,
  /** Gap between units in a line. */
  lineSpacing: 4,
  /** A move closer than this to the squad's centre keeps the old heading. */
  minHeadingDistance: 1,
  /** Stands in for a distance of zero when dividing by it. */
  zeroDistance: 0.1,
  /** Units closer than this push apart. */
  unitSpacing: 1.8,
  /** Share of the overlap pushed away per second. */
  pushRate: 6,
  /** Units closer than this have no direction to push in. */
  minPushDistance: 0.01,
  /** How far a unit stays from an obstacle's edge. */
  unitRadius: 0.7,
  /** Units closer than this to an obstacle's centre have no direction to leave in. */
  minObstacleDistance: 0.001,
};

export const SCATTER = {
  cooldownSeconds: 5,
  dashSeconds: 0.3,
  dashSpeed: 32,
  invulnerableSeconds: 0.45,
  /** A unit this close to the centre has no direction of its own, so it uses a sector. */
  minCentreDistance: 1,
  sectors: 3,
};

/** Each zone's walkable grid (D-023). Cells are square, this many world units across. */
export const GRID = { cell: 1 };

/** How units follow routes. */
export const ROUTE = {
  /** A goal that has moved less than this keeps its route, and the route's end follows it. */
  goalDrift: 2,
  /** Each monster may search for a route this often, at most (D-060). */
  monsterSearchSeconds: 0.5,
};
