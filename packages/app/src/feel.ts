/**
 * The squad test's hand-tuned feel, carried over unchanged (decision 6). Every
 * value the hands can feel lives here, and nowhere else in input or camera code.
 */
export interface Feel {
  readonly camera: {
    /** Distance from the ground point it looks at, from fully in to fully out. */
    readonly nearest: number;
    readonly farthest: number;
    /** Tilt in radians, from fully in to fully out. */
    readonly tiltIn: number;
    readonly tiltOut: number;
    /** The player's own tilt on top, and the limits on the total. */
    readonly tiltAdjustLeast: number;
    readonly tiltAdjustMost: number;
    readonly tiltLeast: number;
    readonly tiltMost: number;
    /** 0 is fully in and 1 fully out. */
    readonly startZoom: number;
    readonly zoomStep: number;
    /** Per second. */
    readonly zoomEasing: number;
    /** World units a second, from fully in to fully out. */
    readonly panSlowest: number;
    readonly panFastest: number;
    /** Radians a second. */
    readonly rotateKeys: number;
    /** Radians a pixel of middle drag. */
    readonly dragRotate: number;
    readonly dragTilt: number;
    /** Per second. */
    readonly followEasing: number;
    /** How far beyond the zone's size the camera may look (decision 7). */
    readonly margin: number;
  };
  readonly pointer: {
    /** Pixels a press moves before it becomes a drag. */
    readonly dragThreshold: number;
    /** Pixels from a character or enemy that still counts as clicking it. */
    readonly characterRadius: number;
    readonly enemyRadius: number;
    /** Pixels from an NPC that still counts as hovering or clicking it (S3e decision 2). */
    readonly npcRadius: number;
    /** Pixels around a box that still count as inside it. */
    readonly boxMargin: number;
  };
  readonly slowTime: {
    /** Share of normal speed while slowed. */
    readonly share: number;
    /** Seconds of slow time when full. */
    readonly limit: number;
    /** Seconds regained each second when not slowed. */
    readonly recharge: number;
  };
  /** On a crit, ticks run slower for a moment (S2.3b decision 2). */
  readonly hitStop: {
    /** Game seconds it lasts. */
    readonly seconds: number;
    /** Share of normal speed while it lasts. */
    readonly share: number;
  };
  /** The camera shakes on big hits (S2.3b decision 14). Strength is from 0 to 1. */
  readonly shake: {
    readonly hurt: number;
    readonly slam: number;
    readonly boss: number;
    readonly blast: number;
    readonly interrupt: number;
    /** Strength lost each second. */
    readonly fade: number;
    /** World units of jolt at full strength, which grows with the square of strength. */
    readonly reach: number;
  };
  /** A frame never counts as longer than this, so a stall cannot jump the game ahead. */
  readonly longestFrame: number;
}

export const FEEL: Feel = {
  camera: {
    nearest: 34,
    farthest: 150,
    tiltIn: 0.82,
    tiltOut: 1.2,
    tiltAdjustLeast: -0.5,
    tiltAdjustMost: 0.4,
    tiltLeast: 0.5,
    tiltMost: 1.4,
    startZoom: 0.34,
    zoomStep: 0.08,
    zoomEasing: 9,
    panSlowest: 36,
    panFastest: 125,
    rotateKeys: 1.7,
    dragRotate: 0.006,
    dragTilt: 0.004,
    followEasing: 4,
    margin: 20,
  },
  pointer: {
    dragThreshold: 6,
    characterRadius: 34,
    enemyRadius: 36,
    npcRadius: 34,
    boxMargin: 8,
  },
  slowTime: {
    share: 0.3,
    limit: 6,
    recharge: 0.45,
  },
  hitStop: {
    seconds: 0.05,
    share: 0.15,
  },
  shake: {
    hurt: 0.3,
    slam: 0.7,
    boss: 1,
    blast: 1,
    interrupt: 0.5,
    fade: 2.4,
    reach: 1.3,
  },
  longestFrame: 0.05,
};
