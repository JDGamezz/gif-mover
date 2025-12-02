import { useState, useEffect, useCallback } from "react";

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

// Scale factors to normalize sprite sizes (running is larger, so scale it down)
const scaleFactors: Record<State, number> = {
  "idle": 1.6,
  "run": 1,
  "attack": 1.6,
  "crouch-walk": 1.6,
  "crouch-attack": 1.8,
};

export const KnightTest = () => {
  const [direction, setDirection] = useState<Direction>("right");
  const [state, setState] = useState<State>("idle");
  const [positionX, setPositionX] = useState(50);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [isAttacking, setIsAttacking] = useState(false);

  const currentAnimation = animations[`${state}-${direction}`];
  const currentScale = scaleFactors[state];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setKeys((prev) => new Set(prev).add(e.key.toLowerCase()));
    
    // Attack on space
    if (e.key === " " && !isAttacking) {
      setIsAttacking(true);
      setTimeout(() => setIsAttacking(false), 400);
    }
  }, [isAttacking]);

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

  // Game loop for smooth movement
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
    }, 30);

    return () => clearInterval(interval);
  }, [keys, isAttacking]);

  return (
    <div className="min-h-screen bg-game flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <h1 className="text-3xl font-bold text-game-text font-pixel tracking-wider">
          Knight Movement Test
        </h1>
        <p className="text-game-muted mt-2">
          Current State: <span className="text-game-accent font-bold">{state}</span> | 
          Direction: <span className="text-game-accent font-bold">{direction}</span>
        </p>
      </header>

      {/* Game Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Ground line */}
        <div className="absolute bottom-20 left-0 right-0 h-1 bg-game-ground" />
        
        {/* Character */}
        <div
          className="absolute bottom-20 transition-none"
          style={{
            left: `${positionX}%`,
            transform: "translateX(-50%)",
          }}
        >
          <img
            src={currentAnimation}
            alt={`Knight ${state} ${direction}`}
            className="pixelated"
            style={{ 
              imageRendering: "pixelated",
              transform: `scale(${currentScale})`,
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
          </div>
          <p className="text-game-muted text-xs mt-4 text-center">
            Also supports WASD keys
          </p>
        </div>
      </footer>
    </div>
  );
};
