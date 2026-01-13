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
  y: number;
  speed: number;
  type: EnemyType;
  health: number;
  maxHealth: number;
  direction: Direction;
  knockback: number;
  knockbackY: number;
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
const ATTACK_RANGE = 14;
const ATTACK_RANGE_Y = 40;
const LEVEL_DURATION = 70;
const KNOCKBACK_FORCE = 8;
const KNOCKBACK_RECOVERY = 0.3;

const ENEMY_STATS = {
  fire: { health: 1, points: 10, speed: 0.3 },
};

const BOSS_STATS = {
  candle: { health: 50, speed: 0.12 },
  fire: { health: 100, speed: 0.10 },
};

const PLAY_AREA_MIN_Y = 0;
const PLAY_AREA_MAX_Y = 87;

export const KnightTest = () => {
  const [direction, setDirection] = useState<Direction>("right");
  const [state, setState] = useState<State>("idle");
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(60);
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
  
  // Refs for smooth animation
  const keysRef = useRef<Set<string>>(new Set());
  const positionXRef = useRef(50);
  const positionYRef = useRef(60);
  const backgroundOffsetRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  const currentAnimation = animations[`${state}-${direction}`];
  const currentScale = scaleFactors[state];
  const currentYOffset = yOffsets[state];

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
    positionXRef.current = 50;
    positionYRef.current = 60;
    backgroundOffsetRef.current = 0;
    setBossLoopCount(0);
    setBackgroundOffset(0);
    setIsCrouching(false);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (gameState !== "playing") return;

    const spawnX = SPAWN_POSITIONS[Math.floor(Math.random() * SPAWN_POSITIONS.length)];
    const spawnY = Math.random() * PLAY_AREA_MAX_Y;
    const type: EnemyType = "fire";
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
    const currentPosX = positionXRef.current;
    const currentPosY = positionYRef.current;

    setEnemies((prev) => {
      const newEnemies: Enemy[] = [];
      let totalPoints = 0;
      const popupsToAdd: { x: number; y: number; value: number }[] = [];

      prev.forEach((enemy) => {
        const distanceX = Math.abs(enemy.x - currentPosX);
        const distanceY = Math.abs(enemy.y - currentPosY);
        const inFront = direction === "right" ? enemy.x > currentPosX : enemy.x < currentPosX;

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
              knockbackY: (Math.random() - 0.5) * 4,
              isHurt: true,
            });
            setTimeout(() => {
              setEnemies(e => e.map(en => en.id === enemy.id ? { ...en, isHurt: false } : en));
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

    setBoss((currentBoss) => {
      if (!currentBoss) return null;

      const distanceX = Math.abs(currentBoss.x - currentPosX);
      const distanceY = Math.abs(currentBoss.y - currentPosY);
      const inFront = direction === "right" ? currentBoss.x > currentPosX : currentBoss.x < currentPosX;

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
  }, [direction, currentLevel]);

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

    const key = e.key.toLowerCase();
    setKeys((prev) => new Set(prev).add(key));
    keysRef.current = new Set(keysRef.current).add(key);

    if (key === "c") {
      setIsCrouching((prev) => !prev);
    }

    if (e.key === " " && !isAttacking && (gameState === "playing" || gameState === "boss")) {
      setIsAttacking(true);
      attackEnemies();
      setTimeout(() => setIsAttacking(false), 400);
    }
  }, [gameState, isAttacking, startGame, attackEnemies]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    setKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    keysRef.current.delete(key);
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
      bossAudio.pause();
      bossAudio.currentTime = 0;
      mainMusic.play().catch(() => {});
    } else if (gameState === "boss") {
      mainMusic.pause();
      mainMusic.currentTime = 0;
      bossAudio.play().catch(() => {});
    } else if (gameState === "game-over") {
      mainMusic.pause();
      bossAudio.pause();
    }
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

  // Smooth game loop using requestAnimationFrame
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Normalize to 60fps (16.67ms per frame)
      const normalizedDelta = deltaTime / 16.67;

      const currentKeys = keysRef.current;
      const isMovingLeft = currentKeys.has("arrowleft") || currentKeys.has("a");
      const isMovingRight = currentKeys.has("arrowright") || currentKeys.has("d");
      const isMovingUp = currentKeys.has("arrowup") || currentKeys.has("w");
      const isMovingDown = currentKeys.has("arrowdown") || currentKeys.has("s");

      const moveSpeed = (isCrouching ? 0.5 : 1.5) * normalizedDelta;

      if (!isAttacking) {
        if (isMovingLeft) {
          positionXRef.current = Math.max(5, positionXRef.current - moveSpeed);
          backgroundOffsetRef.current += 2 * normalizedDelta;
        }
        if (isMovingRight) {
          positionXRef.current = Math.min(95, positionXRef.current + moveSpeed);
          backgroundOffsetRef.current -= 2 * normalizedDelta;
        }
        if (isMovingUp) {
          positionYRef.current = Math.min(PLAY_AREA_MAX_Y, positionYRef.current + moveSpeed);
        }
        if (isMovingDown) {
          positionYRef.current = Math.max(PLAY_AREA_MIN_Y, positionYRef.current - moveSpeed);
        }
      }

      // Update state at 60fps rate
      setPositionX(positionXRef.current);
      setPositionY(positionYRef.current);
      setBackgroundOffset(backgroundOffsetRef.current);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, isAttacking, isCrouching]);

  // Enemy and knockback updates
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const interval = setInterval(() => {
      // Recover enemy knockback
      setEnemies((prev) =>
        prev.map((enemy) => ({
          ...enemy,
          x: Math.max(0, Math.min(100, enemy.x + enemy.knockback)),
          y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + enemy.knockbackY)),
          knockback: Math.abs(enemy.knockback) < 0.1 ? 0 : enemy.knockback * (1 - KNOCKBACK_RECOVERY),
          knockbackY: Math.abs(enemy.knockbackY) < 0.1 ? 0 : enemy.knockbackY * (1 - KNOCKBACK_RECOVERY),
        }))
      );

      // Recover boss knockback
      setBoss((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(5, Math.min(95, prev.x + prev.knockback)),
          y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, prev.y + prev.knockbackY)),
          knockback: Math.abs(prev.knockback) < 0.1 ? 0 : prev.knockback * (1 - KNOCKBACK_RECOVERY),
          knockbackY: Math.abs(prev.knockbackY) < 0.1 ? 0 : prev.knockbackY * (1 - KNOCKBACK_RECOVERY),
        };
      });
    }, 30);

    return () => clearInterval(interval);
  }, [gameState]);

  // Move enemies toward player
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const moveInterval = setInterval(() => {
      const currentPosX = positionXRef.current;
      const currentPosY = positionYRef.current;

      setEnemies((prev) =>
        prev.map((enemy) => {
          if (Math.abs(enemy.knockback) > 0.5 || Math.abs(enemy.knockbackY) > 0.5) return enemy;

          const dirX = currentPosX > enemy.x ? 1 : -1;
          const dirY = currentPosY > enemy.y ? 1 : -1;
          const newDirection: Direction = dirX > 0 ? "right" : "left";

          return {
            ...enemy,
            x: Math.max(0, Math.min(100, enemy.x + dirX * enemy.speed)),
            y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + dirY * enemy.speed * 0.7)),
            direction: newDirection,
          };
        })
      );

      // Check collision with player
      setEnemies((prev) => {
        prev.forEach((enemy) => {
          const distanceX = Math.abs(enemy.x - currentPosX);
          const distanceY = Math.abs(enemy.y - currentPosY);
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
    }, 30);

    return () => clearInterval(moveInterval);
  }, [gameState]);

  // Boss AI
  useEffect(() => {
    if (gameState !== "boss" || !boss) return;

    const bossInterval = setInterval(() => {
      const currentPosX = positionXRef.current;
      const currentPosY = positionYRef.current;

      setBoss((prev) => {
        if (!prev) return null;
        if (Math.abs(prev.knockback) > 0.5 || Math.abs(prev.knockbackY) > 0.5) return prev;

        const dirX = currentPosX > prev.x ? 1 : -1;
        const dirY = currentPosY > prev.y ? 1 : -1;
        const newDirection: Direction = dirX > 0 ? "right" : "left";

        const baseSpeed = BOSS_STATS[prev.type].speed * getBossAggressionMultiplier();
        const newX = Math.max(5, Math.min(95, prev.x + dirX * baseSpeed));
        const newY = Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, prev.y + dirY * baseSpeed * 0.7));

        const distanceX = Math.abs(newX - currentPosX);
        const distanceY = Math.abs(newY - currentPosY);
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
    }, 50);

    return () => clearInterval(bossInterval);
  }, [gameState, boss, bossLoopCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getBottomPosition = (y: number) => {
    return 80 + y;
  };

  const getZIndex = (y: number) => {
    return Math.floor(200 - y);
  };

  const getDepthScale = (y: number) => {
    return 0.8 + (y / PLAY_AREA_MAX_Y) * 0.4;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-hidden p-4">
      {/* HUD */}
      <div className="w-full max-w-4xl mb-2">
        <div className="flex justify-between items-center text-white px-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-orange-400 text-xs font-bold tracking-wider">LEVEL</div>
              <div className="text-2xl font-bold text-orange-300">{currentLevel}{bossLoopCount > 0 ? `+${bossLoopCount}` : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 text-xs font-bold tracking-wider">SCORE</div>
              <div className="text-2xl font-bold text-yellow-300">{score}</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 drop-shadow-lg">
              FLAME FIGHTERS
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-red-400 text-xs font-bold tracking-wider">TIME</div>
              <div className={`text-2xl font-bold ${gameState === "boss" ? "text-red-500 animate-pulse" : "text-red-300"}`}>
                {gameState === "boss" ? "BOSS!" : formatTime(timeRemaining)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-green-400 text-xs font-bold tracking-wider">HEALTH</div>
              <div className="w-24 h-4 bg-gray-700 rounded-full overflow-hidden border border-green-500/50">
                <div
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
                  style={{ width: `${playerHealth}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div
        className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden shadow-2xl"
        style={{
          boxShadow: '0 0 40px rgba(255, 100, 0, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Scrolling Background */}
        <div
          className="absolute inset-0 transition-none"
          style={{
            backgroundImage: `url(${getCurrentBackground()})`,
            backgroundSize: 'cover',
            backgroundPosition: `${backgroundOffset}px center`,
            imageRendering: 'pixelated',
          }}
        />

        {/* Menu Screen */}
        {gameState === "menu" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 mb-4 animate-pulse">
                FLAME FIGHTERS
              </h1>
              <p className="text-orange-300 text-xl mb-8">A Beat 'Em Up Adventure</p>
              <p className="text-white text-lg animate-bounce">Press SPACE or ENTER to start</p>
              <div className="mt-8 text-gray-400 text-sm">
                <p>WASD / Arrow Keys to move</p>
                <p>C to crouch | SPACE to attack</p>
              </div>
            </div>
          </div>
        )}

        {/* Level Complete Screen */}
        {gameState === "level-complete" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-green-400 mb-4">LEVEL {currentLevel} COMPLETE!</h1>
              <p className="text-yellow-300 text-2xl mb-4">Score: {score}</p>
              <p className="text-orange-300 text-xl mb-8">Get ready for Level {currentLevel + 1}</p>
              <p className="text-white text-lg animate-bounce">Press SPACE to continue</p>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === "game-over" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-red-500 mb-4">GAME OVER</h1>
              <p className="text-yellow-300 text-2xl mb-2">Final Score: {score}</p>
              <p className="text-orange-300 text-xl mb-8">Level Reached: {currentLevel}</p>
              <p className="text-white text-lg animate-bounce">Press SPACE to try again</p>
            </div>
          </div>
        )}

        {/* Boss health bar */}
        {boss && gameState === "boss" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 w-3/4">
            <div className="text-center mb-1">
              <span className="text-red-400 font-bold text-sm tracking-wider">
                {boss.type === "fire" ? "INFERNO LORD" : "CANDLE DEMON"} - Level {currentLevel} {bossLoopCount > 0 ? `(Loop ${bossLoopCount})` : ''}
              </span>
            </div>
            <div className="w-full h-6 bg-gray-800 rounded-full overflow-hidden border-2 border-red-600">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-500 transition-all duration-300"
                style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Score Popups */}
        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            className="absolute text-yellow-300 font-bold text-xl animate-bounce z-30 pointer-events-none"
            style={{
              left: `${popup.x}%`,
              bottom: `${getBottomPosition(popup.y)}px`,
              transform: 'translateX(-50%)',
              animation: 'fadeUp 0.8s ease-out forwards',
            }}
          >
            +{popup.value}
          </div>
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className={`absolute transition-none ${enemy.isHurt ? 'brightness-200' : ''}`}
            style={{
              left: `${enemy.x}%`,
              bottom: `${getBottomPosition(enemy.y)}px`,
              transform: `translateX(-50%) scaleX(${enemy.direction === "left" ? -1 : 1}) scale(${getDepthScale(enemy.y)})`,
              zIndex: getZIndex(enemy.y),
              imageRendering: 'pixelated',
            }}
          >
            <img
              src={fireEnemy}
              alt="Fire Enemy"
              className="h-16 w-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        ))}

        {/* Boss */}
        {boss && (
          <div
            className={`absolute transition-none ${boss.isHurt ? 'brightness-200' : ''}`}
            style={{
              left: `${boss.x}%`,
              bottom: `${getBottomPosition(boss.y)}px`,
              transform: `translateX(-50%) scaleX(${boss.direction === "left" ? -1 : 1}) scale(${getDepthScale(boss.y) * 1.5})`,
              zIndex: getZIndex(boss.y),
              imageRendering: 'pixelated',
            }}
          >
            {boss.type === "candle" ? (
              <img
                src={boss.direction === "left" ? candleEnemyLeft : candleEnemyRight}
                alt="Candle Boss"
                className="h-32 w-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <img
                src={fireBoss}
                alt="Fire Boss"
                className="h-40 w-auto"
                style={{ imageRendering: 'pixelated' }}
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
              transform: `translateX(-50%) scale(${getDepthScale(defeatedBoss.y) * 1.5})`,
              zIndex: getZIndex(defeatedBoss.y),
              imageRendering: 'pixelated',
            }}
          >
            <img
              src={`${candleDissolvingGif}?t=${defeatedBoss.timestamp}`}
              alt="Candle Dissolving"
              className="h-32 w-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}

        {/* Character */}
        {(gameState === "playing" || gameState === "boss") && (
          <div
            className="absolute transition-none"
            style={{
              left: `${positionX}%`,
              bottom: `${getBottomPosition(positionY) + currentYOffset}px`,
              transform: `translateX(-50%) scale(${currentScale * getDepthScale(positionY)})`,
              zIndex: getZIndex(positionY),
              imageRendering: 'pixelated',
            }}
          >
            <img
              src={currentAnimation}
              alt="Knight"
              className="h-16 w-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 text-gray-400 text-sm">
        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">WASD / ← → ↑ ↓</kbd>
            <span>Move</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">C</kbd>
            <span>Toggle Crouch</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Space</kbd>
            <span>Attack</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">↑ / W</kbd>
            <span>Move Back</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">↓ / S</kbd>
            <span>Move Front</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
        }
      `}</style>
    </div>
  );
};
