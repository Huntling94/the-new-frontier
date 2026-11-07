import { TEST_ISLAND, rimRadiusAt, type GameView } from '@new-frontier/core';

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
const UNIT_RADIUS = 11;
const BAR_WIDTH = 30;
const BAR_HEIGHT = 5;
const DUMMY_SIZE = 12;
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
const DUMMY_COLOUR = '#b0653a';

/** The Healer's mana, for its bar. */
const MAX_MANA = 400;

const OBSTACLE_COLOURS = {
  tree: '#2f5a33',
  rock: '#7c786c',
  beacon: '#d8b878',
  waystone: '#8fd6c4',
};

const UNIT_LOOKS = {
  fighter: { colour: '#c8553d', letter: 'F' },
  shooter: { colour: '#3f7fb0', letter: 'S' },
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

function healthColour(share: number): string {
  return share < LOW_HEALTH_SHARE ? LOW_HEALTH_COLOUR : HEALTH_COLOUR;
}

export function drawGame(
  context: CanvasRenderingContext2D,
  game: GameView,
  marks: readonly Mark[],
): void {
  const { width } = context.canvas;
  const scale = width / (VIEW_RADIUS * 2);
  const toX = (x: number): number => width / 2 + x * scale;
  // The map is seen from above, with +z towards the bottom of the screen.
  const toY = (z: number): number => width / 2 + z * scale;

  context.clearRect(0, 0, width, width);
  context.fillStyle = '#5f7f47';
  context.beginPath();
  for (let index = 0; index < RIM_POINTS; index += 1) {
    const angle = (index / RIM_POINTS) * 2 * Math.PI;
    const radius = rimRadiusAt(TEST_ISLAND, angle);
    context.lineTo(toX(Math.cos(angle) * radius), toY(Math.sin(angle) * radius));
  }
  context.closePath();
  context.fill();

  for (const zone of game.zones) {
    for (const obstacle of zone.obstacles) {
      context.fillStyle = OBSTACLE_COLOURS[obstacle.kind];
      context.beginPath();
      context.arc(toX(obstacle.x), toY(obstacle.z), obstacle.radius * scale, 0, 2 * Math.PI);
      context.fill();
    }
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
  for (const enemy of game.enemies) {
    const x = toX(enemy.x);
    const y = toY(enemy.z);
    context.fillStyle = enemy.alive ? DUMMY_COLOUR : DOWN_COLOUR;
    context.fillRect(x - DUMMY_SIZE, y - DUMMY_SIZE, DUMMY_SIZE * 2, DUMMY_SIZE * 2);
    context.fillStyle = '#182530';
    context.fillText('D', x, y);
    const share = enemy.health / enemy.maxHealth;
    drawBar(context, x, y - DUMMY_SIZE * 2, share, healthColour(share));
  }

  for (const unit of game.units) {
    const x = toX(unit.x);
    const y = toY(unit.z);
    const look = UNIT_LOOKS[unit.classId];
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
    if (unit.classId === 'healer') {
      drawBar(context, x, y - UNIT_RADIUS * 2 + BAR_HEIGHT, unit.mana / MAX_MANA, MANA_COLOUR);
    }
  }

  context.fillStyle = SHOT_COLOUR;
  for (const shot of game.shots) {
    context.beginPath();
    context.arc(toX(shot.x), toY(shot.z), SHOT_RADIUS, 0, 2 * Math.PI);
    context.fill();
  }
  for (const strike of game.scheduled) {
    drawRing(context, toX(strike.x), toY(strike.z), VOLLEY_RING_RADIUS, SHOT_COLOUR);
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
