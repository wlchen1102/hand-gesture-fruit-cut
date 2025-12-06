export interface Vector2 {
  x: number;
  y: number;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  PAUSED = 'PAUSED',
}

export enum EntityType {
  FRUIT = 'FRUIT',
  BOMB = 'BOMB',
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  color: string;
  size: number;
}

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  isSliced: boolean;
  markedForDeletion: boolean;
  emoji?: string;
  sliceAngle?: number; // The angle at which it was sliced
}

export interface HandPoint {
  x: number;
  y: number;
  timestamp: number;
}

// MediaPipe Types (Simplified)
export interface Landmarks {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Results {
  multiHandLandmarks: Landmarks[][];
  multiHandedness: any[];
  image: HTMLVideoElement;
}