export enum GameState {
  MENU,
  LOADING_LEVEL,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  rotation: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  type: 'player' | 'enemy' | 'boss' | 'crystal' | 'crate' | 'pickup';
}

export interface EnvironmentObject {
  id: string;
  type: 'tree' | 'building';
  pos: Vector2;
  size: Vector2;
  color: string;
}

export type WeaponType = 'sniper' | 'ak47' | 'shotgun' | 'minigun' | 'laser';

export interface Player extends Entity {
  role: 'boy' | 'girl';
  weapon: WeaponType;
  cooldown: number;
  maxCooldown: number;
  dashCooldown: number;
  score: number;
  isInvulnerable: boolean;
  animFrame: number; 
}

export interface Crate extends Entity {
  type: 'crate';
}

export interface Pickup extends Entity {
  type: 'pickup';
  weaponType: WeaponType;
  lifeTime: number;
}

export interface EnemyVisuals {
  hue: number;
  scale: number;
  hasArmor: boolean;
  hasHorns: boolean;
  hasEye: boolean;
}

export interface Enemy extends Entity {
  enemyType: 'walker' | 'shooter' | 'boss';
  targetId: string | null;
  attackCooldown: number;
  animFrame: number;
  visuals: EnemyVisuals;
}

export interface Bullet {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  ownerId: string;
  damage: number;
  lifeTime: number;
  isReflected: boolean;
  bulletType: WeaponType | 'enemy_normal';
}

export interface Particle {
  id: string;
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'blood' | 'spark' | 'smoke';
}

export interface LevelInfo {
  levelNumber: number;
  biomeName: string;
  description: string;
  bossName: string;
  bossDescription: string;
}