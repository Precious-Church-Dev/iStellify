'use client';

import { useEffect, useRef } from 'react';

export function stelliPathHeight(x: number) {
  return 0.88 - 0.6 * x + 0.029 * Math.sin(2 * Math.PI * x);
}

function paint(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  let seed = 793;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const colors = ['#b8e8ff', '#ffe39c', '#7bccff', '#f8f5ed'];

  for (let i = 0; i < 268; i++) {
    const x = random();
    const spreads = i < 160;
    const y = spreads ? stelliPathHeight(x) + (random() - 0.62) * 0.35 : random() * 0.96;
    const radius = random() ** 2 * 1.35 + 0.22;
    ctx.globalAlpha = 0.14 + random() * 0.68;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(x * width, y * height, radius, 0, 2 * Math.PI);
    ctx.fill();
    if (i % 19 === 0) {
      const shine = (random() * 5 + 3) * Math.min(1, width / 700);
      ctx.globalAlpha *= 0.62;
      ctx.fillRect(x * width - shine, y * height - 0.45, shine * 2, 0.9);
      ctx.fillRect(x * width - 0.45, y * height - shine, 0.9, shine * 2);
    }
  }
  ctx.globalAlpha = 1;

  function trail(offset: (x: number) => number) {
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = (stelliPathHeight(x) + offset(x)) * height;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(x * width, y);
    }
  }

  const glow = ctx.createLinearGradient(0, height, width, height * 0.2);
  glow.addColorStop(0, '#448ec222');
  glow.addColorStop(0.45, '#69c6ff38');
  glow.addColorStop(0.72, '#efbc5748');
  glow.addColorStop(1, '#f4c27170');
  ctx.beginPath();
  trail(() => 0);
  ctx.lineTo(width, (stelliPathHeight(1) + 0.13) * height);
  for (let i = 100; i >= 0; i--) {
    const x = i / 100;
    ctx.lineTo(x * width, (stelliPathHeight(x) + 0.06 + x * 0.07) * height);
  }
  ctx.closePath();
  ctx.fillStyle = glow;
  ctx.fill();

  for (let i = 0; i < 14; i++) {
    const beam = ctx.createLinearGradient(0, 0, width, 0);
    beam.addColorStop(0, i % 3 === 0 ? '#d1ad6955' : '#4a9de929');
    beam.addColorStop(0.42, i % 3 === 0 ? '#eaba77f0' : '#4daeffca');
    beam.addColorStop(0.63, '#fff0b9eb');
    beam.addColorStop(1, i % 2 === 0 ? '#ffc97cd2' : '#6bddff05');
    ctx.beginPath();
    trail((x) => ((i + 1) / 14) * (0.13 * Math.cos(x * 4.5) ** 2 - x * 0.045));
    ctx.lineWidth = i % 4 === 0 ? 1.45 : 0.68;
    ctx.strokeStyle = beam;
    ctx.stroke();
  }

  const rail = ctx.createLinearGradient(0, height, width, height * 0.18);
  rail.addColorStop(0, '#91d2f580');
  rail.addColorStop(0.36, '#95deff');
  rail.addColorStop(0.59, '#fff1bc');
  rail.addColorStop(1, '#f7c776');
  ctx.beginPath();
  trail(() => 0);
  ctx.lineWidth = width > 600 ? 2.6 : 1.85;
  ctx.strokeStyle = rail;
  ctx.shadowColor = '#ffcd72';
  ctx.shadowBlur = width > 600 ? 15 : 7;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const comets = [
    { x: 0.49, y: 0.16, fromX: 0.01, fromY: 0.86, color: '#ffd98b' },
    { x: 0.89, y: 0.19, fromX: 0.45, fromY: 0.59, color: '#b4ddff' },
  ];
  for (const { x, y, fromX, fromY, color } of comets) {
    const comet = ctx.createLinearGradient(fromX * width, fromY * height, x * width, y * height);
    comet.addColorStop(0, '#73bfff00');
    comet.addColorStop(0.66, color + '40');
    comet.addColorStop(1, color + 'ee');
    ctx.strokeStyle = comet;
    ctx.shadowColor = color;
    ctx.shadowBlur = 9;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(fromX * width, (fromY + i * 0.024) * height);
      ctx.bezierCurveTo(
        (fromX + (x - fromX) * 0.28) * width,
        (y + (fromY - y) * 0.44 + i * 0.02) * height,
        (x - (x - fromX) * 0.23) * width,
        (y + i * 0.013) * height,
        x * width,
        y * height,
      );
      ctx.lineWidth = i === 1 ? 1.8 : 0.55;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * width, y * height, width > 600 ? 2.3 : 1.4, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export default function StelliPathScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paint(ctx, width, height);
    });
    resize.observe(canvas);
    return () => resize.disconnect();
  }, []);

  return <canvas ref={ref} className="stellipath-scene" aria-hidden="true" />;
}
