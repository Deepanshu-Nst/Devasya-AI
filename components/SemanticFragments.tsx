'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

const FRAGMENTS = [
  'memory', 'recall', 'synthesis', 'thread', 'context', 
  'resonance', 'archive', 'retrieval', 'inference', 'linkage', 
  'continuity', 'semantic', 'signal', 'pattern', 'reflection', 
  'cognition', 'persistence', 'sequence', 'abstraction', 'trace',
  'retrie...', 'conte...', 'synapse_', 'trace//'
];

interface FragmentProps {
  id: number;
  word: string;
  delay: number;
  duration: number;
  topPct: number;
  leftPct: number;
  fontSize: string;
  blur: string;
  isReactive: boolean;
}

function SingleFragment({ frag, mousePos, windowSize }: { frag: FragmentProps, mousePos: {x: number, y: number}, windowSize: {w: number, h: number} }) {
  // Convert percentage pos to roughly px pos for distance calculation
  const startX = (frag.leftPct / 100) * windowSize.w;
  const startY = (frag.topPct / 100) * windowSize.h;
  
  let targetOffsetX = 0;
  let targetOffsetY = 0;

  if (frag.isReactive && mousePos.x !== -1000) {
    const dist = Math.sqrt(Math.pow(mousePos.x - startX, 2) + Math.pow(mousePos.y - startY, 2));
    if (dist < 400) { // within 400px
      // Pull slightly towards cursor (max 15px)
      const pull = Math.max(0, 15 - (dist / 400) * 15);
      const angle = Math.atan2(mousePos.y - startY, mousePos.x - startX);
      targetOffsetX = Math.cos(angle) * pull;
      targetOffsetY = Math.sin(angle) * pull;
    }
  }

  // Use spring for 120ms delayed-feel perceptive reaction
  const xSpring = useSpring(targetOffsetX, { stiffness: 40, damping: 20, mass: 1.5 });
  const ySpring = useSpring(targetOffsetY, { stiffness: 40, damping: 20, mass: 1.5 });

  useEffect(() => {
    xSpring.set(targetOffsetX);
    ySpring.set(targetOffsetY);
  }, [targetOffsetX, targetOffsetY, xSpring, ySpring]);

  return (
    <motion.div
      className="absolute whitespace-nowrap font-mono uppercase"
      style={{
        top: `${frag.topPct}%`,
        left: `${frag.leftPct}%`,
        fontSize: frag.fontSize,
        filter: `blur(${frag.blur})`,
        color: 'oklch(0.65 0.20 250)', 
        letterSpacing: '0.18em',
        x: xSpring,
        y: ySpring,
      }}
      initial={{ opacity: 0, marginLeft: -20, marginTop: 10 }}
      animate={{
        opacity: [0, 0.03, 0.01, 0.05, 0], 
        marginLeft: [0, 100], 
        marginTop: [0, -30], 
      }}
      transition={{
        duration: frag.duration,
        delay: frag.delay,
        repeat: Infinity,
        ease: "linear"
      }}
    >
      {frag.word}
    </motion.div>
  );
}

export function SemanticFragments() {
  const [fragments, setFragments] = useState<FragmentProps[]>([]);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [windowSize, setWindowSize] = useState({ w: 1000, h: 1000 });

  useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const generated = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      word: FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)],
      delay: Math.random() * 20,
      duration: 30 + Math.random() * 60,
      topPct: Math.random() * 100,
      leftPct: -10 + Math.random() * 120,
      fontSize: `${0.8 + Math.random() * 2}rem`,
      blur: `${1 + Math.random() * 6}px`,
      isReactive: i < 4, // Only 4 fragments react
    }));
    setFragments(generated);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  if (fragments.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen opacity-40">
      {fragments.map((frag) => (
        <SingleFragment 
          key={frag.id} 
          frag={frag} 
          mousePos={mousePos} 
          windowSize={windowSize} 
        />
      ))}
    </div>
  );
}
