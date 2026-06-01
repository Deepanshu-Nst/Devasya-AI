'use client';

import React from 'react';
import KanbanView from '@/app/components/editor/blocks/KanbanView';
import { motion } from 'framer-motion';

const MotionDiv = motion.div as any;

export default function GlobalTasksPage() {
  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'oklch(0.115 0 0)' }}
    >
      <div className="cinematic-grain" />
      {/* Page header */}
      <div
        className="shrink-0 px-8 py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid oklch(0.20 0 0)' }}
      >
        <MotionDiv
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h1
            className="text-[18px] font-semibold tracking-tight"
            style={{ color: 'oklch(0.88 0 0)' }}
          >
            Tasks
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'oklch(0.44 0 0)' }}>
            Drag cards between columns to update status
          </p>
        </MotionDiv>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-6">
        <KanbanView
          entityType="task"
          statusOptions="Todo, Processing, Integrated, Blocked"
        />
      </div>
    </div>
  );
}
