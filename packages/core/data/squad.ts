import type { CharacterStart, ClassData, ClassId, FormationPlace } from '../src/state';

/**
 * The three places of the triangle, in the order of the active three (D-025).
 * With the starting family these are the squad test's numbers for each class.
 */
export const FORMATION: readonly FormationPlace[] = [
  { startOffset: { x: 0, z: 0 }, slot: { forward: 2.4, side: 0 } },
  { startOffset: { x: -4.4, z: 4.2 }, slot: { forward: -2.6, side: -4.6 } },
  { startOffset: { x: 4.4, z: 4.2 }, slot: { forward: -2.6, side: 4.6 } },
];

/**
 * The family a new game starts with, in order, which sets IDs and places (decision 2).
 * The names are placeholders until names are chosen (decision 3).
 */
export const STARTING_FAMILY: readonly CharacterStart[] = [
  { classId: 'fighter', name: 'Aurelio' },
  { classId: 'sniper', name: 'Inês' },
  { classId: 'healer', name: 'Mireille' },
];

/**
 * The squad test's classes. Speeds are per second. Weapon values now sit on each
 * class's starting weapon type in `data/items.ts` (decision 10).
 */
export const CLASSES: Readonly<Record<ClassId, ClassData>> = {
  fighter: {
    speed: 11,
    health: 1700,
    mana: 0,
    armourScale: 1.35,
    autoHeals: false,
    aggroRange: 15,
    attackMoveRange: 8,
    arts: ['swordplay'],
    startingItems: { 'main-hand': 'sword', chest: 'metal-chest', gloves: 'metal-gloves', boots: 'metal-boots' },
  },
  sniper: {
    speed: 11.5,
    health: 950,
    mana: 0,
    armourScale: 0.75,
    autoHeals: false,
    aggroRange: 25,
    attackMoveRange: 20,
    arts: ['marksmanship'],
    startingItems: { 'main-hand': 'rifle', chest: 'leather-chest', gloves: 'leather-gloves', boots: 'leather-boots' },
  },
  healer: {
    speed: 11.5,
    health: 900,
    mana: 400,
    armourScale: 0.7,
    autoHeals: true,
    aggroRange: 22,
    attackMoveRange: 0,
    arts: ['mending'],
    startingItems: { 'main-hand': 'staff', chest: 'coat-chest', gloves: 'coat-gloves', boots: 'coat-boots' },
  },
};
