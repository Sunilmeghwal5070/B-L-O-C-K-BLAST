export type ShapeDef = {
  id: string;
  matrix: number[][]; // 1 for solid, 0 for empty
  colorClass: string;
};

export type GridCellData = {
  isFilled: boolean;
  colorClass: string | null;
};

export type Pos = { x: number; y: number };

export type GameState = 'WELCOME' | 'MENU' | 'PLAYING' | 'GAMEOVER';

export type PopupText = {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
};
