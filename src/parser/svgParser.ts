import type { Command } from '../types';

/**
 * A hand-written SVG path-data parser. No third-party SVG libraries are used.
 *
 * Design notes / edge cases handled:
 *  - Whitespace (space, tab, CR, LF) and commas are both valid separators.
 *  - Numbers may be negative, floating point, or use scientific notation (1e3).
 *  - A sign or second decimal point implicitly starts a new number, so
 *    "1-2" -> [1, -2] and "1.5.5" -> [1.5, 0.5].
 *  - Repeated/implicit commands: "M10 20 30 40" -> M 10 20 then L 30 40,
 *    and "m10 20 30 40" -> m 10 20 then l 30 40 (moveto's implicit lineto
 *    inherits the moveto's absolute/relative-ness).
 *  - Arc flags (largeArcFlag, sweepFlag) are single 0/1 digits and may be
 *    written without separators, e.g. "a25 25 -30 0 1 50 -25" or "a25 25 -30 0150 -25".
 *
 * Every emitted Command holds exactly the canonical number of values for its
 * command letter, which makes downstream transforms trivial and robust.
 */

const ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const COMMAND_LETTERS = new Set('MmLlHhVvCcSsQqTtAaZz'.split(''));

function isWhitespaceOrComma(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === ',';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

export class SvgPathParseError extends Error {
  constructor(message: string, public index: number) {
    super(message);
    this.name = 'SvgPathParseError';
  }
}

class Scanner {
  private i = 0;
  constructor(private readonly s: string) {}

  private skipSeparators(): void {
    while (this.i < this.s.length && isWhitespaceOrComma(this.s[this.i])) {
      this.i++;
    }
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.i >= this.s.length;
  }

  peek(): string {
    this.skipSeparators();
    return this.s[this.i];
  }

  /** Reads a single command letter. */
  readCommand(): string {
    this.skipSeparators();
    const ch = this.s[this.i];
    if (!COMMAND_LETTERS.has(ch)) {
      throw new SvgPathParseError(`Expected a command letter but found "${ch ?? '<end>'}"`, this.i);
    }
    this.i++;
    return ch;
  }

  /** True if the next meaningful char could begin a number (digit, sign, or dot). */
  nextStartsNumber(): boolean {
    this.skipSeparators();
    const ch = this.s[this.i];
    return ch !== undefined && (isDigit(ch) || ch === '+' || ch === '-' || ch === '.');
  }

  /** Reads a single flag: exactly one '0' or '1'. Flags may not have a decimal. */
  readFlag(): number {
    this.skipSeparators();
    const ch = this.s[this.i];
    if (ch === '0' || ch === '1') {
      this.i++;
      return ch === '1' ? 1 : 0;
    }
    throw new SvgPathParseError(`Expected an arc flag (0 or 1) but found "${ch ?? '<end>'}"`, this.i);
  }

  /** Scans a single number token following SVG float grammar. */
  readNumber(): number {
    this.skipSeparators();
    const start = this.i;
    const s = this.s;

    // optional sign
    if (s[this.i] === '+' || s[this.i] === '-') this.i++;

    let sawDigit = false;

    // integer part
    while (this.i < s.length && isDigit(s[this.i])) {
      this.i++;
      sawDigit = true;
    }

    // fractional part
    if (s[this.i] === '.') {
      this.i++;
      while (this.i < s.length && isDigit(s[this.i])) {
        this.i++;
        sawDigit = true;
      }
    }

    if (!sawDigit) {
      throw new SvgPathParseError(`Expected a number but found "${s[this.i] ?? '<end>'}"`, this.i);
    }

    // exponent part
    if (s[this.i] === 'e' || s[this.i] === 'E') {
      const expStart = this.i;
      this.i++;
      if (s[this.i] === '+' || s[this.i] === '-') this.i++;
      if (!isDigit(s[this.i])) {
        // Not a valid exponent — rewind so the 'e' is left unparsed.
        this.i = expStart;
      } else {
        while (this.i < s.length && isDigit(s[this.i])) this.i++;
      }
    }

    const value = Number.parseFloat(s.slice(start, this.i));
    if (Number.isNaN(value)) {
      throw new SvgPathParseError(`Could not parse number "${s.slice(start, this.i)}"`, start);
    }
    return value;
  }
}

/** Maps a moveto command to the implicit lineto used for repeated coordinate pairs. */
function impliedCommand(prev: string): string {
  if (prev === 'M') return 'L';
  if (prev === 'm') return 'l';
  return prev;
}

/**
 * Parse SVG path data into a flat list of canonical commands.
 * Throws {@link SvgPathParseError} on malformed input.
 */
export function parsePath(d: string): Command[] {
  const input = (d ?? '').trim();
  if (input.length === 0) return [];

  const scanner = new Scanner(input);
  const commands: Command[] = [];
  let prevCommand = '';
  let isFirst = true;

  while (!scanner.atEnd()) {
    let command: string;
    const next = scanner.peek();

    if (COMMAND_LETTERS.has(next)) {
      command = scanner.readCommand();
    } else {
      // Implicit repeat of the previous command.
      if (prevCommand === '' || prevCommand === 'Z' || prevCommand === 'z') {
        throw new SvgPathParseError(`Unexpected number "${next}" — expected a command letter`, 0);
      }
      command = impliedCommand(prevCommand);
    }

    // The very first command of a path must be a moveto.
    if (isFirst && command !== 'M' && command !== 'm') {
      throw new SvgPathParseError(`A path must begin with a moveto (M/m), found "${command}"`, 0);
    }
    isFirst = false;

    const upper = command.toUpperCase();
    const count = ARG_COUNT[upper];

    if (count === 0) {
      commands.push({ command, values: [] });
      prevCommand = command;
      continue;
    }

    // Read one full group of arguments for this command.
    const values = readArgGroup(scanner, upper);
    commands.push({ command, values });
    prevCommand = command;

    // Consume any additional implicit groups for this same command letter.
    while (scanner.nextStartsNumber()) {
      const implied = impliedCommand(command);
      const impliedUpper = implied.toUpperCase();
      const moreValues = readArgGroup(scanner, impliedUpper);
      commands.push({ command: implied, values: moreValues });
      command = implied;
      prevCommand = implied;
    }
  }

  return commands;
}

function readArgGroup(scanner: Scanner, upperCommand: string): number[] {
  if (upperCommand === 'A') {
    // rx ry xAxisRotation largeArcFlag sweepFlag x y
    return [
      scanner.readNumber(),
      scanner.readNumber(),
      scanner.readNumber(),
      scanner.readFlag(),
      scanner.readFlag(),
      scanner.readNumber(),
      scanner.readNumber(),
    ];
  }
  const count = ARG_COUNT[upperCommand];
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    out.push(scanner.readNumber());
  }
  return out;
}

/** Convenience wrapper: parse without throwing, returning an error string instead. */
export function tryParsePath(d: string): { commands: Command[]; error: string | null } {
  try {
    return { commands: parsePath(d), error: null };
  } catch (err) {
    if (err instanceof SvgPathParseError) {
      return { commands: [], error: err.message };
    }
    return { commands: [], error: err instanceof Error ? err.message : 'Unknown parse error' };
  }
}
