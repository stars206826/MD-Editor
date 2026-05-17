"use client";

import { useEffect, useRef, useState } from "react";

interface TextParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  delay: number;
  arrived: boolean;
}

interface ParticleTextProps {
  text?: string;
  className?: string;
}

export function ParticleText({
  text = "随时打开，随时写",
  className = "",
}: ParticleTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<TextParticle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const startTimeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 600, height: 80 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Determine canvas size based on container
    const container = canvas.parentElement;
    const containerWidth = container ? container.clientWidth : 600;
    const canvasWidth = Math.min(containerWidth, 700);
    const canvasHeight = 90;

    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    setDimensions({ width: canvasWidth, height: canvasHeight });

    // Render text offscreen to sample pixel positions
    const offscreen = document.createElement("canvas");
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    // Calculate font size based on canvas width
    const fontSize = Math.min(Math.floor(canvasWidth / text.length * 1.1), 52);
    offCtx.fillStyle = "#000";
    offCtx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif`;
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Sample pixel positions from the rendered text
    const imageData = offCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const pixels = imageData.data;
    const positions: { x: number; y: number }[] = [];

    // Sample points with spacing (smaller = denser, sharper text)
    const gap = 2;
    for (let y = 0; y < canvasHeight; y += gap) {
      for (let x = 0; x < canvasWidth; x += gap) {
        const idx = (y * canvasWidth + x) * 4;
        const alpha = pixels[idx + 3];
        if (alpha > 128) {
          positions.push({ x, y });
        }
      }
    }

    // Unified dark color for readability
    const colors = [
      "#292524", // stone-800
      "#1c1917", // stone-900
      "#44403c", // stone-700
    ];

    // Create particles
    particlesRef.current = positions.map((pos, i) => {
      // Start from random positions around the canvas
      const startAngle = Math.random() * Math.PI * 2;
      const startDist = Math.random() * 300 + 150;
      const originX = canvasWidth / 2 + Math.cos(startAngle) * startDist;
      const originY = canvasHeight / 2 + Math.sin(startAngle) * startDist;

      return {
        x: originX,
        y: originY,
        targetX: pos.x,
        targetY: pos.y,
        originX,
        originY,
        vx: 0,
        vy: 0,
        radius: 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 1200, // staggered start
        arrived: false,
      };
    });

    startTimeRef.current = performance.now();

    // Mouse tracking
    function handleMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    function animate() {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const elapsed = performance.now() - startTimeRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wait for staggered delay
        const particleElapsed = elapsed - p.delay;
        if (particleElapsed < 0) {
          // Still waiting - draw at current position with low opacity
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        // Easing factor for convergence (ease out cubic)
        const duration = 2000; // 2 seconds to arrive
        const t = Math.min(particleElapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        // Mouse interaction - gentle repulsion when formed
        let mouseForceX = 0;
        let mouseForceY = 0;
        if (t >= 0.8) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 50 && dist > 0) {
            const force = (50 - dist) / 50;
            mouseForceX = (dx / dist) * force * 3;
            mouseForceY = (dy / dist) * force * 3;
          }
        }

        // Calculate target with mouse offset
        const targetX = p.targetX + mouseForceX;
        const targetY = p.targetY + mouseForceY;

        if (t < 1) {
          // Animate toward target
          p.x = p.originX + (targetX - p.originX) * ease;
          p.y = p.originY + (targetY - p.originY) * ease;
        } else {
          // Already arrived - spring back to target with very subtle wobble
          const wobbleX = Math.sin(elapsed * 0.0008 + i * 0.5) * 0.15;
          const wobbleY = Math.cos(elapsed * 0.001 + i * 0.3) * 0.15;

          const springForce = 0.08;
          const damping = 0.85;

          const accelX = (targetX + wobbleX - p.x) * springForce;
          const accelY = (targetY + wobbleY - p.y) * springForce;

          p.vx = (p.vx + accelX) * damping;
          p.vy = (p.vy + accelY) * damping;

          p.x += p.vx;
          p.y += p.vy;

          if (!p.arrived) p.arrived = true;
        }

        // Draw particle
        const alpha = Math.min(t * 1.5, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    // Handle resize
    function handleResize() {
      // Re-initialize on resize
      cancelAnimationFrame(animationRef.current);
      // Trigger re-mount by updating state
      setDimensions((prev) => ({ ...prev }));
    }

    window.addEventListener("resize", handleResize);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [text, dimensions.width]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="pointer-events-auto cursor-default"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
      />
    </div>
  );
}
