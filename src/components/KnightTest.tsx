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

type Direction = "left" | "right";
type State = "idle" | "run" | "attack" | "crouch-walk" | "crouch-attack";

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

// Preload all animations to prevent loading delays
const preloadImages = () => {
  Object.values(animations).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
preloadImages();

// Scale factors to normalize sprite sizes (running is larger, so scale it down)
const scaleFactors: Record<State, number> = {
  "idle": 2,
  "run": 2,
  "attack": 2,
  "crouch-walk": 2,
  "crouch-attack": 2,
};

// Vertical offset to ground sprites (positive = down)
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
}

interface ScorePopup {
  id: number;
  x: number;
}

const SPAWN_POSITIONS = [10, 90]; // Fixed spawn positions (left and right)
const ATTACK_RANGE = 15; // Attack range in percentage (sword reach)
const GRAVITY = 1.5;
const JUMP_FORCE = 18;

export const KnightTest = () => {
  const [direction, setDirection] = useState<Direction>("right");
  const [state, setState] = useState<State>("idle");
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [isAttacking, setIsAttacking] = useState(false);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [score, setScore] = useState(0);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const enemyIdRef = useRef(0);
  const popupIdRef = useRef(0);

  const currentAnimation = animations[`${state}-${direction}`];
  const currentScale = scaleFactors[state];
  const currentYOffset = yOffsets[state];

  // Spawn enemy function
  const spawnEnemy = useCallback(() => {
    const spawnX = SPAWN_POSITIONS[Math.floor(Math.random() * SPAWN_POSITIONS.length)];
    const newEnemy: Enemy = {
      id: enemyIdRef.current++,
      x: spawnX,
      speed: 0.3 + Math.random() * 0.2,
    };
    setEnemies((prev) => [...prev, newEnemy]);
  }, []);

  // Kill enemies in range when attacking
  const killEnemiesInRange = useCallback(() => {
    setEnemies((prev) => {
      const killed: number[] = [];
      const surviving = prev.filter((enemy) => {
        const distance = Math.abs(enemy.x - positionX);
        const inFront = direction === "right" ? enemy.x > positionX : enemy.x < positionX;
        const shouldDie = distance < ATTACK_RANGE && inFront;
        if (shouldDie) killed.push(enemy.x);
        return !shouldDie;
      });
      
      // Add score and popups for killed enemies
      if (killed.length > 0) {
        setScore((s) => s + killed.length * 10);
        killed.forEach((x) => {
          const popupId = popupIdRef.current++;
          setScorePopups((p) => [...p, { id: popupId, x }]);
          setTimeout(() => {
            setScorePopups((p) => p.filter((popup) => popup.id !== popupId));
          }, 800);
        });
      }
      
      return surviving;
    });
  }, [positionX, direction]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setKeys((prev) => new Set(prev).add(e.key.toLowerCase()));
    
    // Spawn enemy on E
    if (e.key.toLowerCase() === "e") {
      spawnEnemy();
    }
    
    // Jump on W or Up arrow
    if ((e.key.toLowerCase() === "w" || e.key === "ArrowUp") && !isJumping) {
      setIsJumping(true);
      setVelocityY(JUMP_FORCE);
    }
    
    // Attack on space
    if (e.key === " " && !isAttacking) {
      setIsAttacking(true);
      killEnemiesInRange();
      setTimeout(() => setIsAttacking(false), 400);
    }
  }, [isAttacking, isJumping, spawnEnemy, killEnemiesInRange]);

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

  // Update state based on keys
  useEffect(() => {
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

    // Move character
    if (!isAttacking) {
      if (isMovingLeft) {
        setPositionX((prev) => Math.max(5, prev - (isCrouching ? 1 : 2)));
      }
      if (isMovingRight) {
        setPositionX((prev) => Math.min(95, prev + (isCrouching ? 1 : 2)));
      }
    }
  }, [keys, isAttacking]);

  // Game loop for smooth movement and gravity
  useEffect(() => {
    const interval = setInterval(() => {
      const isCrouching = keys.has("arrowdown") || keys.has("s");
      const isMovingLeft = keys.has("arrowleft") || keys.has("a");
      const isMovingRight = keys.has("arrowright") || keys.has("d");

      if (!isAttacking) {
        if (isMovingLeft) {
          setPositionX((prev) => Math.max(5, prev - (isCrouching ? 0.5 : 1)));
        }
        if (isMovingRight) {
          setPositionX((prev) => Math.min(95, prev + (isCrouching ? 0.5 : 1)));
        }
      }

      // Apply gravity
      if (isJumping) {
        setVelocityY((v) => v - GRAVITY);
        setPositionY((y) => {
          const newY = y + velocityY;
          if (newY <= 0) {
            setIsJumping(false);
            setVelocityY(0);
            return 0;
          }
          return newY;
        });
      }
    }, 30);

    return () => clearInterval(interval);
  }, [keys, isAttacking, isJumping, velocityY]);

  // Move enemies toward player
  useEffect(() => {
    const moveInterval = setInterval(() => {
      setEnemies((prev) =>
        prev.map((enemy) => {
          const direction = positionX > enemy.x ? 1 : -1;
          return { ...enemy, x: enemy.x + direction * enemy.speed };
        })
      );
    }, 30);

    return () => clearInterval(moveInterval);
  }, [positionX]);

  return (
    <div className="min-h-screen bg-game flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <h1 className="text-3xl font-bold text-game-text font-pixel tracking-wider">
          Knight Movement Test
        </h1>
        <p className="text-game-muted mt-2">
          Score: <span className="text-game-accent font-bold text-xl">{score}</span>
        </p>
      </header>

      {/* Game Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Ground line */}
        <div className="absolute bottom-20 left-0 right-0 h-1 bg-game-ground" />

        {/* Score Popups */}
        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            className="absolute bottom-32 text-yellow-400 font-pixel font-bold text-2xl pointer-events-none animate-score-popup"
            style={{
              left: `${popup.x}%`,
              transform: "translateX(-50%)",
            }}
          >
            +10
          </div>
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute bottom-[76px] transition-none"
            style={{
              left: `${enemy.x}%`,
              transform: "translateX(-50%)",
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

        {/* Character */}
        <div
          className="absolute bottom-20 transition-none flex items-end justify-center"
          style={{
            left: `${positionX}%`,
            transform: `translateX(-50%) translateY(-${positionY}px)`,
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
      </main>

      {/* Controls */}
      <footer className="p-6 bg-game-panel border-t border-game-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-game-text font-pixel text-lg mb-4 text-center">Controls</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">← →</kbd>
              <p className="text-game-muted mt-1">Run</p>
            </div>
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">↓</kbd>
              <p className="text-game-muted mt-1">Crouch</p>
            </div>
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">↓ + ← →</kbd>
              <p className="text-game-muted mt-1">Crouch Walk</p>
            </div>
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">Space</kbd>
              <p className="text-game-muted mt-1">Attack</p>
            </div>
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">W / ↑</kbd>
              <p className="text-game-muted mt-1">Jump</p>
            </div>
            <div className="bg-game-key p-3 rounded text-center">
              <kbd className="text-game-accent font-bold">E</kbd>
              <p className="text-game-muted mt-1">Spawn Enemy</p>
            </div>
          </div>
          <p className="text-game-muted text-xs mt-4 text-center">
            BHS TSA
          </p>
        </div>
      </footer>
    </div>
  );
};
