'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const FRAGMENTS = [
  'memory', 'recall', 'synthesis', 'thread', 'context', 
  'resonance', 'archive', 'retrieval', 'inference', 'linkage', 
  'continuity', 'semantic', 'signal', 'pattern', 'reflection', 
  'cognition', 'persistence', 'sequence', 'abstraction', 'trace',
  'retrie...', 'conte...', 'synapse_', 'trace//'
];

interface FragmentProps {
  word: string;
  delay: number;
  duration: number;
  top: string;
  left: string;
  fontSize: string;
  blur: string;
}

export function SemanticFragments() {
  const [fragments, setFragments] = useState<FragmentProps[]>([]);

  useEffect(() => {
    // Generate static fragments only on client to avoid hydration mismatch
    const generated = Array.from({ length: 15 }).map((_, i) => ({
      word: FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)],
      delay: Math.random() * 20,
      duration: 30 + Math.random() * 60, // 30s to 90s very slow drift
      top: `${Math.random() * 100}%`,
      left: `${-10 + Math.random() * 120}%`, // start slightly off-screen or anywhere
      fontSize: `${0.8 + Math.random() * 2}rem`,
      blur: `${1 + Math.random() * 6}px`, // soft blur
    }));
    setFragments(generated);
  }, []);

  if (fragments.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen opacity-40">
      {fragments.map((frag, i) => (
        <motion.div
          key={i}
          className="absolute whitespace-nowrap font-mono tracking-widest uppercase"
          style={{
            top: frag.top,
            left: frag.left,
            fontSize: frag.fontSize,
            filter: `blur(${frag.blur})`,
            color: 'oklch(0.65 0.20 250)', // primary color but will be extremely dim via opacity
          }}
          initial={{ opacity: 0, x: -20, y: 10 }}
          animate={{
            opacity: [0, 0.03, 0.01, 0.05, 0], // Barely visible, pulsating
            x: [0, 100], // Drift horizontally
            y: [0, -30], // Slight upward drift
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
      ))}
    </div>
  );
}
