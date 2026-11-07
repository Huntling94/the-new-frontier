import type { GameEvent } from '@new-frontier/core';

/** One rising number or word over the world, as in the squad test. */
interface Float {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly text: string;
  readonly colour: string;
  readonly size: number;
  readonly life: number;
  age: number;
}

/** A body where it is drawn, for placing text over it. */
export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Enemies' size, which raises their numbers. Characters have none. */
  readonly size?: number;
}

const MOST = 60;
const RISE = 3;
const FADE_FROM = 0.6;
const LIFE = 0.85;
const LEVEL_LIFE = 1.4;
const UNIT_HEIGHT = 5;
const LEVEL_HEIGHT = 6;
const ENEMY_HEIGHT = 3;

const amount = (value: number): string => Math.round(value).toLocaleString('en-AU');

/** Floating damage, healing and level text (S2.3b). It reads events and changes nothing. */
export class Floats {
  private readonly list: Float[] = [];

  add(x: number, y: number, z: number, text: string, colour: string, size: number, life = LIFE): void {
    if (this.list.length >= MOST) this.list.shift();
    this.list.push({ x, y, z, text, colour, size, life, age: 0 });
  }

  /** Turns a tick's events into text over whoever they happened to. */
  fromEvents(events: readonly GameEvent[], unitAt: (id: number) => Placed | null, enemyAt: (id: number) => Placed | null): void {
    for (const event of events) {
      if (event.type === 'hit') {
        const enemy = enemyAt(event.targetId);
        if (enemy) {
          const y = enemy.y + ENEMY_HEIGHT + (enemy.size ?? 0);
          if (event.crit) this.add(enemy.x, y, enemy.z, `${amount(event.amount)}!`, '#ffcf6e', 26);
          else this.add(enemy.x, y, enemy.z, amount(event.amount), '#fff', 18);
          continue;
        }
        const unit = unitAt(event.targetId);
        if (unit) this.add(unit.x, unit.y + UNIT_HEIGHT, unit.z, amount(event.amount), '#ff7a62', 21);
      } else if (event.type === 'healed' && event.amount >= 1) {
        const unit = unitAt(event.unitId);
        if (unit) this.add(unit.x, unit.y + UNIT_HEIGHT, unit.z, `+${amount(event.amount)}`, '#9be8a6', 19);
      } else if (event.type === 'level-up') {
        const unit = unitAt(event.unitId);
        if (unit) this.add(unit.x, unit.y + LEVEL_HEIGHT, unit.z, `LEVEL ${event.level}`, '#ffb648', 28, LEVEL_LIFE);
      }
    }
  }

  /** Ages the text by real seconds and draws it, rising and fading. */
  draw(context: CanvasRenderingContext2D, dt: number, project: (x: number, y: number, z: number) => { x: number; y: number; visible: boolean }): void {
    context.textAlign = 'center';
    context.lineWidth = 3;
    context.strokeStyle = '#0009';
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const float = this.list[index];
      if (!float) continue;
      float.age += dt;
      if (float.age > float.life) {
        this.list.splice(index, 1);
        continue;
      }
      const share = float.age / float.life;
      const at = project(float.x, float.y + share * RISE, float.z);
      if (!at.visible) continue;
      context.globalAlpha = share > FADE_FROM ? 1 - (share - FADE_FROM) / (1 - FADE_FROM) : 1;
      context.font = `${float.size}px VT323, monospace`;
      context.strokeText(float.text, at.x, at.y);
      context.fillStyle = float.colour;
      context.fillText(float.text, at.x, at.y);
    }
    context.globalAlpha = 1;
    context.textAlign = 'start';
  }

  get count(): number {
    return this.list.length;
  }
}
