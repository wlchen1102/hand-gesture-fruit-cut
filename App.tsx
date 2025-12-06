import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Entity, EntityType, Particle, HandPoint, Results } from './types';
import { audioService } from './services/audioService';

// --- Constants ---
const GRAVITY = 0.15; // Decreased slightly for better playability
const BLADE_MAX_POINTS = 15; // Slightly shorter trail for snappier feel
const SLICE_DISTANCE = 60; // Pixels - Increased from 40 to 60 for easier slicing
const SPAWN_RATE_INITIAL = 120; // Frames between spawns (approx 2s at 60fps)
const INITIAL_LIVES = 3;

// Fruit config
const FRUIT_TYPES = [
  { color: '#FF0000', size: 45, emoji: '🍎' }, // Apple
  { color: '#FFA500', size: 50, emoji: '🍊' }, // Orange
  { color: '#FFE135', size: 55, emoji: '🍌' }, // Banana
  { color: '#FC5A8D', size: 40, emoji: '🍓' }, // Strawberry
  { color: '#2ECC71', size: 60, emoji: '🍉' }, // Watermelon
];

const BOMB_CHANCE = 0.15; // 15% chance
const COMBO_TIMEOUT = 800; // ms

// --- Global Types for MediaPipe ---
declare global {
  interface Window {
    Hands: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

// Helper to stop all active streams to prevent "Device in use" errors during HMR/Reloads
const stopAllMediaStreams = () => {
    if (window.streamReference) {
        window.streamReference.getTracks().forEach((track: any) => track.stop());
        window.streamReference = null;
    }
};

// Hack to store stream globally for cleanup
declare global {
    interface Window {
        streamReference?: MediaStream | null;
    }
}

const App: React.FC = () => {
  // --- Refs for Mutable Game State (Performance) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(INITIAL_LIVES);
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bladePathRef = useRef<HandPoint[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const difficultyMultiplierRef = useRef(1);
  const handPosRef = useRef<{ x: number; y: number } | null>(null);
  const comboCountRef = useRef(0);
  const lastSliceTimeRef = useRef(0);

  // --- React State for UI ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(INITIAL_LIVES);
  const [uiCombo, setUiCombo] = useState(0);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState("正在加载组件...");

  // --- Initialization ---

  useEffect(() => {
    // Detect mobile for responsiveness
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // MediaPipe & Camera Setup (Manual Implementation)
  useEffect(() => {
    let hands: any = null;
    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isMounted = true;

    // Cleanup any existing streams first
    stopAllMediaStreams();

    const onResults = (results: Results) => {
        if (!isMounted) return;

        // Draw PIP (Picture in Picture) Debug View
        const pipCtx = pipCanvasRef.current?.getContext('2d');
        if (pipCtx && pipCanvasRef.current) {
          pipCtx.save();
          pipCtx.clearRect(0, 0, pipCanvasRef.current.width, pipCanvasRef.current.height);
          
          // Only draw image if we have it
          if (results.image) {
              pipCtx.drawImage(
                results.image, 0, 0, pipCanvasRef.current.width, pipCanvasRef.current.height
              );
          }
          
          if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
              if (window.drawConnectors && window.drawLandmarks) {
                  window.drawConnectors(pipCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                  window.drawLandmarks(pipCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
              }
            }
          }
          pipCtx.restore();
        }

        // Update Game Hand Position (Index Finger Tip is landmark 8)
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // Prioritize first hand detected
          const landmarks = results.multiHandLandmarks[0];
          const indexTip = landmarks[8];
          
          if (canvasRef.current) {
            // Flip X because camera is mirrored
            const x = (1 - indexTip.x) * canvasRef.current.width;
            const y = indexTip.y * canvasRef.current.height;
            handPosRef.current = { x, y };
          }
        } else {
          handPosRef.current = null;
        }
    };

    const startDetectionLoop = async () => {
        if (!isMounted) return;
        
        // Ensure video is actually playing and ready
        if (videoRef.current && videoRef.current.readyState >= 2 && hands) {
             try {
                 await hands.send({ image: videoRef.current });
                 // If we successfully processed a frame, ensure permission state is true
                 setCameraPermission(true);
             } catch (e) {
                 console.warn("Hands send error (skipping frame):", e);
             }
        }
        animationFrameId = requestAnimationFrame(startDetectionLoop);
    };

    const init = async () => {
      // 1. Wait for scripts to load
      if (!window.Hands) {
          setInitStatus("加载 AI 模型中 (CDN)...");
          setTimeout(init, 500); // Retry
          return;
      }

      // 2. Request Camera Permission Manually
      try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error("浏览器不支持 getUserMedia");
          }
          
          setInitStatus("请求摄像头权限...");
          
          // Try to get stream with ideal constraints first
          try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
          } catch (err) {
             console.warn("High quality video failed, trying fallback...", err);
             // Fallback to basic video
             stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          window.streamReference = stream; // Save global ref for cleanup
          
          if (!isMounted) return;

          // 3. Setup Video Element
          if (videoRef.current && stream) {
              videoRef.current.srcObject = stream;
              
              // Wait for video to load metadata and play
              await new Promise<void>((resolve, reject) => {
                  if (!videoRef.current) return reject(new Error("Video element missing"));
                  
                  const onPlaying = () => resolve();
                  
                  videoRef.current.onloadedmetadata = () => {
                      if (videoRef.current) {
                          videoRef.current.play()
                             .then(onPlaying)
                             .catch((e) => {
                                 // Auto-play failed?
                                 console.error("Video play failed", e);
                                 reject(e);
                             });
                      }
                  };
                  
                  // If already ready (rare race condition)
                  if (videoRef.current.readyState >= 1) {
                       videoRef.current.play().then(onPlaying).catch(reject);
                  }
              });
          }

          setInitStatus("启动手势识别引擎...");

          // 4. Initialize MediaPipe Hands
          // IMPORTANT: Use the pinned version matching index.html to ensure WASM files are found
          hands = new window.Hands({
            locateFile: (file: string) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
            }
          });

          hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          hands.onResults(onResults);
          
          // Warm up by sending one frame? No, better to just let the loop handle it.
          // Sometimes calling initialize() explicitly helps catch load errors
          await hands.initialize(); 

          // 5. Start Custom Loop
          setInitStatus("准备就绪!");
          setErrorMsg(null);
          startDetectionLoop();

      } catch (err: any) {
          console.error("Init Error:", err);
          if (isMounted) {
              let msg = err.message || "未知错误";
              if (msg.includes("Permission denied")) msg = "请允许摄像头权限";
              else if (msg.includes("NotReadableError") || msg.includes("Could not start video source")) msg = "摄像头被其他应用占用，请关闭后重试";
              else if (msg.includes("WebAssembly")) msg = "AI模型加载失败 (WASM)";
              setErrorMsg(msg);
              setInitStatus("初始化失败");
          }
      }
    };

    init();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      stopAllMediaStreams();
      if (hands) {
          try {
             hands.close();
          } catch(e) { /* ignore close errors */ }
      }
    };
  }, []);

  // --- Game Logic Functions ---

  const spawnEntity = (canvasWidth: number, canvasHeight: number) => {
    const isBomb = Math.random() < BOMB_CHANCE;
    const x = Math.random() * (canvasWidth - 100) + 50;
    const y = canvasHeight + 50; // Start below screen
    
    // Physics: Throw upwards with slight curve towards center
    const vx = (canvasWidth / 2 - x) * (Math.random() * 0.005 + 0.002); 
    const vy = -(Math.random() * 6 + 10 + (difficultyMultiplierRef.current * 1.5)); // Base speed + difficulty

    const id = Date.now() + Math.random();

    if (isBomb) {
      entitiesRef.current.push({
        id,
        type: EntityType.BOMB,
        x, y, vx, vy,
        radius: 40,
        color: '#000000',
        rotation: 0,
        rotationSpeed: 0.1,
        isSliced: false,
        markedForDeletion: false,
        emoji: '💣'
      });
    } else {
      const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      entitiesRef.current.push({
        id,
        type: EntityType.FRUIT,
        x, y, vx, vy,
        radius: type.size,
        color: type.color,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        isSliced: false,
        markedForDeletion: false,
        emoji: type.emoji
      });
    }
  };

  const createParticles = (x: number, y: number, color: string) => {
    // Optimization: Reduced count from 20 to 12 for performance
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        id: Math.random(),
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color: color,
        size: Math.random() * 5 + 4 // Slightly larger size to compensate for fewer particles
      });
    }
  };

  const handleSlice = (entity: Entity, bladeX: number, bladeY: number) => {
    entity.isSliced = true;
    entity.markedForDeletion = true;

    // Check combo
    const now = Date.now();
    if (now - lastSliceTimeRef.current < COMBO_TIMEOUT) {
      comboCountRef.current += 1;
    } else {
      comboCountRef.current = 1;
    }
    lastSliceTimeRef.current = now;
    setUiCombo(comboCountRef.current);

    if (entity.type === EntityType.BOMB) {
      audioService.playBomb();
      livesRef.current -= 1;
      setUiLives(livesRef.current);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(500);
      }
      createParticles(entity.x, entity.y, '#333');
    } else {
      audioService.playSlice();
      if (comboCountRef.current > 2 && comboCountRef.current % 3 === 0) {
        audioService.playCombo();
      }
      
      const scoreAdd = 10 * (comboCountRef.current >= 3 ? 1.5 : 1);
      scoreRef.current += Math.floor(scoreAdd);
      setUiScore(scoreRef.current);

      // Create two halves
      const halfSpeed = 5;
      entitiesRef.current.push({
        ...entity,
        id: Date.now() + Math.random(),
        isSliced: true, // Already sliced visual state
        sliceAngle: -0.5, // Left piece
        vx: entity.vx - halfSpeed,
        markedForDeletion: false, // Keep alive to fall
        rotationSpeed: -0.2
      });
      entitiesRef.current.push({
        ...entity,
        id: Date.now() + Math.random() + 1,
        isSliced: true,
        sliceAngle: 0.5, // Right piece
        vx: entity.vx + halfSpeed,
        markedForDeletion: false,
        rotationSpeed: 0.2
      });

      createParticles(entity.x, entity.y, entity.color);
    }
  };

  const gameLoop = useCallback((time: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Clear Canvas
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#87CEEB'); // Sky Blue
    gradient.addColorStop(1, '#E0F7FA'); // Light Blue
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (gameState === GameState.PLAYING) {
      // 1. Difficulty Scaling
      if (scoreRef.current > 0 && scoreRef.current % 500 === 0) {
         difficultyMultiplierRef.current = 1 + (scoreRef.current / 2000);
      }

      // 2. Spawning
      if (time - lastSpawnTimeRef.current > (SPAWN_RATE_INITIAL / difficultyMultiplierRef.current) * 16) {
        const count = Math.floor(Math.random() * 2) + 1 + Math.floor(difficultyMultiplierRef.current / 2);
        for(let i=0; i<count; i++) spawnEntity(width, height);
        lastSpawnTimeRef.current = time;
      }

      // 3. Update Hand/Blade
      if (handPosRef.current) {
        bladePathRef.current.push({ ...handPosRef.current, timestamp: time });
        if (bladePathRef.current.length > BLADE_MAX_POINTS) {
          bladePathRef.current.shift();
        }
      } else {
        // Clear trail if hand lost for too long
        if (bladePathRef.current.length > 0 && time - bladePathRef.current[bladePathRef.current.length-1].timestamp > 100) {
            bladePathRef.current = [];
        }
      }

      // 4. Update Entities & Collision
      const bladeTip = bladePathRef.current.length > 0 ? bladePathRef.current[bladePathRef.current.length - 1] : null;

      entitiesRef.current.forEach(entity => {
        // Physics
        entity.x += entity.vx;
        entity.y += entity.vy;
        entity.vy += GRAVITY;
        entity.rotation += entity.rotationSpeed;

        // Collision with blade
        if (!entity.isSliced && !entity.markedForDeletion && bladeTip) {
          const dx = entity.x - bladeTip.x;
          const dy = entity.y - bladeTip.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < SLICE_DISTANCE) {
            handleSlice(entity, bladeTip.x, bladeTip.y);
          }
        }

        // Out of bounds check
        if (entity.y > height + 100) {
            entity.markedForDeletion = true;
            // Only lose life if it was a whole fruit (not bomb, not sliced part)
            if (entity.type === EntityType.FRUIT && !entity.isSliced) {
                livesRef.current -= 1;
                setUiLives(livesRef.current);
            }
        }
      });

      // Cleanup entities
      entitiesRef.current = entitiesRef.current.filter(e => !e.markedForDeletion);

      // Check Game Over
      if (livesRef.current <= 0) {
        setGameState(GameState.GAME_OVER);
      }
    }

    // --- Rendering Entities ---
    
    // Draw Particles
    particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY * 0.5;
        p.life -= 0.02;
        
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        // Optimization: Use fillRect instead of arc for better performance
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        ctx.globalAlpha = 1.0;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Draw Entities
    entitiesRef.current.forEach(entity => {
        ctx.save();
        ctx.translate(entity.x, entity.y);
        ctx.rotate(entity.rotation);

        if (entity.type === EntityType.BOMB) {
            // Draw Bomb
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
            ctx.fill();
            // Fuse
            ctx.strokeStyle = '#EDA96D';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -entity.radius);
            ctx.quadraticCurveTo(10, -entity.radius - 10, 20, -entity.radius - 20);
            ctx.stroke();
            // Spark
            if (Math.random() > 0.5) {
                ctx.fillStyle = 'orange';
                ctx.beginPath();
                ctx.arc(20, -entity.radius - 20, 4, 0, Math.PI * 2);
                ctx.fill();
            }
             // Emoji overlay for visual clarity
             ctx.font = `${entity.radius}px Arial`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('💣', 0, 0);

        } else {
            // Draw Fruit
            if (entity.isSliced && entity.sliceAngle !== undefined) {
                // Draw half fruit (Geometric representation)
                ctx.beginPath();
                ctx.fillStyle = entity.color;
                ctx.arc(0, 0, entity.radius, 0, Math.PI, entity.sliceAngle > 0); 
                ctx.fill();
                ctx.fillStyle = '#FFF'; // Inner flesh
                ctx.beginPath();
                ctx.arc(0, 0, entity.radius * 0.8, 0, Math.PI, entity.sliceAngle > 0);
                ctx.fill();
            } else {
                // Whole fruit: DIRECT EMOJI DRAWING (No background circle)
                // Scale the emoji to occupy the size of the previous circle (approx 2.2x radius)
                ctx.font = `${entity.radius * 2.2}px Arial`; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Adjust vertical offset slightly because Emoji baselines vary
                ctx.fillText(entity.emoji || '', 0, entity.radius * 0.15);
            }
        }
        ctx.restore();
    });

    // Draw Blade Trail
    if (bladePathRef.current.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Optimization: REMOVED shadowBlur (expensive). Used manual multi-pass stroke instead.
        
        // Pass 1: Glow (Wide, Transparent)
        ctx.beginPath();
        for (let i = 0; i < bladePathRef.current.length - 1; i++) {
            const pt1 = bladePathRef.current[i];
            const pt2 = bladePathRef.current[i+1];
            
            ctx.globalAlpha = (i / bladePathRef.current.length) * 0.3; // Faint glow
            ctx.lineWidth = (i / bladePathRef.current.length) * 35;
            ctx.strokeStyle = '#00FFFF'; // Cyan Glow
            
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
        }

        // Pass 2: Core (Narrow, Solid)
        ctx.beginPath();
        for (let i = 0; i < bladePathRef.current.length - 1; i++) {
            const pt1 = bladePathRef.current[i];
            const pt2 = bladePathRef.current[i+1];
            
            const opacity = i / bladePathRef.current.length;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = opacity * 8; // Sharp core
            ctx.strokeStyle = '#FFFFFF'; // White core
            
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
    }

    // Draw Fruit Knife (Green Handle Cartoon Style)
    if (handPosRef.current) {
        const { x, y } = handPosRef.current;
        ctx.save();
        ctx.translate(x, y);

        // Scale down
        ctx.scale(0.5, 0.5); 
        
        // Rotate -45 degrees for a slashing angle
        ctx.rotate(-Math.PI / 4);

        // Shift so finger is in middle of blade
        // Blade is approx 120px long upwards. Handle is 50px downwards.
        // We want (0,0) to be around -40 (blade center).
        // So we translate drawing "down" by 50px relative to context.
        ctx.translate(0, 50); 

        // --- 1. Handle ---
        const handleW = 24;
        const handleH = 60;
        const hOffset = 10; // Start handle slightly below blade visual start

        // Main Handle Color (Green)
        ctx.fillStyle = '#43A047'; // Vivid Green
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Rounded bottom handle
        ctx.roundRect(-handleW/2, hOffset, handleW, handleH, 8);
        ctx.fill();
        ctx.stroke();

        // Stripes (Lighter/Darker Green)
        ctx.fillStyle = '#A5D6A7'; // Light Green Stripe
        ctx.fillRect(-handleW/2 + 2, hOffset + 15, handleW - 4, 6);
        ctx.fillRect(-handleW/2 + 2, hOffset + 35, handleW - 4, 6);
        
        // Pommel (Dark Green Cap at bottom)
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.arc(0, hOffset + handleH, 14, 0, Math.PI, false);
        ctx.fill();

        // --- 2. Guard/Hilt (Metal part between blade and handle) ---
        ctx.fillStyle = '#B0BEC5';
        ctx.beginPath();
        ctx.roundRect(-handleW/2 - 2, hOffset - 5, handleW + 4, 10, 2);
        ctx.fill();

        // --- 3. Blade ---
        // Cartoon style: White with simple shading
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#90A4AE';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-10, hOffset); // Bottom Left
        ctx.lineTo(-10, -110); // Top Left (Straight back)
        // Curve to tip
        ctx.quadraticCurveTo(-10, -130, 0, -130); // Tip
        // Curve down cutting edge
        ctx.bezierCurveTo(20, -120, 25, -60, 10, hOffset); // Cutting edge
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Blade Shine/Reflection
        ctx.fillStyle = '#E3F2FD';
        ctx.beginPath();
        ctx.moveTo(-5, -110);
        ctx.lineTo(-5, hOffset - 5);
        ctx.lineTo(0, hOffset - 5);
        ctx.lineTo(0, -115);
        ctx.fill();

        ctx.restore();
    }

    requestRef.current = requestAnimationFrame(gameLoop);
    // Removed uiScore from dependency array to avoid closure re-creation on score update
  }, [gameState]);

  // Handle RAF
  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Handlers ---
  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = INITIAL_LIVES;
    entitiesRef.current = [];
    particlesRef.current = [];
    bladePathRef.current = [];
    difficultyMultiplierRef.current = 1;
    comboCountRef.current = 0;
    
    setUiScore(0);
    setUiLives(INITIAL_LIVES);
    setUiCombo(0);
    setGameState(GameState.PLAYING);
  };

  const togglePause = () => {
    if (gameState === GameState.PLAYING) setGameState(GameState.PAUSED);
    else if (gameState === GameState.PAUSED) setGameState(GameState.PLAYING);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans select-none">
      {/* Background/Game Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block w-full h-full touch-none" />

      {/* 
        CRITICAL: Video element MUST have actual dimensions for hands.send() to work properly.
        We use opacity-0 to hide it visually but keep it in the layout (or absolute) with size.
      */}
      <video 
        ref={videoRef} 
        className="absolute top-0 left-0 w-[640px] h-[480px] opacity-0 pointer-events-none -z-10" 
        playsInline 
        muted 
        autoPlay
      />

      {/* HUD - Top */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between p-4 pointer-events-none">
        <div className="flex flex-col items-start">
            <div className="text-4xl font-bold text-white neon-text drop-shadow-md">
                {uiScore}
            </div>
            {uiCombo > 1 && (
                <div className="text-2xl font-bold text-yellow-300 animate-pulse drop-shadow-md">
                    {uiCombo} 连击!
                </div>
            )}
        </div>
        
        <div className="flex gap-2">
            {Array.from({ length: Math.max(0, uiLives) }).map((_, i) => (
                <span key={i} className="text-3xl filter drop-shadow-lg">❤️</span>
            ))}
        </div>
      </div>

      {/* PIP View - Bottom Left */}
      <div className={`absolute bottom-4 left-4 z-20 overflow-hidden border-2 rounded-lg shadow-lg bg-black/50 w-[160px] h-[120px] md:w-[320px] md:h-[240px] transition-colors ${errorMsg ? 'border-red-500' : 'border-green-400'}`}>
        <canvas ref={pipCanvasRef} width={320} height={240} className="w-full h-full transform -scale-x-100" />
        <div className={`absolute bottom-0 w-full text-[10px] text-center text-white ${errorMsg ? 'bg-red-600/80' : 'bg-black/60'} p-1`}>
           {errorMsg ? (
               <span className="flex items-center justify-center gap-1">❌ {errorMsg}</span>
           ) : (
               cameraPermission ? '摄像头已连接' : (initStatus || '正在请求摄像头...')
           )}
        </div>
      </div>

      {/* Main Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <h1 className="mb-6 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 neon-text animate-bounce">
            手势切水果
          </h1>
          <p className="mb-8 text-xl text-white">请允许摄像头权限，挥动食指切开水果！</p>
          
          <div className="p-6 mb-8 text-center text-gray-200 bg-white/10 rounded-xl">
            <h3 className="mb-2 font-bold text-yellow-300">玩法教程</h3>
            <ul className="space-y-2 text-left text-sm">
                <li>👉 <span className="font-bold">右手食指</span> 是你的刀刃</li>
                <li>🍎 切开水果得分，连击分数更高</li>
                <li>💣 不要切炸弹，否则扣除生命</li>
                <li>💔 水果落地也会扣除生命</li>
            </ul>
          </div>

          <div className="flex flex-col items-center gap-2">
             <button 
                onClick={startGame}
                disabled={!cameraPermission}
                className={`px-12 py-4 text-2xl font-bold text-white transition-transform transform rounded-full shadow-[0_0_20px_rgba(34,197,94,0.6)] ${cameraPermission ? 'bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95' : 'bg-gray-500 cursor-not-allowed'}`}
              >
                {cameraPermission ? '开始游戏' : (errorMsg ? '初始化失败' : (initStatus || '等待组件加载...'))}
              </button>
              
              {/* Error Message Display below button */}
              {errorMsg && (
                  <div className="max-w-md px-4 py-2 text-sm text-red-200 bg-red-900/50 rounded-lg border border-red-500/50">
                      错误原因: {errorMsg}
                      <br/>
                      <span className="text-xs text-gray-300 opacity-75">请尝试刷新页面或检查摄像头权限</span>
                  </div>
              )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <h2 className="mb-4 text-5xl font-bold text-red-500 neon-text">游戏结束</h2>
          <div className="mb-8 text-3xl text-white">
            最终得分: <span className="font-bold text-yellow-400">{uiScore}</span>
          </div>
          <button 
            onClick={startGame}
            className="px-8 py-3 text-xl font-bold text-white bg-blue-500 rounded-full hover:bg-blue-600 hover:scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          >
            再玩一次
          </button>
        </div>
      )}

      {/* Pause Overlay */}
      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40">
           <h2 className="text-4xl font-bold text-white neon-text animate-pulse">暂停中</h2>
           <p className="mt-4 text-lg text-white">点击“继续”或挥手</p>
           <button 
            onClick={togglePause}
            className="mt-6 px-8 py-2 text-lg font-bold text-white bg-orange-500 rounded-full hover:bg-orange-600"
          >
            继续游戏
          </button>
        </div>
      )}

      {/* Control Bar - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-4">
        {gameState === GameState.PLAYING && (
            <button 
                onClick={togglePause} 
                className="p-3 text-white bg-gray-800/80 rounded-full hover:bg-gray-700 backdrop-blur"
            >
                ⏸ 暂停
            </button>
        )}
        <button 
            onClick={toggleFullScreen}
            className="p-3 text-white bg-gray-800/80 rounded-full hover:bg-gray-700 backdrop-blur"
        >
            ⛶ 全屏
        </button>
      </div>
    </div>
  );
};

export default App;