import React, { useEffect, useRef } from "react";
import { cn } from "../utils/cn";

export default function LoadingSpinner({ label = "Loading...", size = 180, className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const cw = (canvas.width = 400);
    const ch = (canvas.height = 300);
    const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const dToR = (degrees) => degrees * (Math.PI / 180);

    const circle = {
      x: cw / 2 + 5,
      y: ch / 2 + 22,
      radius: 90,
      speed: 2,
      rotation: 0,
      angleStart: 270,
      angleEnd: 90,
      hue: 220,
      thickness: 18,
      blur: 25,
    };

    const particles = [];
    const particleMax = 100;

    const updateCircle = () => {
      if (circle.rotation < 360) {
        circle.rotation += circle.speed;
      } else {
        circle.rotation = 0;
      }
    };

    let gradient1;
    let gradient2;
    let flareGradient;

    const renderCircle = () => {
      ctx.save();
      ctx.translate(circle.x, circle.y);
      ctx.rotate(dToR(circle.rotation));
      ctx.beginPath();
      ctx.arc(0, 0, circle.radius, dToR(circle.angleStart), dToR(circle.angleEnd), true);
      ctx.lineWidth = circle.thickness;
      ctx.strokeStyle = gradient1;
      ctx.stroke();
      ctx.restore();
    };

    const renderCircleBorder = () => {
      ctx.save();
      ctx.translate(circle.x, circle.y);
      ctx.rotate(dToR(circle.rotation));
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        circle.radius + circle.thickness / 2,
        dToR(circle.angleStart),
        dToR(circle.angleEnd),
        true
      );
      ctx.lineWidth = 2;
      ctx.strokeStyle = gradient2;
      ctx.stroke();
      ctx.restore();
    };

    const renderCircleFlare = () => {
      ctx.save();
      ctx.translate(circle.x, circle.y);
      ctx.rotate(dToR(circle.rotation));
      ctx.beginPath();
      ctx.arc(0, 0, circle.radius, dToR(circle.angleStart), dToR(circle.angleStart + 10), true);
      ctx.strokeStyle = flareGradient;
      ctx.lineWidth = circle.thickness / 2;
      ctx.stroke();
      ctx.restore();
    };

    const renderCircleFlare2 = () => {
      ctx.save();
      ctx.translate(circle.x, circle.y);
      ctx.rotate(dToR(circle.rotation + 180));
      ctx.beginPath();
      ctx.arc(0, 0, circle.radius, dToR(circle.angleStart), dToR(circle.angleStart + 8), true);
      ctx.strokeStyle = flareGradient;
      ctx.lineWidth = circle.thickness / 3;
      ctx.stroke();
      ctx.restore();
    };

    const createParticles = () => {
      if (particles.length < particleMax) {
        particles.push({
          x:
            circle.x +
            circle.radius * Math.cos(dToR(circle.rotation - 85)) +
            (rand(0, circle.thickness * 2) - circle.thickness),
          y:
            circle.y +
            circle.radius * Math.sin(dToR(circle.rotation - 85)) +
            (rand(0, circle.thickness * 2) - circle.thickness),
          vx: (rand(0, 100) - 50) / 1000,
          vy: (rand(0, 100) - 50) / 1000,
          radius: rand(1, 6) / 2,
          alpha: rand(10, 20) / 100,
        });
      }
    };

    const updateParticles = () => {
      let i = particles.length;
      while (i--) {
        const p = particles[i];
        p.vx += (rand(0, 100) - 50) / 750;
        p.vy += (rand(0, 100) - 50) / 750;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.01;

        if (p.alpha < 0.02) {
          particles.splice(i, 1);
        }
      }
    };

    const renderParticles = () => {
      let i = particles.length;
      while (i--) {
        const p = particles[i];
        ctx.beginPath();
        ctx.fillRect(p.x, p.y, p.radius, p.radius);
        ctx.closePath();
        ctx.fillStyle = `hsla(0, 0%, 100%, ${p.alpha})`;
      }
    };

    const clear = () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, .1)";
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = "lighter";
    };

    const loop = () => {
      clear();
      updateCircle();
      renderCircle();
      renderCircleBorder();
      renderCircleFlare();
      renderCircleFlare2();
      createParticles();
      updateParticles();
      renderParticles();
    };

    ctx.shadowBlur = circle.blur;
    ctx.shadowColor = `hsla(${circle.hue}, 80%, 60%, 1)`;
    ctx.lineCap = "round";

    gradient1 = ctx.createLinearGradient(0, -circle.radius, 0, circle.radius);
    gradient1.addColorStop(0, `hsla(${circle.hue}, 60%, 50%, .25)`);
    gradient1.addColorStop(1, `hsla(${circle.hue}, 60%, 50%, 0)`);

    gradient2 = ctx.createLinearGradient(0, -circle.radius, 0, circle.radius);
    gradient2.addColorStop(0, `hsla(${circle.hue}, 100%, 50%, 0)`);
    gradient2.addColorStop(0.1, `hsla(${circle.hue}, 100%, 100%, .7)`);
    gradient2.addColorStop(1, `hsla(${circle.hue}, 100%, 50%, 0)`);

    flareGradient = ctx.createRadialGradient(0, 0, circle.radius / 2, 0, 0, circle.radius + 40);
    flareGradient.addColorStop(0, `hsla(${circle.hue}, 100%, 80%, .8)`);
    flareGradient.addColorStop(1, `hsla(${circle.hue}, 100%, 50%, 0)`);

    const intervalId = window.setInterval(loop, 16);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 text-slate-500", className)}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: (size * 3) / 4 }}
        aria-hidden="true"
      />
      <span className="text-sm font-medium" role="status" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
