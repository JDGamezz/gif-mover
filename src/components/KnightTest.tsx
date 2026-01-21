import { useState, useEffect, useCallback, useRef } from "react";

// Import all knight animations
import idleRight from "@/assets/Idle_Animation_Knight_Right.gif";
import idleLeft from "@/assets/Idle_Animation_Knight_Left.gif";
import runRight from "@/assets/Knight_Running_Right.gif";
import runLeft from "@/assets/Knight_Running_Left.gif";
import attackRight from "@/assets/Knight_Normal_Attack.gif";
import attackLeft from "@/assets/Knight_Normal_Attack_Left.gif";
import crouchWalkRight from "@/assets/Crouch_Walking_Right.gif";
import crouchWalkLeft from "@/assets/Crouch_Walking_Left.gif";
import crouchAttackRight from "@/assets/Crouch_Attack_Right.gif";
import crouchAttackLeft from "@/assets/Crouch_Attack_Left.gif";
import fireEnemy from "@/assets/fire-enemy.gif";
import candleEnemyLeft from "@/assets/candle_enemy_left.gif";
import candleEnemyRight from "@/assets/candle_enemy_right.gif";
import candleEnemyIdle from "@/assets/candle_enemy_idle.gif";
import candleDissolvingGif from "@/assets/candle_enemy_dissolving.gif";
import fireBoss from "@/assets/fire_boss.gif";

// Level backgrounds
import bgLevel1 from "@/assets/bg_level_1.png";
import bgLevel2 from "@/assets/bg_level_2.png";
import bgLevel3 from "@/assets/bg_level_3.png";
import bgBoss from "@/assets/bg_boss.png";

// Music
import titleMainMusic from "@/assets/title_main_music.webm";
import bossMusic from "@/assets/boss_music.webm";

type Direction = "left" | "right";
type State = "idle" | "run" | "attack" | "crouch-idle" | "crouch-walk" | "crouch-attack";
type GameState = "menu" | "playing" | "boss" | "level-complete" | "game-over";
type EnemyType = "fire";
type BossType = "candle" | "fire";

const animations: Record<string, string> = {
  "idle-right": idleRight,
  "idle-left": idleLeft,
  "run-right": runRight,
  "run-left": runLeft,
  "attack-right": attackRight,
  "attack-left": attackLeft,
  "crouch-idle-right": crouchWalkRight,
  "crouch-idle-left": crouchWalkLeft,
  "crouch-walk-right": crouchWalkRight,
  "crouch-walk-left": crouchWalkLeft,
  "crouch-attack-right": crouchAttackRight,
  "crouch-attack-left": crouchAttackLeft,
};

// Level backgrounds mapping
const levelBackgrounds: Record<number, string> = {
  1: bgLevel1,
  2: bgLevel2,
  3: bgLevel3,
};

// Preload all animations
const preloadImages = () => {
  Object.values(animations).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
  [fireEnemy, candleEnemyLeft, candleEnemyRight, candleEnemyIdle, bgLevel1, bgLevel2, bgLevel3, bgBoss].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
preloadImages();

const scaleFactors: Record<State, number> = {
  "idle": 2,
  "run": 2,
  "attack": 2,
  "crouch-idle": 2,
  "crouch-walk": 2,
  "crouch-attack": 2,
};

const yOffsets: Record<State, number> = {
  "idle": 30,
  "run": 0,
  "attack": 30,
  "crouch-idle": 20,
  "crouch-walk": 20,
  "crouch-attack": 20,
};

interface Enemy {
  id: number;
  x: number;
  y: number; // Y position for isometric movement
  speed: number;
  type: EnemyType;
  health: number;
  maxHealth: number;
  direction: Direction;
  knockback: number;
  knockbackY: number; // Y knockback
  isHurt: boolean;
}

interface Boss {
  id: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  direction: Direction;
  isAttacking: boolean;
  attackCooldown: number;
  knockback: number;
  knockbackY: number;
  isHurt: boolean;
  type: BossType;
}

interface ScorePopup {
  id: number;
  x: number;
  y: number;
  value: number;
}

const SPAWN_POSITIONS = [5, 95];
const ATTACK_RANGE = 14; // Improved sword hitbox
const ATTACK_RANGE_Y = 40; // Better Y range for isometric attacks
const LEVEL_DURATION = 70;
const KNOCKBACK_FORCE = 8;
const KNOCKBACK_RECOVERY = 0.3;
const ENEMY_STATS = {
  fire: { health: 1, points: 10, speed: 0.3 },
};
const BOSS_STATS = {
  candle: { health: 50, speed: 0.12 }, // Levels 1-3 boss
  fire: { health: 100, speed: 0.10 },  // Level 4+ boss (double health)
};

// Isometric play area bounds (Y position in pixels, 0 = bottom, 150 = top of play area)
const PLAY_AREA_MIN_Y = 0;
const PLAY_AREA_MAX_Y = 87;

export const KnightTest = () => {
  const [direction, setDirection] = useState<Direction>("right");
  const [state, setState] = useState<State>("idle");
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(60); // Y position for isometric movement
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [isAttacking, setIsAttacking] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [score, setScore] = useState(0);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(LEVEL_DURATION);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [bossLoopCount, setBossLoopCount] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  const [defeatedBoss, setDefeatedBoss] = useState<{ type: BossType; x: number; y: number; timestamp: number } | null>(null);
  
  const enemyIdRef = useRef(0);
  const popupIdRef = useRef(0);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mainMusicRef = useRef<HTMLAudioElement | null>(null);
  const bossMusicRef = useRef<HTMLAudioElement | null>(null);

  const currentAnimation = animations[`${state}-${direction}`];
  const currentScale = scaleFactors[state];
  const currentYOffset = yOffsets[state];

  // Get current background based on level and game state
  const getCurrentBackground = () => {
    if (gameState === "boss") return bgBoss;
    return levelBackgrounds[currentLevel] || bgLevel1;
  };

  const getBossHealthMultiplier = () => 1 + bossLoopCount * 0.5;
  const getBossAggressionMultiplier = () => 1 + bossLoopCount * 0.3;

  const startGame = useCallback(() => {
    setGameState("playing");
    setCurrentLevel(1);
    setTimeRemaining(LEVEL_DURATION);
    setScore(0);
    setPlayerHealth(100);
    setEnemies([]);
    setBoss(null);
    setDefeatedBoss(null);
    setPositionX(50);
    setPositionY(60);
    setBossLoopCount(0);
    setBackgroundOffset(0);
    setIsCrouching(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (gameState !== "playing") return;
    
    const spawnX = SPAWN_POSITIONS[Math.floor(Math.random() * SPAWN_POSITIONS.length)];
    const spawnY = Math.random() * PLAY_AREA_MAX_Y; // Random Y position
    const type: EnemyType = "fire"; // Only fire enemies spawn
    const stats = ENEMY_STATS[type];
    
    const newEnemy: Enemy = {
      id: enemyIdRef.current++,
      x: spawnX,
      y: spawnY,
      speed: stats.speed + Math.random() * 0.1,
      type,
      health: stats.health,
      maxHealth: stats.health,
      direction: spawnX < 50 ? "right" : "left",
      knockback: 0,
      knockbackY: 0,
      isHurt: false,
    };
    setEnemies((prev) => [...prev, newEnemy]);
  }, [gameState]);

  const spawnBoss = useCallback(() => {
    // Levels 1-3: Candle boss, Level 4+: Fire boss
    const bossType: BossType = currentLevel >= 4 ? "fire" : "candle";
    const baseStats = BOSS_STATS[bossType];
    const health = Math.floor(baseStats.health * getBossHealthMultiplier());
    
    setBoss({
      id: Date.now(),
      x: 85,
      y: 60,
      health,
      maxHealth: health,
      direction: "left",
      isAttacking: false,
      attackCooldown: 0,
      knockback: 0,
      knockbackY: 0,
      isHurt: false,
      type: bossType,
    });
  }, [currentLevel, bossLoopCount]);

  const attackEnemies = useCallback(() => {
    setEnemies((prev) => {
      const newEnemies: Enemy[] = [];
      let totalPoints = 0;
      const popupsToAdd: { x: number; y: number; value: number }[] = [];
      
      prev.forEach((enemy) => {
        const distanceX = Math.abs(enemy.x - positionX);
        const distanceY = Math.abs(enemy.y - positionY);
        const inFront = direction === "right" ? enemy.x > positionX : enemy.x < positionX;
        
        // Check both X and Y range for isometric hit detection
        if (distanceX < ATTACK_RANGE && distanceY < ATTACK_RANGE_Y && inFront) {
          const newHealth = enemy.health - 1;
          if (newHealth <= 0) {
            const points = ENEMY_STATS[enemy.type].points;
            totalPoints += points;
            popupsToAdd.push({ x: enemy.x, y: enemy.y, value: points });
          } else {
            const knockbackDir = direction === "right" ? 1 : -1;
            newEnemies.push({ 
              ...enemy, 
              health: newHealth,
              knockback: KNOCKBACK_FORCE * knockbackDir,
              knockbackY: (Math.random() - 0.5) * 4, // Random Y knockback
              isHurt: true,
            });
            setTimeout(() => {
              setEnemies(e => e.map(en => 
                en.id === enemy.id ? { ...en, isHurt: false } : en
              ));
            }, 150);
          }
        } else {
          newEnemies.push(enemy);
        }
      });
      
      if (totalPoints > 0) {
        setScore((s) => s + totalPoints);
        popupsToAdd.forEach(({ x, y, value }) => {
          const popupId = popupIdRef.current++;
          setScorePopups((p) => [...p, { id: popupId, x, y, value }]);
          setTimeout(() => {
            setScorePopups((p) => p.filter((popup) => popup.id !== popupId));
          }, 800);
        });
      }
      
      return newEnemies;
    });

    // Attack boss using functional update to get current boss state
    setBoss((currentBoss) => {
      if (!currentBoss) return null;
      
      const distanceX = Math.abs(currentBoss.x - positionX);
      const distanceY = Math.abs(currentBoss.y - positionY);
      const inFront = direction === "right" ? currentBoss.x > positionX : currentBoss.x < positionX;
      
      if (distanceX < ATTACK_RANGE && distanceY < ATTACK_RANGE_Y && inFront) {
        const newHealth = currentBoss.health - 1;
        if (newHealth <= 0) {
          const points = 100 * currentLevel;
          setScore((s) => s + points);
          const popupId = popupIdRef.current++;
          setScorePopups((p) => [...p, { id: popupId, x: currentBoss.x, y: currentBoss.y, value: points }]);
          setTimeout(() => {
            setScorePopups((p) => p.filter((popup) => popup.id !== popupId));
          }, 800);
          
          // Show dissolving animation for candle boss
          if (currentBoss.type === "candle") {
            setDefeatedBoss({ type: currentBoss.type, x: currentBoss.x, y: currentBoss.y, timestamp: Date.now() });
            setTimeout(() => {
              setDefeatedBoss(null);
            }, 2000);
          }
          
          setTimeout(() => {
            if (currentLevel >= 3) {
              setBossLoopCount((c) => c + 1);
              setGameState("boss");
              setCurrentLevel(1);
            } else {
              setGameState("level-complete");
            }
          }, currentBoss.type === "candle" ? 2000 : 500);
          
          return null;
        }
        
        const knockbackDir = direction === "right" ? 1 : -1;
        setTimeout(() => {
          setBoss(b => b ? { ...b, isHurt: false } : null);
        }, 150);
        
        return { 
          ...currentBoss, 
          health: newHealth,
          knockback: (KNOCKBACK_FORCE * 0.5) * knockbackDir,
          knockbackY: (Math.random() - 0.5) * 2,
          isHurt: true,
        };
      }
      
      return currentBoss;
    });
  }, [positionX, positionY, direction, currentLevel]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameState === "menu") {
      if (e.key === " " || e.key === "Enter") {
        startGame();
      }
      return;
    }
    
    if (gameState === "level-complete") {
      if (e.key === " " || e.key === "Enter") {
        setCurrentLevel((l) => l + 1);
        setTimeRemaining(LEVEL_DURATION);
        setEnemies([]);
        setGameState("playing");
      }
      return;
    }

    if (gameState === "game-over") {
      if (e.key === " " || e.key === "Enter") {
        startGame();
      }
      return;
    }

    setKeys((prev) => new Set(prev).add(e.key.toLowerCase()));
    
    // Crouch toggle with C
    if (e.key.toLowerCase() === "c") {
      setIsCrouching((prev) => !prev);
    }
    
    if (e.key === " " && !isAttacking && (gameState === "playing" || gameState === "boss")) {
      setIsAttacking(true);
      attackEnemies();
      setTimeout(() => setIsAttacking(false), 400);
    }
  }, [gameState, isAttacking, startGame, attackEnemies]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setKeys((prev) => {
      const next = new Set(prev);
      next.delete(e.key.toLowerCase());
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Music control
  useEffect(() => {
    // Initialize audio elements if not already
    if (!mainMusicRef.current) {
      mainMusicRef.current = new Audio(titleMainMusic);
      mainMusicRef.current.loop = true;
      mainMusicRef.current.volume = 0.5;
    }
    if (!bossMusicRef.current) {
      bossMusicRef.current = new Audio(bossMusic);
      bossMusicRef.current.loop = true;
      bossMusicRef.current.volume = 0.6;
    }

    const mainMusic = mainMusicRef.current;
    const bossAudio = bossMusicRef.current;

    if (gameState === "menu" || gameState === "playing" || gameState === "level-complete") {
      // Play main/title music
      bossAudio.pause();
      bossAudio.currentTime = 0;
      mainMusic.play().catch(() => {}); // Catch autoplay restriction
    } else if (gameState === "boss") {
      // Play boss music
      mainMusic.pause();
      mainMusic.currentTime = 0;
      bossAudio.play().catch(() => {});
    } else if (gameState === "game-over") {
      // Stop all music on game over
      mainMusic.pause();
      bossAudio.pause();
    }

    return () => {
      // Cleanup on unmount
    };
  }, [gameState]);

  // Level timer
  useEffect(() => {
    if (gameState !== "playing") return;
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setGameState("boss");
          spawnBoss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, spawnBoss]);

  // Enemy spawning
  useEffect(() => {
    if (gameState !== "playing") {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      return;
    }

    const spawnRate = Math.max(800, 2000 - (currentLevel - 1) * 400);
    
    spawnTimerRef.current = setInterval(() => {
      spawnEnemy();
    }, spawnRate);

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [gameState, currentLevel, spawnEnemy]);

  // Update player state
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const isMovingLeft = keys.has("arrowleft") || keys.has("a");
    const isMovingRight = keys.has("arrowright") || keys.has("d");
    const isMovingUp = keys.has("arrowup") || keys.has("w");
    const isMovingDown = keys.has("arrowdown") || keys.has("s");
    const isMoving = isMovingLeft || isMovingRight || isMovingUp || isMovingDown;

    if (isMovingLeft) setDirection("left");
    if (isMovingRight) setDirection("right");

    if (isAttacking) {
      setState(isCrouching ? "crouch-attack" : "attack");
    } else if (isCrouching && isMoving) {
      setState("crouch-walk");
    } else if (isCrouching) {
      setState("crouch-idle");
    } else if (isMoving) {
      setState("run");
    } else {
      setState("idle");
    }
  }, [keys, isAttacking, isCrouching, gameState]);

  // Game loop for movement and knockback recovery using requestAnimationFrame
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    let animationId: number;
    let lastTime = performance.now();
    const targetFPS = 60;
    const frameTime = 1000 / targetFPS;

    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      
      // Scale movement by delta time for consistent speed regardless of frame rate
      const timeScale = deltaTime / frameTime;
      
      const isMovingLeft = keys.has("arrowleft") || keys.has("a");
      const isMovingRight = keys.has("arrowright") || keys.has("d");
      const isMovingUp = keys.has("arrowup") || keys.has("w");
      const isMovingDown = keys.has("arrowdown") || keys.has("s");

      const baseMoveSpeed = isCrouching ? 0.5 : 1;
      const moveSpeed = baseMoveSpeed * timeScale;

      if (!isAttacking) {
        // Horizontal movement
        if (isMovingLeft) {
          setPositionX((prev) => Math.max(5, prev - moveSpeed));
          setBackgroundOffset((prev) => prev + 2 * timeScale);
        }
        if (isMovingRight) {
          setPositionX((prev) => Math.min(95, prev + moveSpeed));
          setBackgroundOffset((prev) => prev - 2 * timeScale);
        }
        
        // Vertical movement (isometric Y)
        if (isMovingUp) {
          setPositionY((prev) => Math.min(PLAY_AREA_MAX_Y, prev + moveSpeed));
        }
        if (isMovingDown) {
          setPositionY((prev) => Math.max(PLAY_AREA_MIN_Y, prev - moveSpeed));
        }
      }

      // Recover enemy knockback
      setEnemies((prev) => prev.map((enemy) => ({
        ...enemy,
        x: Math.max(0, Math.min(100, enemy.x + enemy.knockback * timeScale)),
        y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + enemy.knockbackY * timeScale)),
        knockback: Math.abs(enemy.knockback) < 0.1 ? 0 : enemy.knockback * Math.pow(1 - KNOCKBACK_RECOVERY, timeScale),
        knockbackY: Math.abs(enemy.knockbackY) < 0.1 ? 0 : enemy.knockbackY * Math.pow(1 - KNOCKBACK_RECOVERY, timeScale),
      })));

      // Recover boss knockback
      setBoss((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(5, Math.min(95, prev.x + prev.knockback * timeScale)),
          y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, prev.y + prev.knockbackY * timeScale)),
          knockback: Math.abs(prev.knockback) < 0.1 ? 0 : prev.knockback * Math.pow(1 - KNOCKBACK_RECOVERY, timeScale),
          knockbackY: Math.abs(prev.knockbackY) < 0.1 ? 0 : prev.knockbackY * Math.pow(1 - KNOCKBACK_RECOVERY, timeScale),
        };
      });

      lastTime = currentTime;
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [keys, isAttacking, isCrouching, gameState]);

  // Move enemies toward player using requestAnimationFrame
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    let animationId: number;
    let lastTime = performance.now();
    const targetFPS = 60;
    const frameTime = 1000 / targetFPS;

    const enemyLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      const timeScale = deltaTime / frameTime;

      setEnemies((prev) =>
        prev.map((enemy) => {
          if (Math.abs(enemy.knockback) > 0.5 || Math.abs(enemy.knockbackY) > 0.5) return enemy;
          
          const dirX = positionX > enemy.x ? 1 : -1;
          const dirY = positionY > enemy.y ? 1 : -1;
          const newDirection: Direction = dirX > 0 ? "right" : "left";
          
          // Move toward player in both X and Y with delta time scaling
          return { 
            ...enemy, 
            x: Math.max(0, Math.min(100, enemy.x + dirX * enemy.speed * timeScale)),
            y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + dirY * enemy.speed * 0.7 * timeScale)),
            direction: newDirection,
          };
        })
      );

      // Check collision with player
      setEnemies((prev) => {
        prev.forEach((enemy) => {
          const distanceX = Math.abs(enemy.x - positionX);
          const distanceY = Math.abs(enemy.y - positionY);
          if (distanceX < 5 && distanceY < 20) {
            setPlayerHealth((h) => {
              const newHealth = h - 1;
              if (newHealth <= 0) {
                setGameState("game-over");
                return 0;
              }
              return newHealth;
            });
          }
        });
        return prev;
      });

      lastTime = currentTime;
      animationId = requestAnimationFrame(enemyLoop);
    };

    animationId = requestAnimationFrame(enemyLoop);

    return () => cancelAnimationFrame(animationId);
  }, [positionX, positionY, gameState]);

  // Boss AI using requestAnimationFrame
  useEffect(() => {
    if (gameState !== "boss" || !boss) return;

    let animationId: number;
    let lastTime = performance.now();
    const targetFPS = 60;
    const frameTime = 1000 / targetFPS;

    const bossLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      const timeScale = deltaTime / frameTime;

      setBoss((prev) => {
        if (!prev) return null;
        
        if (Math.abs(prev.knockback) > 0.5 || Math.abs(prev.knockbackY) > 0.5) return prev;
        
        const dirX = positionX > prev.x ? 1 : -1;
        const dirY = positionY > prev.y ? 1 : -1;
        const newDirection: Direction = dirX > 0 ? "right" : "left";
        // Slow boss movement based on type with delta time scaling
        const baseSpeed = BOSS_STATS[prev.type].speed * getBossAggressionMultiplier() * timeScale;
        const newX = Math.max(5, Math.min(95, prev.x + dirX * baseSpeed));
        const newY = Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, prev.y + dirY * baseSpeed * 0.7));
        
        const distanceX = Math.abs(newX - positionX);
        const distanceY = Math.abs(newY - positionY);
        if (distanceX < 10 && distanceY < 30) {
          setPlayerHealth((h) => {
            const damage = prev.type === "fire" ? 5 : 3;
            const newHealth = h - damage * getBossAggressionMultiplier();
            if (newHealth <= 0) {
              setGameState("game-over");
              return 0;
            }
            return newHealth;
          });
        }
        
        return { ...prev, x: newX, y: newY, direction: newDirection };
      });

      lastTime = currentTime;
      animationId = requestAnimationFrame(bossLoop);
    };

    animationId = requestAnimationFrame(bossLoop);

    return () => cancelAnimationFrame(animationId);
  }, [gameState, boss, positionX, positionY, bossLoopCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate visual bottom position from Y coordinate (higher Y = further back = higher on screen)
  const getBottomPosition = (y: number) => {
    // Map Y (0-120) to bottom position (80-200 pixels)
    return 80 + y;
  };

  // Calculate z-index based on Y (lower Y = closer = higher z-index)
  const getZIndex = (y: number) => {
    return Math.floor(200 - y);
  };

  // Calculate scale based on Y for depth effect (further = smaller)
  const getDepthScale = (y: number) => {
    return 0.8 + (y / PLAY_AREA_MAX_Y) * 0.4;
  };

  return (
    <div className="min-h-screen bg-game flex flex-col overflow-hidden">
      {/* HUD */}
      <header className="p-4 flex justify-between items-center bg-game-panel/90 border-b border-game-border z-[300] relative">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-game-muted text-sm">LEVEL</span>
            <p className="text-game-accent font-pixel text-2xl">
              {currentLevel}{bossLoopCount > 0 ? `+${bossLoopCount}` : ''}
            </p>
          </div>
          <div>
            <span className="text-game-muted text-sm">SCORE</span>
            <p className="text-yellow-400 font-pixel text-2xl">{score}</p>
          </div>
        </div>
        
        <h1 className="text-xl font-bold text-game-text font-pixel tracking-wider">
          FLAME FIGHTERS
        </h1>
        
        <div className="flex items-center gap-6">
          <div>
            <span className="text-game-muted text-sm">TIME</span>
            <p className="text-game-text font-pixel text-2xl">
              {gameState === "boss" ? "BOSS!" : formatTime(timeRemaining)}
            </p>
          </div>
          <div>
            <span className="text-game-muted text-sm">HEALTH</span>
            <div className="w-32 h-4 bg-gray-700 rounded overflow-hidden">
              <div 
                className="h-full bg-red-500 transition-all duration-200"
                style={{ width: `${playerHealth}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Game Area - Isometric Beat Em Up Style */}
      <main className="flex-1 relative overflow-hidden">
        {/* Scrolling Background */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${getCurrentBackground()})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "auto 100%",
            backgroundPosition: `${backgroundOffset}px 0`,
            imageRendering: "pixelated",
          }}
        />

        {/* Menu Screen */}
        {gameState === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[250]">
            <h1 className="text-5xl font-pixel text-game-accent mb-4">FLAME FIGHTERS</h1>
            <p className="text-game-text text-xl mb-8">A Beat 'Em Up Adventure</p>
            <p className="text-game-muted mb-4">Press SPACE or ENTER to start</p>
            <div className="text-game-muted text-sm space-y-1">
              <p>WASD / Arrow Keys to move</p>
              <p>C to crouch | SPACE to attack</p>
            </div>
          </div>
        )}

        {/* Level Complete Screen */}
        {gameState === "level-complete" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[250]">
            <h1 className="text-4xl font-pixel text-green-400 mb-4">LEVEL {currentLevel} COMPLETE!</h1>
            <p className="text-game-text text-xl mb-2">Score: {score}</p>
            <p className="text-game-muted mb-8">Get ready for Level {currentLevel + 1}</p>
            <p className="text-game-accent animate-pulse">Press SPACE to continue</p>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === "game-over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[250]">
            <h1 className="text-5xl font-pixel text-red-500 mb-4">GAME OVER</h1>
            <p className="text-game-text text-xl mb-2">Final Score: {score}</p>
            <p className="text-game-muted mb-8">Level Reached: {currentLevel}</p>
            <p className="text-game-accent animate-pulse">Press SPACE to try again</p>
          </div>
        )}

        {/* Boss health bar */}
        {boss && gameState === "boss" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[240]">
            <p className="text-red-400 font-pixel text-center mb-1">
              {boss.type === "fire" ? "INFERNO LORD" : "CANDLE DEMON"} - Level {currentLevel} {bossLoopCount > 0 ? `(Loop ${bossLoopCount})` : ''}
            </p>
            <div className="w-64 h-6 bg-gray-700 rounded overflow-hidden border-2 border-red-400">
              <div 
                className="h-full bg-red-600 transition-all duration-200"
                style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Score Popups */}
        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            className="absolute text-yellow-400 font-pixel font-bold text-2xl pointer-events-none animate-score-popup"
            style={{
              left: `${popup.x}%`,
              bottom: `${getBottomPosition(popup.y) + 60}px`,
              transform: "translateX(-50%)",
              zIndex: 230,
            }}
          >
            +{popup.value}
          </div>
        ))}

        {/* Enemies - Only fire enemies spawn during levels */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute transition-none"
            style={{
              left: `${enemy.x}%`,
              bottom: `${getBottomPosition(enemy.y)}px`,
              transform: `translateX(-50%) scale(${getDepthScale(enemy.y)}) ${enemy.isHurt ? 'scale(1.1)' : ''}`,
              filter: enemy.isHurt ? 'brightness(2) saturate(0.5)' : 'none',
              transition: 'filter 0.1s',
              zIndex: getZIndex(enemy.y),
            }}
          >
            <img 
              src={fireEnemy}
              alt="Fire enemy"
              className="w-24 h-24"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        ))}

        {/* Boss - Candle for L1-3, Fire for L4+ */}
        {boss && (
          <div
            className="absolute transition-none"
            style={{
              left: `${boss.x}%`,
              bottom: `${getBottomPosition(boss.y)}px`,
              transform: `translateX(-50%) scale(${getDepthScale(boss.y)}) ${boss.isHurt ? 'scale(1.15)' : ''}`,
              filter: boss.isHurt ? 'brightness(2) saturate(0.5)' : 'none',
              transition: 'filter 0.1s',
              zIndex: getZIndex(boss.y),
            }}
          >
            {boss.type === "candle" ? (
              <img 
                src={boss.direction === "left" ? candleEnemyLeft : candleEnemyRight}
                alt="Candle Boss"
                className="w-32 h-40"
                style={{ imageRendering: "pixelated", transform: "scale(2.5)" }}
              />
            ) : (
              <img 
                src={fireBoss}
                alt="Fire Boss"
                className="w-40 h-48"
                style={{ imageRendering: "pixelated", transform: "scale(3)" }}
              />
            )}
          </div>
        )}

        {/* Defeated Boss Dissolving Animation */}
        {defeatedBoss && defeatedBoss.type === "candle" && (
          <div
            className="absolute transition-none"
            style={{
              left: `${defeatedBoss.x}%`,
              bottom: `${getBottomPosition(defeatedBoss.y)}px`,
              transform: `translateX(-50%) scale(${getDepthScale(defeatedBoss.y)})`,
              zIndex: getZIndex(defeatedBoss.y),
            }}
          >
            <img 
              src={`${candleDissolvingGif}?t=${defeatedBoss.timestamp}`}
              alt="Candle Dissolving"
              className="w-32 h-40"
              style={{ imageRendering: "pixelated", transform: "scale(2.5)" }}
            />
          </div>
        )}

        {/* Character */}
        {(gameState === "playing" || gameState === "boss") && (
          <div
            className="absolute transition-none flex items-end justify-center"
            style={{
              left: `${positionX}%`,
              bottom: `${getBottomPosition(positionY)}px`,
              transform: `translateX(-50%) scale(${getDepthScale(positionY)})`,
              height: "150px",
              zIndex: getZIndex(positionY),
            }}
          >
            <img
              src={currentAnimation}
              alt={`Knight ${state} ${direction}`}
              className="pixelated"
              style={{ 
                imageRendering: "pixelated",
                transform: `scale(${currentScale}) translateY(${currentYOffset}px)`,
                transformOrigin: "bottom center",
              }}
            />
          </div>
        )}
      </main>

      {/* Controls */}
      <footer className="p-4 bg-game-panel/90 border-t border-game-border z-[300] relative">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">WASD / ← → ↑ ↓</kbd>
              <p className="text-game-muted mt-1">Move</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">C</kbd>
              <p className="text-game-muted mt-1">Toggle Crouch</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">Space</kbd>
              <p className="text-game-muted mt-1">Attack</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">↑ / W</kbd>
              <p className="text-game-muted mt-1">Move Back</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">↓ / S</kbd>
              <p className="text-game-muted mt-1">Move Front</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
