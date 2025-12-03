import React, { useEffect, useRef } from 'react';
import { Entity, Player, Enemy, Bullet, Particle, GameState, Vector2, LevelInfo, EnvironmentObject, WeaponType, Crate, Pickup } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  levelInfo: LevelInfo | null;
  onLevelComplete: () => void;
  onGameOver: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, levelInfo, onLevelComplete, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const playersRef = useRef<Player[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const crystalsRef = useRef<Entity[]>([]);
  const cratesRef = useRef<Crate[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  
  const keysPressed = useRef<Set<string>>(new Set());
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const frameIdRef = useRef<number>(0);
  const waveTimerRef = useRef<number>(0);
  const bossSpawnedRef = useRef<boolean>(false);
  const crystalsCollectedRef = useRef<number>(0);

  // Constants
  const CRYSTALS_TO_BOSS = 10 + (levelInfo?.levelNumber || 1) * 2;
  const FRICTION = 0.88; 
  const ACCELERATION = 0.6; 
  const MAX_SPEED = 6;
  const GRID_CELL_SIZE = 200; 

  // Initialize Game
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initGame();
    }
    return () => cancelAnimationFrame(frameIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, levelInfo]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const initGame = () => {
    playersRef.current = [
      {
        id: 'p1', type: 'player', role: 'boy', weapon: 'sniper',
        pos: { x: -50, y: 0 }, vel: { x: 0, y: 0 },
        radius: 20, color: '#3b82f6', hp: 200, maxHp: 200, dead: false,
        rotation: 0, animFrame: 0,
        cooldown: 0, maxCooldown: 90, dashCooldown: 0, score: 0, isInvulnerable: false
      },
      {
        id: 'p2', type: 'player', role: 'girl', weapon: 'ak47',
        pos: { x: 50, y: 0 }, vel: { x: 0, y: 0 },
        radius: 18, color: '#ec4899', hp: 150, maxHp: 150, dead: false,
        rotation: 0, animFrame: 0,
        cooldown: 0, maxCooldown: 10, dashCooldown: 0, score: 0, isInvulnerable: false
      }
    ];
    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    crystalsRef.current = [];
    cratesRef.current = [];
    pickupsRef.current = [];
    crystalsCollectedRef.current = 0;
    bossSpawnedRef.current = false;
    waveTimerRef.current = 0;

    loop();
  };

  // --- PROCEDURAL GENERATION ---
  const getEnvironmentAt = (gx: number, gy: number): EnvironmentObject | null => {
      const seed = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
      const val = Math.abs(seed - Math.floor(seed));
      
      const cx = gx * GRID_CELL_SIZE + GRID_CELL_SIZE / 2;
      const cy = gy * GRID_CELL_SIZE + GRID_CELL_SIZE / 2;
      
      const jitterX = (Math.cos(seed * 11) * GRID_CELL_SIZE * 0.4);
      const jitterY = (Math.sin(seed * 22) * GRID_CELL_SIZE * 0.4);
      const pos = { x: cx + jitterX, y: cy + jitterY };

      if (Math.abs(gx) < 2 && Math.abs(gy) < 2) return null;

      if (val > 0.85) { 
          const isWide = val > 0.95;
          return {
              id: `b-${gx}-${gy}`, type: 'building', pos,
              size: { x: isWide ? 180 : 120, y: 100 + val * 50 },
              color: val > 0.92 ? '#1f2937' : '#374151'
          };
      } else if (val > 0.3) { 
          return {
              id: `t-${gx}-${gy}`, type: 'tree', pos,
              size: { x: 40 + val * 40, y: 0 },
              color: val > 0.6 ? '#166534' : '#15803d'
          };
      }
      return null;
  };

  const getEnvironmentInRect = (x: number, y: number, w: number, h: number): EnvironmentObject[] => {
      const startX = Math.floor((x - w/2) / GRID_CELL_SIZE);
      const endX = Math.floor((x + w/2) / GRID_CELL_SIZE);
      const startY = Math.floor((y - h/2) / GRID_CELL_SIZE);
      const endY = Math.floor((y + h/2) / GRID_CELL_SIZE);

      const objects: EnvironmentObject[] = [];
      for (let gx = startX - 1; gx <= endX + 1; gx++) {
          for (let gy = startY - 1; gy <= endY + 1; gy++) {
              const obj = getEnvironmentAt(gx, gy);
              if (obj) objects.push(obj);
          }
      }
      return objects;
  };

  const spawnBullet = (pos: Vector2, vel: Vector2, ownerId: string, bulletType: WeaponType | 'enemy_normal') => {
    let damage = 15;
    let radius = 4;
    let lifeTime = 120;
    let color = ownerId.startsWith('p') ? '#ffea00' : '#ff4444';

    // Stats based on weapon type
    switch (bulletType) {
        case 'sniper':
            damage = 150; radius = 5; lifeTime = 100; color = '#60a5fa'; break;
        case 'shotgun':
            damage = 12; radius = 3; lifeTime = 30; color = '#f97316'; break;
        case 'minigun':
            damage = 8; radius = 3; lifeTime = 60; color = '#fbbf24'; break;
        case 'laser':
            damage = 25; radius = 4; lifeTime = 80; color = '#4ade80'; break;
        case 'ak47':
            damage = 20; radius = 4; lifeTime = 80; color = '#fcd34d'; break;
        case 'enemy_normal':
            damage = 10; radius = 6; lifeTime = 100; color = '#ef4444'; break;
    }

    bulletsRef.current.push({
      id: Math.random().toString(),
      pos: { ...pos }, vel, radius, color, ownerId,
      damage, lifeTime, isReflected: false, bulletType
    });

    if (bulletType !== 'enemy_normal') {
       spawnParticle(pos, color, 3, 'spark');
    }
  };

  const spawnParticle = (pos: Vector2, color: string, count: number, type: 'blood' | 'spark' | 'smoke' = 'spark') => {
    for (let i = 0; i < count; i++) {
      const speed = Math.random() * 4 + 1;
      const angle = Math.random() * Math.PI * 2;
      particlesRef.current.push({
        id: Math.random().toString(),
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color: color,
        size: Math.random() * 4 + 2,
        type
      });
    }
  };

  const spawnEnemy = (isBoss: boolean = false) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 800 + Math.random() * 200;
    const center = getCameraCenter();
    const spawnPos = { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance };

    const visuals = {
        hue: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.5,
        hasArmor: Math.random() > 0.7,
        hasHorns: Math.random() > 0.5,
        hasEye: Math.random() > 0.5
    };

    if (isBoss) {
      enemiesRef.current.push({
        id: 'boss', type: 'boss', enemyType: 'boss',
        pos: spawnPos, vel: { x: 0, y: 0 },
        radius: 80, color: '#991b1b', rotation: 0, animFrame: 0,
        hp: 1500 * (levelInfo?.levelNumber || 1), maxHp: 1500 * (levelInfo?.levelNumber || 1),
        dead: false, targetId: null, attackCooldown: 0,
        visuals: { ...visuals, scale: 2.0, hasArmor: true, hasHorns: true }
      });
    } else {
      const type = Math.random() > 0.6 ? 'shooter' : 'walker';
      let hp = (50 + (levelInfo?.levelNumber || 1) * 10) * visuals.scale;
      if (visuals.hasArmor) hp *= 1.5;

      enemiesRef.current.push({
        id: Math.random().toString(), type: 'enemy', enemyType: type,
        pos: spawnPos, vel: { x: 0, y: 0 },
        radius: (type === 'shooter' ? 25 : 30) * visuals.scale, 
        rotation: 0, animFrame: 0,
        color: type === 'shooter' ? `hsl(${visuals.hue}, 70%, 45%)` : `hsl(${visuals.hue}, 60%, 40%)`,
        hp: hp, maxHp: hp, dead: false, targetId: null, attackCooldown: 0, visuals
      });
    }
  };

  const spawnCrystal = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 1600; // Much wider spread
    const center = getCameraCenter();
    crystalsRef.current.push({
      id: Math.random().toString(), type: 'crystal',
      pos: { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance },
      vel: { x: 0, y: 0 }, radius: 15, color: '#d8b4fe', rotation: Math.random() * Math.PI,
      hp: 1, maxHp: 1, dead: false, animFrame: 0
    });
  };

  const spawnCrate = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 300 + Math.random() * 1000;
    const center = getCameraCenter();
    cratesRef.current.push({
        id: Math.random().toString(), type: 'crate',
        pos: { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance },
        vel: {x:0, y:0}, radius: 25, color: '#f97316', rotation: 0,
        hp: 30, maxHp: 30, dead: false
    });
  };

  const spawnPickup = (pos: Vector2) => {
      const weapons: WeaponType[] = ['shotgun', 'minigun', 'laser', 'sniper', 'ak47'];
      const randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];
      
      pickupsRef.current.push({
          id: Math.random().toString(), type: 'pickup',
          pos: { ...pos }, vel: {x:0, y:0}, radius: 15, color: '#fff', rotation: 0,
          hp: 1, maxHp: 1, dead: false,
          weaponType: randomWeapon, lifeTime: 1800 // 30 seconds
      });
  };

  const getCameraCenter = () => {
    const alivePlayers = playersRef.current.filter(p => !p.dead);
    if (alivePlayers.length === 0) return { x: 0, y: 0 };
    const sum = alivePlayers.reduce((acc, p) => ({ x: acc.x + p.pos.x, y: acc.y + p.pos.y }), { x: 0, y: 0 });
    return { x: sum.x / alivePlayers.length, y: sum.y / alivePlayers.length };
  };

  const checkEnvironmentCollision = (entity: Entity) => {
    const nearby = getEnvironmentInRect(entity.pos.x, entity.pos.y, 300, 300);
    for (const env of nearby) {
        if (env.type === 'tree') {
            const dx = entity.pos.x - env.pos.x;
            const dy = entity.pos.y - env.pos.y;
            const dist = Math.hypot(dx, dy);
            const minDist = env.size.x + entity.radius;
            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const push = minDist - dist;
                entity.pos.x += Math.cos(angle) * push;
                entity.pos.y += Math.sin(angle) * push;
                entity.vel.x *= 0.8; entity.vel.y *= 0.8;
            }
        } else if (env.type === 'building') {
            const halfW = env.size.x / 2;
            const halfH = env.size.y / 2;
            const clampX = Math.max(env.pos.x - halfW, Math.min(entity.pos.x, env.pos.x + halfW));
            const clampY = Math.max(env.pos.y - halfH, Math.min(entity.pos.y, env.pos.y + halfH));
            const dx = entity.pos.x - clampX;
            const dy = entity.pos.y - clampY;
            const dist = Math.hypot(dx, dy);
            if (dist < entity.radius) {
                const angle = Math.atan2(dy, dx);
                const push = entity.radius - dist;
                entity.pos.x += Math.cos(angle) * push;
                entity.pos.y += Math.sin(angle) * push;
                entity.vel.x *= 0.5; entity.vel.y *= 0.5;
            }
        }
    }
  };

  // --- FIRE WEAPON LOGIC ---
  const fireWeapon = (p: Player) => {
      const muzzleDist = 35;
      const muzzlePos = {
          x: p.pos.x + Math.cos(p.rotation) * muzzleDist,
          y: p.pos.y + Math.sin(p.rotation) * muzzleDist
      };

      if (p.weapon === 'sniper') {
          const vel = { x: Math.cos(p.rotation) * 35, y: Math.sin(p.rotation) * 35 };
          spawnBullet(muzzlePos, vel, p.id, 'sniper');
          p.maxCooldown = 90;
          p.vel.x -= Math.cos(p.rotation) * 8; p.vel.y -= Math.sin(p.rotation) * 8;
      } 
      else if (p.weapon === 'shotgun') {
          for(let i=-2; i<=2; i++) {
              const spread = i * 0.15;
              const vel = { 
                  x: Math.cos(p.rotation + spread) * 12, 
                  y: Math.sin(p.rotation + spread) * 12 
              };
              spawnBullet(muzzlePos, vel, p.id, 'shotgun');
          }
          p.maxCooldown = 60;
          p.vel.x -= Math.cos(p.rotation) * 6; p.vel.y -= Math.sin(p.rotation) * 6;
      }
      else if (p.weapon === 'minigun') {
          const spread = (Math.random() - 0.5) * 0.4;
          const vel = { x: Math.cos(p.rotation + spread) * 18, y: Math.sin(p.rotation + spread) * 18 };
          spawnBullet(muzzlePos, vel, p.id, 'minigun');
          p.maxCooldown = 4;
          p.vel.x -= Math.cos(p.rotation) * 0.5; p.vel.y -= Math.sin(p.rotation) * 0.5;
      }
      else if (p.weapon === 'laser') {
          const vel = { x: Math.cos(p.rotation) * 25, y: Math.sin(p.rotation) * 25 };
          spawnBullet(muzzlePos, vel, p.id, 'laser');
          p.maxCooldown = 25;
      }
      else { // AK47
          const spread = (Math.random() - 0.5) * 0.1;
          const vel = { x: Math.cos(p.rotation + spread) * 16, y: Math.sin(p.rotation + spread) * 16 };
          spawnBullet(muzzlePos, vel, p.id, 'ak47');
          p.maxCooldown = 10;
          p.vel.x -= Math.cos(p.rotation) * 1; p.vel.y -= Math.sin(p.rotation) * 1;
      }

      p.cooldown = p.maxCooldown;
  };

  const update = () => {
    const activePlayers = playersRef.current.filter(p => !p.dead);
    
    if (activePlayers.length === 0) {
      onGameOver();
      return;
    }

    const boss = enemiesRef.current.find(e => e.type === 'boss');
    if (bossSpawnedRef.current && !boss) {
      onLevelComplete();
      return;
    }

    waveTimerRef.current++;
    if (!bossSpawnedRef.current) {
      if (waveTimerRef.current % 120 === 0 && enemiesRef.current.length < 30) spawnEnemy();
      if (crystalsRef.current.length < 15 && waveTimerRef.current % 60 === 0) spawnCrystal(); // Spawn crystals often
      if (cratesRef.current.length < 5 && waveTimerRef.current % 300 === 0) spawnCrate();
      
      if (crystalsCollectedRef.current >= CRYSTALS_TO_BOSS) {
        spawnEnemy(true);
        bossSpawnedRef.current = true;
      }
    }

    // Player Update
    playersRef.current.forEach(p => {
      if (p.dead) return;

      const force = { x: 0, y: 0 };
      const isBoy = p.role === 'boy';
      
      // Controls
      if (isBoy) {
        if (keysPressed.current.has('KeyW')) force.y -= ACCELERATION;
        if (keysPressed.current.has('KeyS')) force.y += ACCELERATION;
        if (keysPressed.current.has('KeyA')) force.x -= ACCELERATION;
        if (keysPressed.current.has('KeyD')) force.x += ACCELERATION;
      } else {
        if (keysPressed.current.has('ArrowUp')) force.y -= ACCELERATION;
        if (keysPressed.current.has('ArrowDown')) force.y += ACCELERATION;
        if (keysPressed.current.has('ArrowLeft')) force.x -= ACCELERATION;
        if (keysPressed.current.has('ArrowRight')) force.x += ACCELERATION;
      }

      // Auto Aim Logic
      let target = null;
      let minDist = 1200; 
      enemiesRef.current.forEach(e => {
          const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
          if (d < minDist) { minDist = d; target = e; }
      });

      if (target) {
         p.rotation = Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x);
      } else if (Math.abs(force.x) > 0 || Math.abs(force.y) > 0) {
         p.rotation = Math.atan2(force.y, force.x);
      }

      // Shooting
      const fireKey = isBoy ? 'Space' : 'Enter';
      if (keysPressed.current.has(fireKey) && p.cooldown <= 0) {
          fireWeapon(p);
      }

      // Physics
      p.vel.x += force.x; p.vel.y += force.y;
      p.vel.x *= FRICTION; p.vel.y *= FRICTION;
      
      const currSpeed = Math.hypot(p.vel.x, p.vel.y);
      if (currSpeed > MAX_SPEED) {
          p.vel.x = (p.vel.x / currSpeed) * MAX_SPEED;
          p.vel.y = (p.vel.y / currSpeed) * MAX_SPEED;
      }

      p.pos.x += p.vel.x; p.pos.y += p.vel.y;
      checkEnvironmentCollision(p);
      p.animFrame += currSpeed * 0.15;
      if (p.cooldown > 0) p.cooldown--;
    });

    // Interaction with Crate/Pickups
    playersRef.current.filter(p => !p.dead).forEach(p => {
        // Crates (Touch to open)
        cratesRef.current.forEach(c => {
             if (c.dead) return;
             if (Math.hypot(c.pos.x - p.pos.x, c.pos.y - p.pos.y) < p.radius + c.radius) {
                 c.dead = true;
                 spawnParticle(c.pos, '#f97316', 10, 'spark');
                 spawnPickup(c.pos);
             }
        });
        
        // Pickups
        pickupsRef.current.forEach(pk => {
            if (pk.dead) return;
            if (Math.hypot(pk.pos.x - p.pos.x, pk.pos.y - p.pos.y) < p.radius + pk.radius) {
                pk.dead = true;
                p.weapon = pk.weaponType;
                spawnParticle(p.pos, '#fff', 10, 'spark');
                // Create floating text effect? Just simpler for now
            }
        });
    });
    cratesRef.current = cratesRef.current.filter(c => !c.dead);
    pickupsRef.current = pickupsRef.current.filter(p => !p.dead);

    // Enemy AI
    const enemies = enemiesRef.current;
    enemies.forEach((e, i) => {
      let target = activePlayers[0];
      let minDist = Infinity;
      activePlayers.forEach(p => {
        const d = Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y);
        if (d < minDist) { minDist = d; target = p; }
      });

      if (target) {
        const dx = target.pos.x - e.pos.x;
        const dy = target.pos.y - e.pos.y;
        const dist = Math.hypot(dx, dy);
        e.rotation = Math.atan2(dy, dx);
        
        const baseSpeed = e.enemyType === 'boss' ? 0.2 : (e.enemyType === 'shooter' ? 0.25 : 0.35);
        const speedMod = 1 / e.visuals.scale; 
        const speed = baseSpeed * speedMod;
        
        const moveForce = { x: 0, y: 0 };
        if (e.enemyType === 'shooter' && dist < 300) {
            moveForce.x -= Math.cos(e.rotation) * speed;
            moveForce.y -= Math.sin(e.rotation) * speed;
        } else {
            moveForce.x += Math.cos(e.rotation) * speed;
            moveForce.y += Math.sin(e.rotation) * speed;
        }

        // Flocking
        enemies.forEach((other, j) => {
            if (i === j) return;
            const diffX = e.pos.x - other.pos.x;
            const diffY = e.pos.y - other.pos.y;
            const d = Math.hypot(diffX, diffY);
            const repelDist = e.radius + other.radius + 20;
            if (d < repelDist && d > 0) {
                const repelForce = (repelDist - d) / repelDist; 
                moveForce.x += (diffX / d) * repelForce * 0.8; 
                moveForce.y += (diffY / d) * repelForce * 0.8;
            }
        });

        e.vel.x += moveForce.x; e.vel.y += moveForce.y;

        if (e.enemyType === 'shooter' && e.attackCooldown <= 0 && dist < 550) {
          const angle = Math.atan2(target.pos.y - e.pos.y, target.pos.x - e.pos.x);
          spawnBullet(e.pos, { x: Math.cos(angle)*7, y: Math.sin(angle)*7 }, e.id, 'enemy_normal');
          e.attackCooldown = 80 + Math.random() * 40;
        } else if (e.enemyType === 'boss' && e.attackCooldown <= 0) {
           for(let k=0; k<16; k++) {
             const a = e.rotation + (Math.PI/8)*k;
             spawnBullet(e.pos, { x: Math.cos(a)*5, y: Math.sin(a)*5 }, e.id, 'enemy_normal');
           }
           e.attackCooldown = 120;
        }
        if (e.attackCooldown > 0) e.attackCooldown--;
      }
      e.vel.x *= FRICTION; e.vel.y *= FRICTION;
      e.pos.x += e.vel.x; e.pos.y += e.vel.y;
      checkEnvironmentCollision(e);
      e.animFrame += Math.hypot(e.vel.x, e.vel.y) * 0.1;
    });

    // Crystal Collection
    crystalsRef.current = crystalsRef.current.filter(c => {
       let collected = false;
       for (const p of activePlayers) {
         if (Math.hypot(p.pos.x - c.pos.x, p.pos.y - c.pos.y) < 50) {
           collected = true;
           spawnParticle(c.pos, '#a855f7', 15, 'spark');
           crystalsCollectedRef.current = crystalsCollectedRef.current + 1;
           p.score += 50;
           break; 
         }
       }
       return !collected;
    });

    // Bullet Updates (Collision)
    const bulletEnvironment = getEnvironmentInRect(cameraRef.current.x, cameraRef.current.y, window.innerWidth * 1.5, window.innerHeight * 1.5);

    bulletsRef.current.forEach(b => {
      // Homing for Sniper
      if (b.bulletType === 'sniper') {
        let bTarget = null;
        let bMinDist = 800;
        enemiesRef.current.forEach(e => {
            const d = Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y);
            if (d < bMinDist) { bMinDist = d; bTarget = e; }
        });
        if (bTarget) {
            const targetAngle = Math.atan2(bTarget.pos.y - b.pos.y, bTarget.pos.x - b.pos.x);
            const currentSpeed = Math.hypot(b.vel.x, b.vel.y);
            b.vel.x += (Math.cos(targetAngle)*currentSpeed - b.vel.x) * 0.2;
            b.vel.y += (Math.sin(targetAngle)*currentSpeed - b.vel.y) * 0.2;
        }
      }

      b.pos.x += b.vel.x; b.pos.y += b.vel.y;
      b.lifeTime--;

      // Environment Wall
      for (const env of bulletEnvironment) {
          if (env.type === 'building') {
              const halfW = env.size.x / 2;
              const halfH = env.size.y / 2;
              if (b.pos.x > env.pos.x - halfW && b.pos.x < env.pos.x + halfW &&
                  b.pos.y > env.pos.y - halfH && b.pos.y < env.pos.y + halfH) {
                  b.lifeTime = 0; spawnParticle(b.pos, '#555', 5, 'smoke'); break;
              }
          }
      }
      
      if (b.lifeTime <= 0) return;

      // Entity Collision
      const targets = b.ownerId.startsWith('p') ? enemiesRef.current : playersRef.current;
      const crateTargets = b.ownerId.startsWith('p') ? cratesRef.current : [];
      
      // Hit Crate
      for (const c of crateTargets) {
          if (c.dead) continue;
          if (Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y) < c.radius + b.radius) {
              c.hp -= b.damage;
              b.lifeTime = 0;
              spawnParticle(b.pos, '#f97316', 3, 'spark');
              if (c.hp <= 0) {
                  c.dead = true;
                  spawnParticle(c.pos, '#f97316', 15, 'spark');
                  spawnPickup(c.pos);
              }
              break;
          }
      }

      // Hit Enemies/Players
      if (b.lifeTime > 0) {
          for (const t of targets) {
              if ((t as Entity).dead) continue;
              if (Math.hypot(b.pos.x - t.pos.x, b.pos.y - t.pos.y) < t.radius + b.radius) {
                  t.hp -= b.damage;
                  b.lifeTime = 0;
                  spawnParticle(b.pos, t.color, 5, 'blood');
                  if (t.hp <= 0) {
                      t.dead = true;
                      spawnParticle(t.pos, t.color, 20, 'blood');
                      if (t.type === 'enemy' || t.type === 'boss') activePlayers.forEach(p => p.score += 100);
                  }
                  break;
              }
          }
      }
    });

    bulletsRef.current = bulletsRef.current.filter(b => b.lifeTime > 0);
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead);
    
    // Particles
    particlesRef.current.forEach(p => {
      p.pos.x += p.vel.x; p.pos.y += p.vel.y;
      p.life--;
      p.vel.x *= 0.9; p.vel.y *= 0.9;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Smooth Camera
    const targetCam = getCameraCenter();
    cameraRef.current.x += (targetCam.x - cameraRef.current.x) * 0.05;
    cameraRef.current.y += (targetCam.y - cameraRef.current.y) * 0.05;
  };

  // --- RENDERING HELPERS ---
  const drawHumanoid = (ctx: CanvasRenderingContext2D, entity: Entity, isPlayer: boolean) => {
      ctx.save();
      ctx.translate(entity.pos.x, entity.pos.y);
      ctx.rotate(entity.rotation);
      
      const animOffset = Math.sin((entity as any).animFrame || 0) * 3;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(-5, 5, entity.radius, entity.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isPlayer) {
          // Body
          ctx.fillStyle = entity.color;
          ctx.fillRect(-12, -12, 24, 24);
          ctx.fillStyle = '#ffdbac'; 
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

          // Weapon Vis
          const p = entity as Player;
          const wColor = p.weapon === 'sniper' ? '#111' : (p.weapon === 'ak47' ? '#4b5563' : (p.weapon === 'laser' ? '#fff' : '#333'));
          const wLen = p.weapon === 'sniper' ? 45 : (p.weapon === 'ak47' ? 30 : 25);
          
          ctx.fillStyle = wColor;
          ctx.fillRect(5, 5 + animOffset, wLen, 5); 
          if(p.weapon === 'sniper') {
             ctx.fillStyle = '#22c55e'; ctx.fillRect(25, 1+animOffset, 2, 2); // Scope
          }
      } else {
          // Enemy
          const e = entity as Enemy;
          if (e.visuals) {
              const { hue, scale, hasArmor } = e.visuals;
              ctx.scale(scale, scale);
              ctx.fillStyle = entity.color;
              if (hasArmor) {
                 ctx.fillRect(-15, -15, 30, 30);
                 ctx.fillStyle = `hsl(${hue}, 40%, 60%)`; ctx.fillRect(-10, -10, 20, 20);
              } else {
                 ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
              }
              // Limbs
              ctx.strokeStyle = entity.color; ctx.lineWidth = 4;
              ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(20 + animOffset, 20); ctx.moveTo(-10, 10); ctx.lineTo(-20 - animOffset, 20); ctx.stroke();
          } else {
              // Fallback for non-enemies (should not happen with correct calls)
              ctx.fillStyle = entity.color;
              ctx.beginPath(); ctx.arc(0,0, entity.radius, 0, Math.PI*2); ctx.fill();
          }
      }

      ctx.restore();
      
      // HP
      ctx.save();
      ctx.translate(entity.pos.x, entity.pos.y);
      ctx.fillStyle = 'black'; ctx.fillRect(-20, -entity.radius - 20, 40, 6);
      ctx.fillStyle = isPlayer ? '#22c55e' : (entity.type === 'crate' ? '#f97316' : '#ef4444');
      ctx.fillRect(-20, -entity.radius - 20, 40 * (entity.hp / entity.maxHp), 6);
      ctx.restore();
  };

  const drawBuilding = (ctx: CanvasRenderingContext2D, env: EnvironmentObject) => {
      ctx.save();
      ctx.translate(env.pos.x, env.pos.y);
      const w = env.size.x; const h = env.size.y; const roofH = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w/2 + 10, -h/2 + 10, w, h);
      ctx.fillStyle = '#111827'; ctx.fillRect(-w/2, -h/2, w, h);
      ctx.fillStyle = env.color; ctx.fillRect(-w/2, -h/2 - roofH, w, h);
      ctx.fillStyle = '#4b5563'; ctx.fillRect(-w/2, -h/2 - roofH - 10, w, 10);
      ctx.shadowBlur = 10; ctx.shadowColor = Math.random() > 0.5 ? '#facc15' : '#0ea5e9'; ctx.fillStyle = ctx.shadowColor;
      const seed = env.pos.x + env.pos.y;
      for(let i= -w/2 + 15; i < w/2 - 15; i+= 25) {
          for(let j= -h/2 - roofH + 15; j < h/2 - 20; j+= 30) {
              if (Math.sin(i * j + seed) > 0.2) ctx.fillRect(i, j, 12, 18);
          }
      }
      ctx.restore();
  };

  const drawTree = (ctx: CanvasRenderingContext2D, env: EnvironmentObject) => {
      ctx.save(); ctx.translate(env.pos.x, env.pos.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(5, 5, env.size.x, env.size.x * 0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3f2c22'; ctx.fillRect(-5, -10, 10, 10);
      ctx.shadowBlur = 0;
      for (let i = 0; i < 3; i++) {
         ctx.fillStyle = i % 2 === 0 ? env.color : '#22c55e';
         ctx.beginPath();
         const r = env.size.x * (1 - i * 0.2);
         ctx.arc(0, -20 - (i * 15), r, 0, Math.PI * 2); ctx.fill();
         ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
  };

  const drawRadar = (ctx: CanvasRenderingContext2D, canvasWidth: number) => {
      const radarSize = 150;
      const radarX = canvasWidth - radarSize - 20;
      const radarY = 160;
      const range = 2500; // 2500px radius detection
      const scale = radarSize / range;
      const cam = cameraRef.current;

      // Background
      ctx.save();
      ctx.beginPath();
      ctx.arc(radarX, radarY, radarSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 20, 0, 0.7)';
      ctx.fill();
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scanline
      ctx.beginPath();
      ctx.moveTo(radarX, radarY);
      const scanAngle = (frameIdRef.current * 0.05) % (Math.PI * 2);
      ctx.lineTo(radarX + Math.cos(scanAngle) * radarSize, radarY + Math.sin(scanAngle) * radarSize);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.stroke();

      // Helper to draw blip
      const drawBlip = (pos: Vector2, color: string, size: number) => {
          const dx = pos.x - cam.x;
          const dy = pos.y - cam.y;
          if (Math.abs(dx) < range && Math.abs(dy) < range) {
             const dist = Math.hypot(dx, dy);
             if (dist < range) {
                 ctx.fillStyle = color;
                 ctx.beginPath();
                 ctx.arc(radarX + dx * scale, radarY + dy * scale, size, 0, Math.PI * 2);
                 ctx.fill();
             }
          }
      };

      playersRef.current.forEach(p => !p.dead && drawBlip(p.pos, 'white', 3));
      enemiesRef.current.forEach(e => !e.dead && drawBlip(e.pos, e.type === 'boss' ? 'red' : 'rgba(255,0,0,0.5)', e.type === 'boss' ? 5 : 2));
      crystalsRef.current.forEach(c => !c.dead && drawBlip(c.pos, '#d8b4fe', 3));
      cratesRef.current.forEach(c => !c.dead && drawBlip(c.pos, '#f97316', 3));

      ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.fillStyle = '#0f172a'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const camX = Math.floor(cameraRef.current.x - canvas.width / 2);
    const camY = Math.floor(cameraRef.current.y - canvas.height / 2);
    ctx.translate(-camX, -camY);

    // Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
    const gridSize = 100;
    const startX = Math.floor(camX / gridSize) * gridSize;
    const startY = Math.floor(camY / gridSize) * gridSize;
    ctx.beginPath();
    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        ctx.moveTo(x, startY); ctx.lineTo(x, startY + canvas.height + gridSize);
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        ctx.moveTo(startX, y); ctx.lineTo(startX + canvas.width + gridSize, y);
    }
    ctx.stroke();

    const visibleEnv = getEnvironmentInRect(cameraRef.current.x, cameraRef.current.y, canvas.width + 200, canvas.height + 200);

    const renderList: { y: number, draw: () => void }[] = [];

    playersRef.current.forEach(p => { if (!p.dead) renderList.push({ y: p.pos.y, draw: () => drawHumanoid(ctx, p, true) }); });
    enemiesRef.current.forEach(e => renderList.push({ y: e.pos.y, draw: () => drawHumanoid(ctx, e, false) }));
    cratesRef.current.forEach(c => renderList.push({ y: c.pos.y, draw: () => {
         ctx.save(); ctx.translate(c.pos.x, c.pos.y);
         ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 10, 20, 10, 0, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#c2410c'; ctx.fillRect(-15, -15, 30, 30);
         ctx.fillStyle = '#fdba74'; ctx.fillRect(-12, -12, 24, 6);
         
         // HP Bar for Crate
         ctx.fillStyle = 'black'; ctx.fillRect(-20, -35, 40, 6);
         ctx.fillStyle = '#f97316'; ctx.fillRect(-20, -35, 40 * (c.hp / c.maxHp), 6);
         
         ctx.restore();
    }}));
    
    // Pickups
    pickupsRef.current.forEach(pk => renderList.push({ y: pk.pos.y, draw: () => {
        ctx.save(); ctx.translate(pk.pos.x, pk.pos.y);
        ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
        const floatY = Math.sin(frameIdRef.current * 0.1) * 5;
        ctx.fillStyle = '#fff'; ctx.fillText('🔫', -10, floatY);
        ctx.font = '10px monospace'; ctx.fillText(pk.weaponType.toUpperCase(), -20, floatY - 20);
        ctx.restore();
    }}));

    visibleEnv.forEach(env => {
        renderList.push({ y: env.pos.y + (env.type === 'building' ? env.size.y/2 : 0), draw: () => env.type === 'building' ? drawBuilding(ctx, env) : drawTree(ctx, env) });
    });

    crystalsRef.current.forEach(c => {
        renderList.push({ y: c.pos.y, draw: () => {
            ctx.save(); ctx.translate(c.pos.x, c.pos.y);
            ctx.translate(0, Math.sin(frameIdRef.current * 0.1) * 5);
            ctx.shadowBlur = 20; ctx.shadowColor = c.color; ctx.fillStyle = c.color;
            ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, 0); ctx.lineTo(0, 15); ctx.lineTo(-10, 0); ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        }});
    });

    renderList.sort((a, b) => a.y - b.y);
    renderList.forEach(item => item.draw());

    // Bullets
    bulletsRef.current.forEach(b => {
      ctx.save(); ctx.translate(b.pos.x, b.pos.y);
      ctx.fillStyle = b.color;
      if (b.lifeTime < 8 && b.radius > 20) {
        ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.shadowBlur = 10; ctx.shadowColor = b.color;
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    particlesRef.current.forEach(p => {
      ctx.save(); ctx.translate(p.pos.x, p.pos.y);
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      const size = p.type === 'blood' ? p.size : p.size * 2;
      ctx.fillRect(-size/2, -size/2, size, size);
      ctx.restore();
    });

    ctx.restore();

    // --- HUD ---
    ctx.font = 'bold 24px monospace'; ctx.textAlign = 'right';
    ctx.shadowBlur = 4; ctx.shadowColor = 'black';
    
    const crystals = crystalsCollectedRef.current;
    const maxCrystals = CRYSTALS_TO_BOSS;
    const progress = Math.min(1, crystals / maxCrystals);
    
    ctx.fillStyle = '#4c1d95'; ctx.fillRect(canvas.width - 320, 20, 300, 30);
    ctx.fillStyle = '#a855f7'; ctx.fillRect(canvas.width - 320, 20, 300 * progress, 30);
    ctx.fillStyle = 'white'; ctx.fillText(`${crystals} / ${maxCrystals} Crystals`, canvas.width - 30, 43);

    // Radar
    drawRadar(ctx, canvas.width);

    if (bossSpawnedRef.current) {
        ctx.fillStyle = '#ff4444'; ctx.font = 'bold 30px monospace';
        ctx.fillText(`WARNING: BOSS DETECTED`, canvas.width - 30, 80);
    }
  };

  const loop = () => {
    update();
    draw();
    frameIdRef.current = requestAnimationFrame(loop);
  };

  return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full cursor-crosshair" />;
};

export default GameCanvas;