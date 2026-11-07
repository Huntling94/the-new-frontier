/** The nine spells, from the squad test. Times are seconds. */
export const SPELLS = {
  taunt: { cooldownSeconds: 9, mana: 0, radius: 17, seconds: 5 },
  cleave: {
    cooldownSeconds: 5,
    mana: 0,
    radius: 7.5,
    sizeShare: 0.6,
    multiplier: 2.3,
    knockback: 26,
  },
  guard: { cooldownSeconds: 13, mana: 0, seconds: 4 },
  'aimed-shot': { cooldownSeconds: 6, mana: 0, multiplier: 4.2 },
  'crippling-shot': { cooldownSeconds: 9, mana: 0, multiplier: 1, slowSeconds: 4 },
  volley: {
    cooldownSeconds: 12,
    mana: 0,
    strikeSeconds: [0.15, 0.45, 0.75],
    radius: 8,
    sizeShare: 0.5,
    multiplier: 1.15,
  },
  mend: {
    cooldownSeconds: 3.5,
    mana: 50,
    pointRadius: 8,
    healthShare: 0.5,
    attackShare: 2,
  },
  rally: { cooldownSeconds: 16, mana: 50, seconds: 8 },
  revive: { cooldownSeconds: 26, mana: 100, healthShare: 0.5, invulnerableSeconds: 1.5 },
};
