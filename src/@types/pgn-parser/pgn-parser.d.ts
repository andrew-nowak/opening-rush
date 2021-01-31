declare module 'pgn-parser' {
  export type PgnResult = "1-0" | "0-1" | "*" | "1/2-1/2";

  export interface PgnParseResult {
    headers?: PgnHeader[];
    result: PgnResult | null;
    moves: PgnMove[] | null;
  }

  export interface PgnHeader {
    name: string;
    value: string;
  }

  export interface PgnRav {
    moves: PgnMove[];
    result: PgnResult | null;
  }

  export interface PgnMove {
    move: string;
    move_number?: number;
    nags?: string[];
    ravs?: PgnRav[];
  }

  export function parse(pgn: string): PgnParseResult[];
}
