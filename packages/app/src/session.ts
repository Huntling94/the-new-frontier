import {
  applyCommands,
  autoCommands,
  botCommands,
  createGame,
  ISLAND_SCENARIO,
  step,
  type Scenario,
  type AutoStop,
  type BotKind,
  type Command,
  type GameEvent,
  type GameState,
  type GameView,
  type Point,
} from '@new-frontier/core';
import { castFor, characterAt, orderedIds, type KeyAction } from './controls';
import type { LogLine } from './reactions';

/** A move order's marker, which shows on the click, before the next tick (decision 3). */
export interface MoveMark {
  readonly x: number;
  readonly z: number;
  readonly attack: boolean;
  age: number;
}

/**
 * One game in the page: the core's state, and what only the player has, such as
 * selection. Input turns into commands here, and nothing else changes the game (decision 1).
 */
export class Session {
  /** Replaced whole when a save is loaded (S3c decision 7). */
  state: GameState;
  readonly selected = new Set<number>();
  /** Characters under auto-combat, which may be only some of them (D-035). */
  readonly autoIds = new Set<number>();
  readonly bot: BotKind | null;
  move: MoveMark | null = null;
  /** Log lines about the player's own orders, which the page shows and clears. */
  readonly notes: LogLine[] = [];
  private pending: Command[] = [];

  constructor(seed: number, bot: BotKind | null, scenario: Scenario = ISLAND_SCENARIO) {
    this.state = createGame(seed, scenario);
    this.bot = bot;
    for (const unit of this.state.bodies) this.selected.add(unit.id);
  }

  get view(): GameView {
    return this.state;
  }

  /** Plays on from a loaded save: everyone selected, nothing pending, auto-combat off. */
  restore(state: GameState): void {
    this.state = state;
    this.pending = [];
    this.move = null;
    this.autoIds.clear();
    this.selected.clear();
    this.selectAll();
  }

  get auto(): boolean {
    return this.autoIds.size > 0;
  }

  private release(ids: readonly number[]): void {
    for (const id of ids) this.autoIds.delete(id);
  }

  /** Runs one tick with the commands gathered since the last. */
  tick(): GameEvent[] {
    const mine = this.pending;
    let commands = mine;
    this.pending = [];
    if (this.bot) {
      commands = [...commands, ...botCommands(this.state, this.bot)];
    } else if (this.auto) {
      const whole = this.autoIds.size === this.state.bodies.length;
      const auto = autoCommands(this.state, whole ? undefined : [...this.autoIds]);
      if (auto.stop) {
        this.autoIds.clear();
        this.noteStop(auto.stop);
      } else {
        commands = [...commands, ...auto.commands];
      }
    }
    const events = step(this.state, commands);
    this.noteRefusals(mine, events);
    return events;
  }

  /**
   * Applies commands now, with no time passing, while the game is paused for the
   * anvil (S2.3b decision 4).
   */
  applyNow(commands: readonly Command[]): GameEvent[] {
    return applyCommands(this.state, commands);
  }

  private noteStop(stop: AutoStop): void {
    if (stop === 'danger') this.notes.push({ text: 'Auto-combat stopped: squad in danger', tone: 'bad' });
    if (stop === 'clear') this.notes.push({ text: 'Auto-combat stopped: zone clear', tone: 'blue' });
  }

  /** The core answers each command in order, first in the tick's events, so refusals pair with the player's own. */
  private noteRefusals(mine: readonly Command[], events: readonly GameEvent[]): void {
    const answers = events.filter((event) => event.type === 'order-accepted' || event.type === 'order-refused');
    mine.forEach((command, index) => {
      const answer = answers[index];
      if (answer?.type !== 'order-refused' || command.type !== 'cast') return;
      const character = this.state.family.characters.find(({ id }) => id === command.unitId);
      const name = character ? character.name : 'Someone';
      if (answer.reason === 'no-mana') this.notes.push({ text: `${name}: not enough mana`, tone: 'bad' });
      if (command.spell === 'revive' && answer.reason === 'no-target') this.notes.push({ text: 'Nobody needs reviving', tone: 'blue' });
    });
  }

  /** Right click on the ground, or `Ctrl` and a left click to attack-move (D-034). */
  moveTo(point: Point, attack: boolean): void {
    const unitIds = orderedIds(this.state, this.selected);
    this.release(unitIds);
    this.pending.push({ type: 'move', unitIds, x: point.x, z: point.z, attack });
    this.move = { x: point.x, z: point.z, attack, age: 0 };
  }

  target(enemyId: number): void {
    const unitIds = orderedIds(this.state, this.selected);
    this.release(unitIds);
    this.pending.push({ type: 'target', unitIds, enemyId });
  }

  selectOnly(ids: readonly number[]): void {
    if (ids.length === 0) return;
    this.selected.clear();
    for (const id of ids) this.selected.add(id);
  }

  selectAll(): void {
    for (const unit of this.state.bodies) this.selected.add(unit.id);
  }

  /** A key press (D-031). Camera keys are handled by the page. */
  act(action: KeyAction, cursor: Point | null): void {
    switch (action.kind) {
      case 'spell': {
        const cast = castFor(this.state, action.place, action.slot, cursor);
        if (cast) this.pending.push(cast);
        break;
      }
      case 'select': {
        const id = characterAt(this.state, action.place);
        if (id !== null) this.selectOnly([id]);
        break;
      }
      case 'select-all':
        this.selectAll();
        break;
      case 'regroup':
        this.selectAll();
        this.autoIds.clear();
        this.pending.push({ type: 'regroup' });
        break;
      case 'scatter':
        this.autoIds.clear();
        this.pending.push({ type: 'scatter' });
        break;
      case 'potion':
        this.pending.push({ type: 'potion' });
        break;
      case 'auto': {
        // Space toggles auto-combat for the selected characters (D-035).
        const ids = orderedIds(this.state, this.selected);
        if (ids.every((id) => this.autoIds.has(id))) {
          this.release(ids);
          this.notes.push({ text: 'Auto-combat off', tone: 'blue' });
        } else {
          for (const id of ids) this.autoIds.add(id);
          this.notes.push({ text: 'Auto-combat on', tone: 'blue' });
        }
        break;
      }
      default:
        break;
    }
  }

  /** Ages the move marker by real seconds. */
  frame(dt: number): void {
    if (this.move) this.move.age += dt;
  }
}
