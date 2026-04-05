import React, { useMemo } from "react";
import { motion } from "framer-motion";
import "./FloatingEmojiBg.css";

const EMOJIS = [
  "👗","👕","👖","🧥","👟",
  "👜","👚","🩳","🧢","👠",
  "🩰","🥾","🧣","🧤","🎒",
  "🕶️","👒","🎩","👔","🦺",
];

const COUNT   = 18;
const MIN_GAP = 11;
const SAFE    = { x1: 22, y1: 20, x2: 78, y2: 80 };

function buildPositions() {
  const pool = [...EMOJIS].sort(() => Math.random() - 0.5);
  const placed = [];

  for (let i = 0; i < COUNT; i++) {
    let pos = null;
    for (let attempt = 0; attempt < 150; attempt++) {
      const x = 3 + Math.random() * 94;
      const y = 3 + Math.random() * 94;
      if (x > SAFE.x1 && x < SAFE.x2 && y > SAFE.y1 && y < SAFE.y2) continue;
      const clear = placed.every(({ x: px, y: py }) => {
        const dx = x - px, dy = y - py;
        return Math.sqrt(dx * dx + dy * dy) >= MIN_GAP;
      });
      if (clear) { pos = { x, y }; break; }
    }
    if (!pos) continue;

    placed.push({
      ...pos,
      emoji:   pool[i % pool.length],
      size:    18 + Math.random() * 24,
      opacity: 0.14 + Math.random() * 0.1,
      blur:    1 + Math.random() * 2,
      dur:     4 + Math.random() * 4,
      delay:   Math.random() * 3,
      yAmp:    12 + Math.random() * 18,
      xAmp:    (Math.random() - 0.5) * 16,
      rot:     (Math.random() - 0.5) * 20,
    });
  }
  return placed;
}

const FloatingEmojiBg = () => {
  const emojis = useMemo(() => buildPositions(), []);

  return (
    <div className="feb-layer" aria-hidden>
      {emojis.map(({ emoji, x, y, size, opacity, blur, dur, delay, yAmp, xAmp, rot }, i) => (
        <motion.span
          key={i}
          className="feb-emoji"
          style={{
            left:     `${x}%`,
            top:      `${y}%`,
            fontSize: `${size}px`,
            opacity,
            filter:   `blur(${blur}px)`,
          }}
          animate={{ y: [0, -yAmp, 0], x: [0, xAmp, 0], rotate: [0, rot, 0] }}
          transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
};

export default FloatingEmojiBg;
