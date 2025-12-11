import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PHYSICS_WIDTH, PHYSICS_HEIGHT, HEAT_DECAY, HEAT_DIFFUSION } from '../constants';
import { generateGradientLUT } from '../utils/colorMapService';
import { Point, HeatStats, Particle } from '../types';

interface ThermalCanvasProps {
  onStatsUpdate?: (stats: HeatStats) => void;
  screenshotTrigger?: number; // Increment to trigger screenshot
  onScreenshotReady?: (dataUrl: string) => void;
}

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

export const ThermalCanvas: React.FC<ThermalCanvasProps> = ({ 
  onStatsUpdate, 
  screenshotTrigger, 
  onScreenshotReady 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const physicsCanvasRef = useRef<HTMLCanvasElement>(null); // Hidden low-res canvas for physics
  
  // State for LUT and Particles
  const lutRef = useRef<Uint8ClampedArray>(generateGradientLUT(1024));
  const heatMapRef = useRef<Float32Array>(new Float32Array(PHYSICS_WIDTH * PHYSICS_HEIGHT));
  const particlesRef = useRef<Particle[]>([]);
  
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Initialize Particles
  const updateParticles = (ctx: CanvasRenderingContext2D, centroid: Point) => {
    const particles = particlesRef.current;
    
    // Spawn
    if (centroid.x > 0 && Math.random() < 0.3) {
      particles.push({
        x: centroid.x * ctx.canvas.width,
        y: centroid.y * ctx.canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 2, // Upward tendency
        life: 1.0,
        maxLife: 1.0,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? '#ffffff' : '#ffaa00'
      });
    }

    // Update & Draw
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      p.size *= 0.95;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  };

  // The Physics Loop
  const processFrame = useCallback((results: any) => {
    if (!canvasRef.current || !physicsCanvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const pCanvas = physicsCanvasRef.current;
    const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || !pCtx) return;

    // 1. Draw Segmentation Mask to Physics Canvas (Low Res)
    pCtx.save();
    pCtx.clearRect(0, 0, PHYSICS_WIDTH, PHYSICS_HEIGHT);
    pCtx.drawImage(results.segmentationMask, 0, 0, PHYSICS_WIDTH, PHYSICS_HEIGHT);
    pCtx.restore();

    // 2. Get Mask Data (Alpha channel tells us where human is)
    const maskData = pCtx.getImageData(0, 0, PHYSICS_WIDTH, PHYSICS_HEIGHT);
    const pixels = maskData.data;
    const heatMap = heatMapRef.current;
    
    let totalX = 0;
    let totalY = 0;
    let totalHeatPixels = 0;
    let totalHeatValue = 0;

    // 3. Physics Simulation (Heat Diffusion & Decay)
    // We iterate the grid. This is a CPU simulation. 
    // Ideally done in WebGL shaders for 4K, but for 160x120 array it's blazing fast in JS.
    
    const newHeatMap = new Float32Array(PHYSICS_WIDTH * PHYSICS_HEIGHT);

    for (let y = 0; y < PHYSICS_HEIGHT; y++) {
      for (let x = 0; x < PHYSICS_WIDTH; x++) {
        const i = (y * PHYSICS_WIDTH + x);
        const pixelI = i * 4;
        
        // Input Heat: If mask alpha > 0, we add heat.
        // We flip X because selfie camera is mirrored usually, but let's stick to raw input.
        const inputHeat = pixels[pixelI] > 100 ? 1.0 : 0.0; 

        // Current value
        let val = heatMap[i];

        // Apply Influx
        if (inputHeat > 0) {
          val = Math.min(val + 0.2, 1.0); // Heat up
        } else {
          val *= HEAT_DECAY; // Cool down
        }

        // Apply Blur/Diffusion (Simple Box Blur approx)
        // Check neighbors
        let neighbors = 0;
        let sum = 0;
        
        // Simple cross kernel
        if (x > 0) { sum += heatMap[i - 1]; neighbors++; }
        if (x < PHYSICS_WIDTH - 1) { sum += heatMap[i + 1]; neighbors++; }
        if (y > 0) { sum += heatMap[i - PHYSICS_WIDTH]; neighbors++; }
        if (y < PHYSICS_HEIGHT - 1) { sum += heatMap[i + PHYSICS_WIDTH]; neighbors++; }

        if (neighbors > 0) {
          const avg = sum / neighbors;
          // Mix current value with average neighbor value
          val = (val * (1 - HEAT_DIFFUSION)) + (avg * HEAT_DIFFUSION);
        }

        newHeatMap[i] = val;

        // Stats calculation
        if (val > 0.2) {
            totalX += x;
            totalY += y;
            totalHeatPixels++;
            totalHeatValue += val;
        }
      }
    }

    // Update Reference
    heatMapRef.current = newHeatMap;

    // 4. Render to High Res Canvas
    // We construct the image data manually using the LUT
    const outputImage = ctx.createImageData(canvas.width, canvas.height);
    const outData = outputImage.data;
    const lut = lutRef.current;

    // Scaling factors
    const scaleX = PHYSICS_WIDTH / canvas.width;
    const scaleY = PHYSICS_HEIGHT / canvas.height;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Nearest neighbor mapping (or linear interpolation could be done here for smoother look)
        // Doing simple NN for performance, the fluid physics provides enough smoothness.
        const pX = Math.floor(x * scaleX);
        const pY = Math.floor(y * scaleY);
        const heatIndex = pY * PHYSICS_WIDTH + pX;
        
        // Safety check
        if (heatIndex >= 0 && heatIndex < newHeatMap.length) {
            const heatVal = newHeatMap[heatIndex];
            
            // Map 0-1 to 0-1023 (LUT size)
            const lutIdx = Math.floor(Math.max(0, Math.min(1, heatVal)) * 1023) * 4;
            
            const outIdx = (y * canvas.width + x) * 4;
            
            outData[outIdx] = lut[lutIdx];     // R
            outData[outIdx + 1] = lut[lutIdx + 1]; // G
            outData[outIdx + 2] = lut[lutIdx + 2]; // B
            outData[outIdx + 3] = 255; // Alpha
        }
      }
    }

    ctx.putImageData(outputImage, 0, 0);

    // 5. Update Stats & Particles
    const centroid = totalHeatPixels > 0 
        ? { x: (totalX / totalHeatPixels) / PHYSICS_WIDTH, y: (totalY / totalHeatPixels) / PHYSICS_HEIGHT }
        : { x: 0.5, y: 0.5 };
    
    updateParticles(ctx, centroid);

    if (onStatsUpdate) {
        onStatsUpdate({
            centroid,
            totalHeat: totalHeatValue,
            pixelCount: totalHeatPixels
        });
    }

  }, [onStatsUpdate]);

  // Handle Screenshot
  useEffect(() => {
    if (screenshotTrigger && screenshotTrigger > 0 && canvasRef.current && onScreenshotReady) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onScreenshotReady(dataUrl);
    }
  }, [screenshotTrigger, onScreenshotReady]);

  // Setup MediaPipe and Camera Loop
  useEffect(() => {
    let active = true;
    let animationFrameId: number;
    let stream: MediaStream | null = null;
    let selfieSegmentation: any = null;

    const setup = async () => {
      // Access global class
      const SelfieSegmentation = window.SelfieSegmentation;
      if (!SelfieSegmentation) {
        console.error("MediaPipe SelfieSegmentation not loaded");
        return;
      }

      selfieSegmentation = new SelfieSegmentation({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0 for general, 1 for landscape/better performance
      });

      selfieSegmentation.onResults(processFrame);

      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });

        if (videoRef.current && active) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsCameraReady(true);

            const loop = async () => {
                if (!active) return;
                
                if (videoRef.current && videoRef.current.readyState >= 2) {
                    await selfieSegmentation?.send({ image: videoRef.current });
                }
                
                if (active) {
                    animationFrameId = requestAnimationFrame(loop);
                }
            };
            
            loop();
        }
      } catch (err) {
        console.error("Camera setup failed", err);
      }
    };

    setup();

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
      }
      if (selfieSegmentation) {
          selfieSegmentation.close();
      }
    };
  }, [processFrame]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        {/* Hidden Source Video */}
        <video 
            ref={videoRef} 
            className="hidden" 
            playsInline
            muted
            autoPlay
        />
        
        {/* Physics Calculation Canvas (Hidden) */}
        <canvas 
            ref={physicsCanvasRef}
            width={PHYSICS_WIDTH}
            height={PHYSICS_HEIGHT}
            className="hidden"
        />

        {/* Display Canvas */}
        <canvas 
            ref={canvasRef}
            width={640}
            height={480}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${isCameraReady ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {!isCameraReady && (
            <div className="absolute inset-0 flex items-center justify-center text-blue-400 font-mono animate-pulse">
                INITIALIZING THERMAL SENSORS...
            </div>
        )}
    </div>
  );
};