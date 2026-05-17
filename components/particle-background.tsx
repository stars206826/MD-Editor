"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    // Warm color palette
    const colors = [
      "rgba(217, 119, 6, 0.6)",   // amber-600
      "rgba(245, 158, 11, 0.5)",  // amber-500
      "rgba(251, 191, 36, 0.4)",  // amber-400
      "rgba(180, 83, 9, 0.3)",    // amber-700
      "rgba(234, 88, 12, 0.3)",   // orange-600
      "rgba(194, 65, 12, 0.2)",   // orange-700
    ];

    // Initialize particles
    const particleCount = 60;
    particlesRef.current = [];

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    window.addEventListener("mousemove", handleMouseMove);

    function animate() {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse interaction - gentle repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          const force = (120 - dist) / 120;
          p.vx += (dx / dist) * force * 0.02;
          p.vy += (dy / dist) * force * 0.02;
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const connDx = p.x - p2.x;
          const connDy = p.y - p2.y;
          const connDist = Math.sqrt(connDx * connDx + connDy * connDy);

          if (connDist < 150) {
            const opacity = (1 - connDist / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(180, 120, 40, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.7 }}
    />
  );
}
