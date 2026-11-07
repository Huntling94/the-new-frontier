import { TEST_ISLAND, rimRadiusAt, type GameView } from '@new-frontier/core';

const RIM_POINTS = 180;
/** World units from the centre to the canvas edge. */
const VIEW_RADIUS = 112;
const UNIT_RADIUS = 11;

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

export function drawGame(context: CanvasRenderingContext2D, game: GameView): void {
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
    context.fillStyle = look.colour;
    context.beginPath();
    context.arc(x, y, UNIT_RADIUS, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = '#182530';
    context.fillText(look.letter, x, y);
  }
}
