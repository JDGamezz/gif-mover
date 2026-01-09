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
import gameBackground from "@/assets/game-background.png";

type Direction = "left" | "right";
type State = "idle" | "run" | "attack" | "crouch-walk" | "crouch-attack";
type GameState = "menu" | "playing" | "boss" | "level-complete" | "game-over";
type EnemyType = "fire" | "candle";

const animations: Record<`${State}-${Direction}`, string> = {
  "idle-right": idleRight,
  "idle-left": idleLeft,
  "run-right": runRight,
  "run-left": runLeft,
  "attack-right": attackRight,
  "attack-left": attackLeft,
  "crouch-walk-right": crouchWalkRight,
  "crouch-walk-left": crouchWalkLeft,
  "crouch-attack-right": crouchAttackRight,
  "crouch-attack-left": crouchAttackLeft,
};

// Preload all animations
const preloadImages = () => {
  Object.values(animations).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
  [fireEnemy, candleEnemyLeft, candleEnemyRight, candleEnemyIdle, gameBackground].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
preloadImages();

const scaleFactors: Record<State, number> = {
  "idle": 2,
  "run": 2,
  "attack": 2,
  "crouch-walk": 2,
  "crouch-attack": 2,
};

const yOffsets: Record<State, number> = {
  "idle": 30,
  "run": 0,
  "attack": 30,
  "crouch-walk": 20,
  "crouch-attack": 20,
};

interface Enemy {
  id: number;
  x: number;
  speed: number;
  type: EnemyType;
  health: number;
  maxHealth: number;
  direction: Direction;
  knockback: number; // Knockback offset
  isHurt: boolean; // Flash effect
}

interface Boss {
  id: number;
  x: number;
  health: number;
  maxHealth: number;
  direction: Direction;
  isAttacking: boolean;
  attackCooldown: number;
  knockback: number;
  isHurt: boolean;
}

interface ScorePopup {
  id: number;
  x: number;
  value: number;
}

const SPAWN_POSITIONS = [5, 95];
const ATTACK_RANGE = 13;
const LEVEL_DURATION = 70;
const KNOCKBACK_FORCE = 8;
const KNOCKBACK_RECOVERY = 0.3;
const ENEMY_STATS = {
  fire: { health: 1, points: 10, speed: 0.3 },
  candle: { health: 3, points: 30, speed: 0.2 },
};

export const KnightTest = () => {
  const [direction, setDirection] = useState<Direction>("right");
  const [state, setState] = useState<State>("idle");
  const [positionX, setPositionX] = useState(50);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [isAttacking, setIsAttacking] = useState(false);
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
  
  const enemyIdRef = useRef(0);
  const popupIdRef = useRef(0);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentAnimation = animations[`${state}-${direction}`];
  const currentScale = scaleFactors[state];
  const currentYOffset = yOffsets[state];

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
    setPositionX(50);
    setBossLoopCount(0);
    setBackgroundOffset(0);
  }, []);

  const spawnEnemy = useCallback(() => {
    if (gameState !== "playing") return;
    
    const spawnX = SPAWN_POSITIONS[Math.floor(Math.random() * SPAWN_POSITIONS.length)];
    const candleChance = 0.1 + (currentLevel - 1) * 0.1;
    const type: EnemyType = Math.random() < candleChance ? "candle" : "fire";
    const stats = ENEMY_STATS[type];
    
    const newEnemy: Enemy = {
      id: enemyIdRef.current++,
      x: spawnX,
      speed: stats.speed + Math.random() * 0.1,
      type,
      health: stats.health,
      maxHealth: stats.health,
      direction: spawnX < 50 ? "right" : "left",
      knockback: 0,
      isHurt: false,
    };
    setEnemies((prev) => [...prev, newEnemy]);
  }, [gameState, currentLevel]);

  const spawnBoss = useCallback(() => {
    const baseHealth = 50 + (currentLevel - 1) * 25;
    const health = Math.floor(baseHealth * getBossHealthMultiplier());
    
    setBoss({
      id: Date.now(),
      x: 85,
      health,
      maxHealth: health,
      direction: "left",
      isAttacking: false,
      attackCooldown: 0,
      knockback: 0,
      isHurt: false,
    });
  }, [currentLevel, bossLoopCount]);

  const attackEnemies = useCallback(() => {
    setEnemies((prev) => {
      const newEnemies: Enemy[] = [];
      let totalPoints = 0;
      const popupsToAdd: { x: number; value: number }[] = [];
      
      prev.forEach((enemy) => {
        const distance = Math.abs(enemy.x - positionX);
        const inFront = direction === "right" ? enemy.x > positionX : enemy.x < positionX;
        
        if (distance < ATTACK_RANGE && inFront) {
          const newHealth = enemy.health - 1;
          if (newHealth <= 0) {
            const points = ENEMY_STATS[enemy.type].points;
            totalPoints += points;
            popupsToAdd.push({ x: enemy.x, value: points });
          } else {
            // Apply knockback and hurt state
            const knockbackDir = direction === "right" ? 1 : -1;
            newEnemies.push({ 
              ...enemy, 
              health: newHealth,
              knockback: KNOCKBACK_FORCE * knockbackDir,
              isHurt: true,
            });
            // Clear hurt state after a short delay
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
        popupsToAdd.forEach(({ x, value }) => {
          const popupId = popupIdRef.current++;
          setScorePopups((p) => [...p, { id: popupId, x, value }]);
          setTimeout(() => {
            setScorePopups((p) => p.filter((popup) => popup.id !== popupId));
          }, 800);
        });
      }
      
      return newEnemies;
    });

    if (boss) {
      const distance = Math.abs(boss.x - positionX);
      const inFront = direction === "right" ? boss.x > positionX : boss.x < positionX;
      
      if (distance < ATTACK_RANGE && inFront) {
        setBoss((prev) => {
          if (!prev) return null;
          const newHealth = prev.health - 1;
          if (newHealth <= 0) {
            const points = 100 * currentLevel;
            setScore((s) => s + points);
            const popupId = popupIdRef.current++;
            setScorePopups((p) => [...p, { id: popupId, x: prev.x, value: points }]);
            setTimeout(() => {
              setScorePopups((p) => p.filter((popup) => popup.id !== popupId));
            }, 800);
            
            setTimeout(() => {
              if (currentLevel >= 3) {
                setBossLoopCount((c) => c + 1);
                setGameState("boss");
                setCurrentLevel(1);
              } else {
                setGameState("level-complete");
              }
            }, 500);
            
            return null;
          }
          
          // Apply knockback to boss
          const knockbackDir = direction === "right" ? 1 : -1;
          setTimeout(() => {
            setBoss(b => b ? { ...b, isHurt: false } : null);
          }, 150);
          
          return { 
            ...prev, 
            health: newHealth,
            knockback: (KNOCKBACK_FORCE * 0.5) * knockbackDir,
            isHurt: true,
          };
        });
      }
    }
  }, [positionX, direction, boss, currentLevel]);

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

    const isCrouching = keys.has("arrowdown") || keys.has("s");
    const isMovingLeft = keys.has("arrowleft") || keys.has("a");
    const isMovingRight = keys.has("arrowright") || keys.has("d");

    if (isMovingLeft) setDirection("left");
    if (isMovingRight) setDirection("right");

    if (isAttacking) {
      setState(isCrouching ? "crouch-attack" : "attack");
    } else if (isCrouching && (isMovingLeft || isMovingRight)) {
      setState("crouch-walk");
    } else if (isMovingLeft || isMovingRight) {
      setState("run");
    } else {
      setState("idle");
    }
  }, [keys, isAttacking, gameState]);

  // Game loop for movement and knockback recovery
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const interval = setInterval(() => {
      const isCrouching = keys.has("arrowdown") || keys.has("s");
      const isMovingLeft = keys.has("arrowleft") || keys.has("a");
      const isMovingRight = keys.has("arrowright") || keys.has("d");

      if (!isAttacking) {
        if (isMovingLeft) {
          setPositionX((prev) => Math.max(5, prev - (isCrouching ? 0.5 : 1)));
          // Scroll background
          setBackgroundOffset((prev) => prev + 2);
        }
        if (isMovingRight) {
          setPositionX((prev) => Math.min(95, prev + (isCrouching ? 0.5 : 1)));
          // Scroll background
          setBackgroundOffset((prev) => prev - 2);
        }
      }

      // Recover enemy knockback
      setEnemies((prev) => prev.map((enemy) => ({
        ...enemy,
        x: enemy.x + enemy.knockback,
        knockback: Math.abs(enemy.knockback) < 0.1 ? 0 : enemy.knockback * (1 - KNOCKBACK_RECOVERY),
      })));

      // Recover boss knockback
      setBoss((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(5, Math.min(95, prev.x + prev.knockback)),
          knockback: Math.abs(prev.knockback) < 0.1 ? 0 : prev.knockback * (1 - KNOCKBACK_RECOVERY),
        };
      });
    }, 30);

    return () => clearInterval(interval);
  }, [keys, isAttacking, gameState]);

  // Move enemies toward player
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "boss") return;

    const moveInterval = setInterval(() => {
      setEnemies((prev) =>
        prev.map((enemy) => {
          // Don't move if being knocked back
          if (Math.abs(enemy.knockback) > 0.5) return enemy;
          
          const dir = positionX > enemy.x ? 1 : -1;
          const newDirection: Direction = dir > 0 ? "right" : "left";
          return { 
            ...enemy, 
            x: Math.max(0, Math.min(100, enemy.x + dir * enemy.speed)),
            direction: newDirection,
          };
        })
      );

      // Check collision with player
      setEnemies((prev) => {
        prev.forEach((enemy) => {
          const distance = Math.abs(enemy.x - positionX);
          if (distance < 5) {
            setPlayerHealth((h) => {
              const newHealth = h - (enemy.type === "candle" ? 2 : 1);
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
  }, [positionX, gameState]);

  // Boss AI
  useEffect(() => {
    if (gameState !== "boss" || !boss) return;

    const bossInterval = setInterval(() => {
      setBoss((prev) => {
        if (!prev) return null;
        
        // Don't move if being knocked back
        if (Math.abs(prev.knockback) > 0.5) return prev;
        
        const dir = positionX > prev.x ? 1 : -1;
        const newDirection: Direction = dir > 0 ? "right" : "left";
        const baseSpeed = 0.15 * getBossAggressionMultiplier();
        const newX = Math.max(5, Math.min(95, prev.x + dir * baseSpeed));
        
        const distance = Math.abs(newX - positionX);
        if (distance < 8) {
          setPlayerHealth((h) => {
            const damage = 3 * getBossAggressionMultiplier();
            const newHealth = h - damage;
            if (newHealth <= 0) {
              setGameState("game-over");
              return 0;
            }
            return newHealth;
          });
        }
        
        return { ...prev, x: newX, direction: newDirection };
      });
    }, 50);

    return () => clearInterval(bossInterval);
  }, [gameState, boss, positionX, bossLoopCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-game flex flex-col overflow-hidden">
      {/* HUD */}
      <header className="p-4 flex justify-between items-center bg-game-panel/90 border-b border-game-border z-50 relative">
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
          KNIGHT'S FURY
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

      {/* Game Area with Castle Crashers style POV */}
      <main className="flex-1 relative overflow-hidden">
        {/* Scrolling Background - Sky layer */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${gameBackground})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "auto 100%",
            backgroundPosition: `${backgroundOffset * 0.5}px 0`,
            imageRendering: "pixelated",
          }}
        />
        
        {/* Scrolling Background - Main layer */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${gameBackground})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "auto 100%",
            backgroundPosition: `${backgroundOffset}px 0`,
            imageRendering: "pixelated",
          }}
        />

        {/* Floor/Ground area - Castle Crashers style with visible depth */}
        <div className="absolute bottom-0 left-0 right-0 h-32 z-10">
          {/* Grass gradient overlay for depth */}
          <div 
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, rgba(34, 139, 34, 0.3) 30%, rgba(34, 139, 34, 0.5) 100%)",
            }}
          />
        </div>

        {/* Menu Screen */}
        {gameState === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
            <h1 className="text-5xl font-pixel text-game-accent mb-4">KNIGHT'S FURY</h1>
            <p className="text-game-text text-xl mb-8">A Beat 'Em Up Adventure</p>
            <p className="text-game-muted mb-4">Press SPACE or ENTER to start</p>
            <div className="text-game-muted text-sm">
              <p>← → to move | ↓ to crouch | SPACE to attack</p>
            </div>
          </div>
        )}

        {/* Level Complete Screen */}
        {gameState === "level-complete" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
            <h1 className="text-4xl font-pixel text-green-400 mb-4">LEVEL {currentLevel} COMPLETE!</h1>
            <p className="text-game-text text-xl mb-2">Score: {score}</p>
            <p className="text-game-muted mb-8">Get ready for Level {currentLevel + 1}</p>
            <p className="text-game-accent animate-pulse">Press SPACE to continue</p>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === "game-over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
            <h1 className="text-5xl font-pixel text-red-500 mb-4">GAME OVER</h1>
            <p className="text-game-text text-xl mb-2">Final Score: {score}</p>
            <p className="text-game-muted mb-8">Level Reached: {currentLevel}</p>
            <p className="text-game-accent animate-pulse">Press SPACE to try again</p>
          </div>
        )}

        {/* Boss health bar */}
        {boss && gameState === "boss" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
            <p className="text-red-400 font-pixel text-center mb-1">
              BOSS - Level {currentLevel} {bossLoopCount > 0 ? `(Loop ${bossLoopCount})` : ''}
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
            className="absolute bottom-48 text-yellow-400 font-pixel font-bold text-2xl pointer-events-none animate-score-popup z-30"
            style={{
              left: `${popup.x}%`,
              transform: "translateX(-50%)",
            }}
          >
            +{popup.value}
          </div>
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute bottom-28 transition-none z-20"
            style={{
              left: `${enemy.x}%`,
              transform: `translateX(-50%) ${enemy.isHurt ? 'scale(1.1)' : 'scale(1)'}`,
              filter: enemy.isHurt ? 'brightness(2) saturate(0.5)' : 'none',
              transition: 'filter 0.1s, transform 0.1s',
            }}
          >
            {enemy.type === "fire" ? (
              <img 
                src={fireEnemy}
                alt="Fire enemy"
                className="w-24 h-24"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="relative">
                <img 
                  src={enemy.direction === "left" ? candleEnemyLeft : candleEnemyRight}
                  alt="Candle enemy"
                  className="w-16 h-20"
                  style={{ imageRendering: "pixelated", transform: "scale(2)" }}
                />
                {/* Health bar for candle enemies */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-700 rounded overflow-hidden">
                  <div 
                    className="h-full bg-orange-400 transition-all duration-100"
                    style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Boss */}
        {boss && (
          <div
            className="absolute bottom-28 transition-none z-20"
            style={{
              left: `${boss.x}%`,
              transform: `translateX(-50%) ${boss.isHurt ? 'scale(1.15)' : 'scale(1)'}`,
              filter: boss.isHurt ? 'brightness(2) saturate(0.5)' : 'none',
              transition: 'filter 0.1s, transform 0.1s',
            }}
          >
            <img 
              src={boss.direction === "left" ? candleEnemyLeft : candleEnemyRight}
              alt="Boss"
              className="w-24 h-32"
              style={{ imageRendering: "pixelated", transform: "scale(3)" }}
            />
          </div>
        )}

        {/* Character */}
        {(gameState === "playing" || gameState === "boss") && (
          <div
            className="absolute bottom-28 transition-none flex items-end justify-center z-20"
            style={{
              left: `${positionX}%`,
              transform: "translateX(-50%)",
              height: "150px",
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
      <footer className="p-4 bg-game-panel/90 border-t border-game-border z-50 relative">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">← →</kbd>
              <p className="text-game-muted mt-1">Move</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">↓</kbd>
              <p className="text-game-muted mt-1">Crouch</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">Space</kbd>
              <p className="text-game-muted mt-1">Attack</p>
            </div>
            <div className="bg-game-key p-2 rounded text-center">
              <kbd className="text-game-accent font-bold">↓ + ← →</kbd>
              <p className="text-game-muted mt-1">Crouch Walk</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
