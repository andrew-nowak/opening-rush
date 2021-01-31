import { Chessground } from 'chessground';
import { Api } from 'chessground/api';
import { Key } from 'chessground/types';
import { Chess, ChessInstance, Square } from 'chess.js';
import { parse as parsePgn, PgnMove } from 'pgn-parser';
import presetPgns from './presetLines';
import '../assets/styles.css';

class OpeningRush {
  private _cg: Api;
  private _chess: ChessInstance;
  private _getPlayer: () => 'white' | 'black';
  private _lines: PgnMove[];
  private _currentLine: PgnMove[];

  constructor(cg: Api, chess: ChessInstance, player: () => 'white' | 'black') {
    this._cg = cg;
    this._chess = chess;
    this._getPlayer = player;

    this._lines = [];
    this._currentLine = [];

    this.reset();
  }

  public load(pgn: string) {
    this.reset();

    let done;
    try {
      done = parsePgn(pgn);
    } catch (e) {
      done = parsePgn(pgn + ' *');
    }

    const movelist = done[0].moves;

    this._lines = movelist;
    this._currentLine = JSON.parse(JSON.stringify(this._lines));
  }

  public reset() {
    this._chess.reset();
    this._cg.set({
      fen: this._chess.fen(),
      orientation: this._getPlayer(),
      movable: {
        dests: new Map(),
        free: false,
      }
    })
    this._currentLine = JSON.parse(JSON.stringify(this._lines));
  }

  private turnColour(): 'black' | 'white' {
    return (this._chess.turn() === 'w') ? 'white' : 'black';
  }

  private getValidDests(): Map<Key, Key[]> {
    const dests = new Map();
    this._chess.SQUARES.forEach(s => {
      const ms = this._chess.moves({square: s, verbose: true});
      if (ms.length) dests.set(s, ms.map(m => m.to));
    });
    return dests;
  }

  public start() {
    document.getElementById('feedback').innerText = 'starting';
    this.reset();
    const player = this._getPlayer();

    if (player === 'black') {
      this.playResponse();
    }
    this._cg.set({
      viewOnly: false,
      turnColor: player,
      movable: {
        events: { after: this.onMove() },
        color: player,
        free: false,
        dests: this.getValidDests(),
      },
    });
  }

  private playResponse() {
    if (this._currentLine.length > 0) {
      const mainline = this._currentLine;
      const candidates = [mainline].concat(mainline[0].ravs ? mainline[0].ravs.map(rav => rav.moves): []);

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      this._currentLine = chosen;
      this._chess.move(chosen[0].move);
      this._cg.set({ fen: this._chess.fen() });
      this._currentLine.shift();
    }
  }

  private checkIfEndOfLine() {
    if (this._currentLine.length === 0) {
      setTimeout(() => {
        this.reset();
        this.start();
      }, 500);
      return true;
    }
    return false;
  }

  private getPotentialLines(): PgnMove[][] {
    const mainline = this._currentLine;
    const candidates = [mainline].concat(mainline[0].ravs ? mainline[0].ravs.map(rav => rav.moves): []);
    return candidates;
  }

  private onMove() {
    return (from: Square, to: Square) => {
      const feedback = document.getElementById('feedback');
      const moveObj = this._chess.moves({ verbose: true }).find(mv => mv.from === from && mv.to === to);
      if (!moveObj) throw new Error('user made impossible move on cg');
      const moveSan = moveObj.san;
      const candidateLines = this.getPotentialLines();
      const playedLine = candidateLines.find(line => line[0].move === moveSan);

      if (playedLine) {
        this._chess.move({ from, to });
        this._currentLine = playedLine;
        this._currentLine.shift();

        feedback.innerText = '✅';
        this.playResponse();
      } else {
        setTimeout(() => { this._cg.set({ fen: this._chess.fen() }) }, 200);
        feedback.innerText = '❌';
      }

      if (!this.checkIfEndOfLine()) {
        this._cg.set({
          turnColor: this.turnColour(),
          movable: {
            color: this.turnColour(),
            free: false,
            dests: this.getValidDests(),
          },
        });
      }
    };
  }
}




function init() {
  const root = document.createElement('div');
  root.id = 'root';
  root.className = 'grid-base';
  document.body.appendChild(root);

  const main = document.createElement('main');
  main.className = 'blue merida';
  main.id = 'board-root';
  root.appendChild(main);

  const sidebar = document.createElement('aside');
  root.appendChild(sidebar);

  const feedback = document.createElement('div');
  feedback.id = 'feedback';
  feedback.innerText = 'hi world';
  sidebar.appendChild(feedback);

  const form = document.createElement('form');
  sidebar.appendChild(form);

  const colourSelection = document.createElement('div');
  form.appendChild(colourSelection);

  const playAs = document.createElement('p');
  playAs.innerText = 'Play as: '
  colourSelection.appendChild(playAs);

  const playAsWhite = document.createElement('input');
  playAsWhite.type = 'radio';
  playAsWhite.name = 'playas';
  playAsWhite.value = 'white';
  playAsWhite.checked = true;
  colourSelection.appendChild(playAsWhite);

  const playAsWhiteLabel = document.createElement('label');
  playAsWhiteLabel.htmlFor = 'white';
  playAsWhiteLabel.innerText = 'White';
  colourSelection.appendChild(playAsWhiteLabel);

  const playAsBlack = document.createElement('input');
  playAsBlack.type = 'radio';
  playAsBlack.name = 'playas';
  playAsBlack.value = 'black';
  colourSelection.appendChild(playAsBlack);

  const playAsBlackLabel = document.createElement('label');
  playAsBlackLabel.htmlFor = 'black';
  playAsBlackLabel.innerText = 'Black';
  colourSelection.appendChild(playAsBlackLabel);

  const pgnEntryLabel = document.createElement('label');
  pgnEntryLabel.htmlFor = 'pgnentry';
  pgnEntryLabel.innerText = 'Enter a PGN with variation annotations:';
  form.appendChild(pgnEntryLabel);

  const pgnEntry = document.createElement('textarea');
  pgnEntry.id = 'pgnentry';
  pgnEntry.autocomplete = 'off';
  pgnEntry.spellcheck = false;
  pgnEntry.required = true;
  form.appendChild(pgnEntry);

  const start = document.createElement('button');
  start.innerText = 'start';
  form.appendChild(start);

  const presets = document.createElement('div');
  sidebar.appendChild(presets);

  const presetsList = document.createElement('ul');
  presets.appendChild(presetsList);

  const chess = new Chess();

  const cg = Chessground(main);

  const getPlayerColour = (): 'black' | 'white' => {
    const maybeName = form.elements.namedItem('playas');
    if ("value" in maybeName && (maybeName.value === 'white' || maybeName.value === 'black')) {
      return maybeName.value;
    }
    throw new Error('can\'t get player colour!!!')
  };

  const rush = new OpeningRush(cg, chess, getPlayerColour);

  const choosePreset = (pgn: string, colour: string) => () => {
    pgnEntry.value = pgn;
    if (colour === 'white') {
      playAsWhite.checked = true;
    } else if (colour === 'black') {
      playAsBlack.checked = true;
    }
  }

  presetPgns.forEach(({ name, pgn, colour }) => {
    const item = document.createElement('li');
    item.innerText = name;
    item.onclick = choosePreset(pgn, colour);
    presetsList.appendChild(item);
  });

  // expose cg api on document for debugging from browser console
  (document as any).cg = cg;
  (document as any).chess = chess;
  (document as any).rush = rush;

  start.onclick = e => {
    e.preventDefault();
    try {
      const line = pgnEntry.value;
      rush.load(line);
      rush.start();
    } catch (e) {
      feedback.innerText = '⁉️  You need to enter a valid PGN, or select from the presets below';
    }
  };
};
init();
