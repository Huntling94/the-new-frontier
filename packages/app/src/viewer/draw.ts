import {
  cardOf,
  characterOf,
  currentZone,
  rimRadiusAt,
  zoneGrid,
  type GameView,
  type Point,
} from '@new-frontier/core';
import { basinSetting, type BasinSetting } from '@new-frontier/render';

/** Something brief to show on the map: a word or number, and perhaps a ring. */
export interface Mark {
  readonly x: number;
  readonly z: number;
  readonly text: string;
  readonly colour: string;
  /** Tick at which it goes. */
  readonly until: number;
  readonly ring: boolean;
}

const RIM_POINTS = 180;
/** World units from the centre to the canvas edge. */
const VIEW_RADIUS = 112;
/** A town is smaller, so the viewer comes closer (S3d). */
const TOWN_VIEW_RADIUS = 64;
/** A basin fills its 240 by 240 footprint (M1), so the viewer takes in all of it. */
const BASIN_VIEW_RADIUS = 124;
const UNIT_RADIUS = 11;
const BAR_WIDTH = 30;
const BAR_HEIGHT = 5;
const ENEMY_SIZE = 9;
const SHOT_RADIUS = 3;
const MARK_RING_RADIUS = 34;
const VOLLEY_RING_RADIUS = 40;
const DOWN_COLOUR = '#5a6268';
const HEALTH_COLOUR = '#7fdc8c';
const LOW_HEALTH_COLOUR = '#ef6a54';
const LOW_HEALTH_SHARE = 0.3;
const MANA_COLOUR = '#6aa8ef';
const GUARD_COLOUR = '#8fd6c4';
const RALLY_COLOUR = '#ffb648';
const SHOT_COLOUR = '#ffe2a8';
const ASLEEP_COLOUR = '#6d5a4a';
const TELEGRAPH_COLOUR = '#ff5a3c';
const TELEGRAPH_FILL_OPACITY = 0.3;
const ENEMY_SHOT_COLOUR = '#c86aa8';
const ENEMY_SHOT_RADIUS = 4;
const DROP_RADIUS = 3;
const DROP_COLOURS = { marks: '#ffcf6e', potion: '#ff9aa8' };

/** The Healer's mana, for its bar. */

const GROUND_COLOUR = '#6f6488';
const WALL_COLOUR = '#3a3540';
/** Cells a character cannot stand in, and the corners of each live route (decision 14). */
const CLOSED_COLOUR = '#ff5a3c55';
const ENEMY_ONLY_COLOUR = '#ffb64833';
const ROUTE_DASH = [6, 4];
const CORNER_RADIUS = 3;
const GATE_COLOUR = '#8fd6c4';
const LAKE_COLOUR = '#6fa3c4';
const ROAD_COLOUR = '#ffe2a8';
const SIDE_ROUTE_COLOUR = '#ffe2a8aa';
const PLAN_DASH = [10, 6];

const OBSTACLE_COLOURS = {
  stone: '#9a96a0',
  rock: '#7c786c',
  beacon: '#d8b878',
  fountain: '#7fb8d8',
};

/** A town's lots: the door, a tick the way it faces, and its ID (S3d). */
const LOT_COLOUR = '#ffcf6e';
const LOT_TICK = 3;

const ENEMY_LOOKS = {
  dummy: { colour: '#b0653a', letter: 'D', scale: 1.3 },
  wasp: { colour: '#e2b024', letter: 'w', scale: 0.7 },
  rooster: { colour: '#d86a4a', letter: 'r', scale: 1 },
  viper: { colour: '#7ab060', letter: 'v', scale: 1 },
  boar: { colour: '#8a6a58', letter: 'B', scale: 1.5 },
  boss: { colour: '#ffb648', letter: 'W', scale: 2.6 },
};

const UNIT_LOOKS = {
  fighter: { colour: '#c8553d', letter: 'F' },
  sniper: { colour: '#3f7fb0', letter: 'S' },
  healer: { colour: '#e8dfc4', letter: 'H' },
};

function drawBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  share: number,
  colour: string,
): void {
  context.fillStyle = '#000000aa';
  context.fillRect(x - BAR_WIDTH / 2, y, BAR_WIDTH, BAR_HEIGHT);
  context.fillStyle = colour;
  context.fillRect(x - BAR_WIDTH / 2, y, BAR_WIDTH * share, BAR_HEIGHT);
}

function drawRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string,
): void {
  context.strokeStyle = colour;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.stroke();
}

function drawTelegraph(
  context: CanvasRenderingContext2D,
  entry: GameView['live']['scheduled'][number],
  toX: (x: number) => number,
  toY: (z: number) => number,
  scale: number,
): void {
  if (entry.kind === 'volley-strike') {
    drawRing(context, toX(entry.x), toY(entry.z), VOLLEY_RING_RADIUS, SHOT_COLOUR);
    return;
  }
  const filled = 1 - entry.ticks / entry.totalTicks;
  context.fillStyle = TELEGRAPH_COLOUR;
  context.strokeStyle = TELEGRAPH_COLOUR;
  context.lineWidth = 2;
  if (entry.kind === 'slam') {
    const radius = entry.radius * scale;
    drawRing(context, toX(entry.x), toY(entry.z), radius, TELEGRAPH_COLOUR);
    context.globalAlpha = TELEGRAPH_FILL_OPACITY;
    context.beginPath();
    context.arc(toX(entry.x), toY(entry.z), radius * filled, 0, 2 * Math.PI);
    context.fill();
    context.globalAlpha = 1;
    return;
  }
  context.save();
  context.translate(toX(entry.x), toY(entry.z));
  context.rotate(entry.angle);
  const length = entry.length * scale;
  const width = entry.width * scale;
  context.strokeRect(0, -width / 2, length, width);
  context.globalAlpha = TELEGRAPH_FILL_OPACITY;
  context.fillRect(0, -width / 2, length * filled, width);
  context.restore();
}

function healthColour(share: number): string {
  return share < LOW_HEALTH_SHARE ? LOW_HEALTH_COLOUR : HEALTH_COLOUR;
}

/** The grid's closed cells, drawn once per zone, since the grid never changes while it runs. */
let gridLayer: { readonly zone: string; readonly canvas: HTMLCanvasElement } | null = null;

function gridImage(game: GameView, size: number, toX: (x: number) => number, toY: (z: number) => number): HTMLCanvasElement {
  const zone = currentZone(game);
  if (gridLayer?.zone === zone.id && gridLayer.canvas.width === size) {
    return gridLayer.canvas;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const grid = zoneGrid(game);
  for (let row = 0; context && row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const flags = grid.flags[row * grid.cols + col] ?? 0;
      if (flags % 2 === 1) continue;
      // Open to enemies only: inside an obstacle's margin, where enemies still slide round.
      context.fillStyle = flags >= 2 ? ENEMY_ONLY_COLOUR : CLOSED_COLOUR;
      const x = toX(grid.minX + col * grid.cell);
      const y = toY(grid.minZ + row * grid.cell);
      context.fillRect(x, y, toX(grid.minX + (col + 1) * grid.cell) - x, toY(grid.minZ + (row + 1) * grid.cell) - y);
    }
  }
  gridLayer = { zone: zone.id, canvas };
  return canvas;
}

function drawGround(context: CanvasRenderingContext2D, game: GameView, toX: (x: number) => number, toY: (z: number) => number): void {
  const { ground } = currentZone(game);
  context.fillStyle = GROUND_COLOUR;
  if (ground.shape === 'island') {
    context.beginPath();
    for (let index = 0; index < RIM_POINTS; index += 1) {
      const angle = (index / RIM_POINTS) * 2 * Math.PI;
      const radius = rimRadiusAt(ground.island, angle);
      context.lineTo(toX(ground.island.x + Math.cos(angle) * radius), toY(ground.island.z + Math.sin(angle) * radius));
    }
    context.closePath();
    context.fill();
    return;
  }
  const box = (b: { minX: number; maxX: number; minZ: number; maxZ: number }): void => {
    context.fillRect(toX(b.minX), toY(b.minZ), toX(b.maxX) - toX(b.minX), toY(b.maxZ) - toY(b.minZ));
  };
  if (ground.shape === 'streets') {
    // The blocks between the streets are dark, and the streets and places are ground.
    context.fillStyle = WALL_COLOUR;
    box(ground.bounds);
    context.save();
    context.beginPath();
    context.rect(toX(ground.bounds.minX), toY(ground.bounds.minZ), toX(ground.bounds.maxX) - toX(ground.bounds.minX), toY(ground.bounds.maxZ) - toY(ground.bounds.minZ));
    context.clip();
    context.fillStyle = GROUND_COLOUR;
    context.strokeStyle = GROUND_COLOUR;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const { points, width } of ground.streets) {
      context.lineWidth = toX(width) - toX(0);
      context.beginPath();
      for (const point of points) context.lineTo(toX(point.x), toY(point.z));
      context.stroke();
    }
    for (const { outline } of ground.places) {
      context.beginPath();
      for (const point of outline) context.lineTo(toX(point.x), toY(point.z));
      context.closePath();
      context.fill();
    }
    context.restore();
    return;
  }
  if (ground.shape === 'basin') {
    // The mountains are dark, the lake is pale water beyond the outline, and the basin is ground.
    const trace = (points: readonly Point[]): void => {
      context.beginPath();
      for (const point of points) context.lineTo(toX(point.x), toY(point.z));
      context.closePath();
    };
    context.fillStyle = WALL_COLOUR;
    box(ground.bounds);
    context.fillStyle = LAKE_COLOUR;
    trace(basinSetting(game.zoneId).lake);
    context.fill();
    context.fillStyle = GROUND_COLOUR;
    trace(ground.outline);
    context.fill();
    context.fillStyle = WALL_COLOUR;
    for (const { outline } of ground.blocked) {
      trace(outline);
      context.fill();
    }
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const { id, points, width } of ground.walls) {
      context.strokeStyle = basinSetting(game.zoneId).waterIds.includes(id) ? LAKE_COLOUR : WALL_COLOUR;
      context.lineWidth = toX(width) - toX(0);
      context.beginPath();
      for (const point of points) context.lineTo(toX(point.x), toY(point.z));
      context.stroke();
    }
    return;
  }
  box(ground.bounds);
  context.fillStyle = WALL_COLOUR;
  ground.walls.forEach(box);
}

/** The basin's plan: the main road, the two side routes and the closed dungeon door (M1 appendix). */
function drawPlan(context: CanvasRenderingContext2D, { road, ways, door }: BasinSetting, toX: (x: number) => number, toY: (z: number) => number): void {
  context.save();
  context.setLineDash(PLAN_DASH);
  context.lineWidth = 2;
  const line = (points: readonly Point[], colour: string, widthPx: number): void => {
    context.strokeStyle = colour;
    context.lineWidth = widthPx;
    context.beginPath();
    for (const point of points) context.lineTo(toX(point.x), toY(point.z));
    context.stroke();
  };
  line(road, ROAD_COLOUR, 3);
  for (const way of ways) line(way, SIDE_ROUTE_COLOUR, 2);
  context.restore();
  context.fillStyle = ROAD_COLOUR;
  context.fillRect(toX(door.x) - CORNER_RADIUS * 2, toY(door.z) - CORNER_RADIUS * 3, CORNER_RADIUS * 4, CORNER_RADIUS * 6);
  context.fillText('door (look only)', toX(door.x), toY(door.z) + CORNER_RADIUS * 6);
}

/** Each unit's live route: a dashed line from the unit through its corners (decision 14). */
function drawRoutes(context: CanvasRenderingContext2D, game: GameView, toX: (x: number) => number, toY: (z: number) => number): void {
  context.save();
  context.setLineDash(ROUTE_DASH);
  context.lineWidth = 2;
  for (const unit of game.bodies) {
    if (unit.route.length === 0) continue;
    const colour = UNIT_LOOKS[characterOf(game, unit.id).classId].colour;
    context.strokeStyle = colour;
    context.beginPath();
    context.moveTo(toX(unit.x), toY(unit.z));
    for (const corner of unit.route) context.lineTo(toX(corner.x), toY(corner.z));
    context.stroke();
    context.fillStyle = colour;
    for (const corner of unit.route) {
      context.beginPath();
      context.arc(toX(corner.x), toY(corner.z), CORNER_RADIUS, 0, 2 * Math.PI);
      context.fill();
    }
  }
  context.restore();
}

export function drawGame(
  context: CanvasRenderingContext2D,
  game: GameView,
  marks: readonly Mark[],
  showGrid: boolean,
): void {
  const { width } = context.canvas;
  const zone = currentZone(game);
  const viewRadius = zone.kind === 'town' ? TOWN_VIEW_RADIUS : zone.ground.shape === 'basin' ? BASIN_VIEW_RADIUS : VIEW_RADIUS;
  const scale = width / (viewRadius * 2);
  const toX = (x: number): number => width / 2 + x * scale;
  // The map is seen from above, with +z towards the bottom of the screen.
  const toY = (z: number): number => width / 2 + z * scale;

  context.clearRect(0, 0, width, width);
  drawGround(context, game, toX, toY);

  for (const obstacle of zone.obstacles) {
    context.fillStyle = OBSTACLE_COLOURS[obstacle.kind];
    context.beginPath();
    context.arc(toX(obstacle.x), toY(obstacle.z), obstacle.radius * scale, 0, 2 * Math.PI);
    context.fill();
  }
  if (zone.ground.shape === 'basin') {
    context.font = `${String(UNIT_RADIUS * 1.2)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    drawPlan(context, basinSetting(zone.id), toX, toY);
  }
  for (const gate of zone.gates) {
    drawRing(context, toX(gate.x), toY(gate.z), gate.radius * scale, GATE_COLOUR);
    context.fillStyle = GATE_COLOUR;
    context.fillText(`to ${gate.to}`, toX(gate.x), toY(gate.z) - gate.radius * scale - UNIT_RADIUS);
  }
  context.strokeStyle = LOT_COLOUR;
  context.fillStyle = LOT_COLOUR;
  context.lineWidth = 2;
  for (const { id, door, facing } of zone.lots) {
    context.beginPath();
    context.arc(toX(door.x), toY(door.z), CORNER_RADIUS * 2, 0, 2 * Math.PI);
    context.moveTo(toX(door.x), toY(door.z));
    context.lineTo(toX(door.x + Math.cos(facing) * LOT_TICK), toY(door.z + Math.sin(facing) * LOT_TICK));
    context.stroke();
    context.fillText(id, toX(door.x - Math.cos(facing) * LOT_TICK * 2), toY(door.z));
  }
  if (showGrid) {
    context.drawImage(gridImage(game, width, toX, toY), 0, 0);
    drawRoutes(context, game, toX, toY);
  }

  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  const cross = UNIT_RADIUS / 2;
  context.beginPath();
  context.moveTo(toX(game.anchor.x) - cross, toY(game.anchor.z) - cross);
  context.lineTo(toX(game.anchor.x) + cross, toY(game.anchor.z) + cross);
  context.moveTo(toX(game.anchor.x) + cross, toY(game.anchor.z) - cross);
  context.lineTo(toX(game.anchor.x) - cross, toY(game.anchor.z) + cross);
  context.stroke();

  context.font = `bold ${String(UNIT_RADIUS * 1.5)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const entry of game.live.scheduled) {
    drawTelegraph(context, entry, toX, toY, scale);
  }

  for (const drop of game.live.drops) {
    context.fillStyle = DROP_COLOURS[drop.kind];
    context.beginPath();
    context.arc(toX(drop.x), toY(drop.z), DROP_RADIUS, 0, 2 * Math.PI);
    context.fill();
  }

  for (const enemy of game.live.enemies) {
    const x = toX(enemy.x);
    const y = toY(enemy.z);
    const look = ENEMY_LOOKS[enemy.kind];
    const size = ENEMY_SIZE * look.scale;
    const awakeColour = enemy.awake ? look.colour : ASLEEP_COLOUR;
    context.fillStyle = enemy.alive ? awakeColour : DOWN_COLOUR;
    context.fillRect(x - size, y - size, size * 2, size * 2);
    context.fillStyle = '#182530';
    context.fillText(look.letter, x, y);
    if (enemy.health < enemy.maxHealth) {
      const share = enemy.health / enemy.maxHealth;
      drawBar(context, x, y - size - BAR_HEIGHT * 2, share, healthColour(share));
    }
  }

  for (const unit of game.bodies) {
    const x = toX(unit.x);
    const y = toY(unit.z);
    const look = UNIT_LOOKS[characterOf(game, unit.id).classId];
    const maxMana = cardOf(game, unit.id)?.maxMana ?? 0;
    if (unit.dest) {
      context.strokeStyle = look.colour;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(toX(unit.dest.x), toY(unit.dest.z));
      context.stroke();
    }
    if (unit.hold) {
      context.strokeStyle = '#fff2c0';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, UNIT_RADIUS * 1.6, 0, 2 * Math.PI);
      context.stroke();
    }
    if (unit.guardTicks > 0) {
      drawRing(context, x, y, UNIT_RADIUS * 1.3, GUARD_COLOUR);
    }
    if (unit.rallyTicks > 0) {
      drawRing(context, x, y, UNIT_RADIUS * 2, RALLY_COLOUR);
    }
    context.fillStyle = unit.alive ? look.colour : DOWN_COLOUR;
    context.beginPath();
    context.arc(x, y, UNIT_RADIUS, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = '#182530';
    context.fillText(look.letter, x, y);
    const share = unit.health / unit.maxHealth;
    drawBar(context, x, y - UNIT_RADIUS * 2, share, healthColour(share));
    if (maxMana > 0) {
      drawBar(context, x, y - UNIT_RADIUS * 2 + BAR_HEIGHT, unit.mana / maxMana, MANA_COLOUR);
    }
  }

  context.fillStyle = SHOT_COLOUR;
  for (const shot of game.live.shots) {
    context.beginPath();
    context.arc(toX(shot.x), toY(shot.z), SHOT_RADIUS, 0, 2 * Math.PI);
    context.fill();
  }
  context.fillStyle = ENEMY_SHOT_COLOUR;
  for (const shot of game.live.enemyShots) {
    context.beginPath();
    context.arc(toX(shot.x), toY(shot.z), ENEMY_SHOT_RADIUS, 0, 2 * Math.PI);
    context.fill();
  }

  for (const mark of marks) {
    const x = toX(mark.x);
    const y = toY(mark.z);
    if (mark.ring) {
      drawRing(context, x, y, MARK_RING_RADIUS, mark.colour);
    }
    context.fillStyle = mark.colour;
    context.fillText(mark.text, x, y - UNIT_RADIUS * 3);
  }
}
