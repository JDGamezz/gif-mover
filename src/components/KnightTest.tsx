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
    setEnemies((prev) => {
      const newEnemies: Enemy[] = [];
      let totalPoints = 0;
      const popupsToAdd: { x: number; y: number; value: number }[] = [];

      prev.forEach((enemy) => {
        const distanceX = Math.abs(enemy.x - positionX);
        const distanceY = Math.abs(enemy.y - positionY);
        const inFront = direction === "right" ? enemy.x > positionX : enemy.x < positionX;

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

  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const interval = setInterval(() => {
      const isMovingLeft = keys.has("arrowleft") || keys.has("a");
      const isMovingRight = keys.has("arrowright") || keys.has("d");
      const isMovingUp = keys.has("arrowup") || keys.has("w");
      const isMovingDown = keys.has("arrowdown") || keys.has("s");

      const moveSpeed = isCrouching ? 0.5 : 1.5;

      if (!isAttacking) {
        if (isMovingLeft) {
          setPositionX((prev) => Math.max(5, prev - moveSpeed));
          setBackgroundOffset((prev) => prev + 2);
        }
        if (isMovingRight) {
          setPositionX((prev) => Math.min(95, prev + moveSpeed));
          setBackgroundOffset((prev) => prev - 2);
        }
        if (isMovingUp) {
          setPositionY((prev) => Math.min(PLAY_AREA_MAX_Y, prev + moveSpeed));
        }
        if (isMovingDown) {
          setPositionY((prev) => Math.max(PLAY_AREA_MIN_Y, prev - moveSpeed));
        }
      }

      setEnemies((prev) =>
        prev.map((enemy) => ({
          ...enemy,
          x: Math.max(0, Math.min(100, enemy.x + enemy.knockback)),
          y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + enemy.knockbackY)),
          knockback: Math.abs(enemy.knockback) < 0.1 ? 0 : enemy.knockback * (1 - KNOCKBACK_RECOVERY),
          knockbackY: Math.abs(enemy.knockbackY) < 0.1 ? 0 : enemy.knockbackY * (1 - KNOCKBACK_RECOVERY),
        }))
      );

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
  }, [keys, isAttacking, isCrouching, gameState]);

  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const moveInterval = setInterval(() => {
      setEnemies((prev) =>
        prev.map((enemy) => {
          if (Math.abs(enemy.knockback) > 0.5 || Math.abs(enemy.knockbackY) > 0.5) return enemy;

          const dirX = positionX > enemy.x ? 1 : -1;
          const dirY = positionY > enemy.y ? 1 : -1;
          const newDirection: Direction = dirX > 0 ? "right" : "left";

          return {
            ...enemy,
            x: Math.max(0, Math.min(100, enemy.x + dirX * enemy.speed)),
            y: Math.max(PLAY_AREA_MIN_Y, Math.min(PLAY_AREA_MAX_Y, enemy.y + dirY * enemy.speed * 0.7)),
            direction: newDirection,
          };
        })
      );

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
    }, 30);

    return () => clearInterval(moveInterval);
  }, [positionX, positionY, gameState]);

  useEffect(() => {
    if (gameState !== "boss" || !boss) return;

    const bossInterval = setInterval(() => {
      setBoss((prev) => {
        if (!prev) return null;
        if (Math.abs(prev.knockback) > 0.5 || Math.abs(prev.knockbackY) > 0.5) return prev;

        const dirX = positionX > prev.x ? 1 : -1;
        const dirY = positionY > prev.y ? 1 : -1;
        const newDirection: Direction = dirX > 0 ? "right" : "left";

        const baseSpeed = BOSS_STATS[prev.type].speed * getBossAggressionMultiplier();
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
    }, 50);

    return () => clearInterval(bossInterval);
  }, [gameState, boss, positionX, positionY, bossLoopCount]);

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-4">
      {/* HUD */}
      <div className="w-full max-w-4xl mb-2">
        <div className="flex justify-between items-center px-4 py-2 bg-black/50 rounded-lg border border-amber-500/30">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-amber-400 text-xs font-bold tracking-wider">LEVEL</div>
              <div className="text-white text-xl font-bold">{currentLevel}{bossLoopCount > 0 ? `+${bossLoopCount}` : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-amber-400 text-xs font-bold tracking-wider">SCORE</div>
              <div className="text-white text-xl font-bold">{score}</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-amber-400 text-2xl font-bold tracking-widest">FLAME FIGHTERS</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-amber-400 text-xs font-bold tracking-wider">TIME</div>
              <div className={`text-xl font-bold ${gameState === "boss" ? "text-red-500 animate-pulse" : "text-white"}`}>
                {gameState === "boss" ? "BOSS!" : formatTime(timeRemaining)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-amber-400 text-xs font-bold tracking-wider">HEALTH</div>
              <div className="w-24 h-4 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                  style={{ width: `${playerHealth}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl border-4 border-amber-600"
        style={{
          width: "800px",
          height: "500px",
        }}
      >
        {/* Scrolling Background */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-100"
          style={{
            backgroundImage: `url(${getCurrentBackground()})`,
            backgroundPosition: `${backgroundOffset}px center`,
            backgroundSize: "cover",
          }}
        />

        {/* Menu Screen */}
        {gameState === "menu" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-amber-400 mb-4 drop-shadow-lg">FLAME FIGHTERS</h1>
              <p className="text-2xl text-amber-200 mb-8">A Beat 'Em Up Adventure</p>
              <p className="text-xl text-white animate-pulse">Press SPACE or ENTER to start</p>
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
              <p className="text-2xl text-white mb-4">Score: {score}</p>
              <p className="text-xl text-amber-200 mb-8">Get ready for Level {currentLevel + 1}</p>
              <p className="text-xl text-white animate-pulse">Press SPACE to continue</p>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === "game-over" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-red-500 mb-4">GAME OVER</h1>
              <p className="text-2xl text-white mb-2">Final Score: {score}</p>
              <p className="text-xl text-amber-200 mb-8">Level Reached: {currentLevel}</p>
              <p className="text-xl text-white animate-pulse">Press SPACE to try again</p>
            </div>
          </div>
        )}

        {/* Boss health bar */}
        {boss && gameState === "boss" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 w-3/4">
            <div className="text-center mb-1">
              <span className="text-red-400 font-bold text-lg drop-shadow-lg">
                {boss.type === "fire" ? "INFERNO LORD" : "CANDLE DEMON"} - Level {currentLevel} {bossLoopCount > 0 ? `(Loop ${bossLoopCount})` : ''}
              </span>
            </div>
            <div className="w-full h-6 bg-gray-800 rounded-full overflow-hidden border-2 border-red-600">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-500 transition-all duration-200"
                style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Score Popups */}
        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            className="absolute text-yellow-300 font-bold text-2xl animate-bounce pointer-events-none"
            style={{
              left: `${popup.x}%`,
              bottom: `${getBottomPosition(popup.y)}px`,
              zIndex: 100,
              animation: "fadeUp 0.8s ease-out forwards",
            }}
          >
            +{popup.value}
          </div>
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute transition-all duration-75"
            style={{
              left: `${enemy.x}%`,
              bottom: `${getBottomPosition(enemy.y)}px`,
              transform: `translateX(-50%) scaleX(${enemy.direction === "left" ? -1 : 1}) scale(${getDepthScale(enemy.y)})`,
              zIndex: getZIndex(enemy.y),
              filter: enemy.isHurt ? "brightness(2) saturate(0)" : "none",
            }}
          >
            <img src={fireEnemy} alt="Fire Enemy" className="w-16 h-16 object-contain" />
          </div>
        ))}

        {/* Boss */}
        {boss && (
          <div
            className="absolute transition-all duration-100"
            style={{
              left: `${boss.x}%`,
              bottom: `${getBottomPosition(boss.y)}px`,
              transform: `translateX(-50%) scaleX(${boss.direction === "left" ? -1 : 1}) scale(${getDepthScale(boss.y) * 1.5})`,
              zIndex: getZIndex(boss.y),
              filter: boss.isHurt ? "brightness(2) saturate(0)" : "none",
            }}
          >
            {boss.type === "candle" ? (
              <img src={boss.direction === "left" ? candleEnemyLeft : candleEnemyRight} alt="Candle Boss" className="w-32 h-32 object-contain" />
            ) : (
              <img src={fireBoss} alt="Fire Boss" className="w-40 h-40 object-contain" />
            )}
          </div>
        )}

        {/* Defeated Boss Dissolving Animation */}
        {defeatedBoss && defeatedBoss.type === "candle" && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${defeatedBoss.x}%`,
              bottom: `${getBottomPosition(defeatedBoss.y)}px`,
              transform: `translateX(-50%) scale(${getDepthScale(defeatedBoss.y) * 1.5})`,
              zIndex: getZIndex(defeatedBoss.y) + 10,
            }}
          >
            <img src={candleDissolvingGif} alt="Dissolving" className="w-32 h-32 object-contain" />
          </div>
        )}

        {/* Character */}
        {(gameState === "playing" || gameState === "boss") && (
          <div
            className="absolute transition-all duration-75"
            style={{
              left: `${positionX}%`,
              bottom: `${getBottomPosition(positionY) + currentYOffset}px`,
              transform: `translateX(-50%) scale(${currentScale * getDepthScale(positionY)})`,
              zIndex: getZIndex(positionY),
            }}
          >
            <img src={currentAnimation} alt="Knight" className="w-16 h-16 object-contain" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 text-center">
        <div className="flex gap-6 justify-center text-gray-400 text-sm">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-white">WASD / ← → ↑ ↓</kbd>
            <span>Move</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-white">C</kbd>
            <span>Toggle Crouch</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-white">Space</kbd>
            <span>Attack</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-white">↑ / W</kbd>
            <span>Move Back</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-700 rounded text-white">↓ / S</kbd>
            <span>Move Front</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-40px); }
        }
      `}</style>
    </div>
  );
};
