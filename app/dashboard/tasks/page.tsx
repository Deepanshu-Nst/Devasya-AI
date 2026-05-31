'use client';

import React from 'react';
import KanbanView from '@/app/components/editor/blocks/KanbanView';
import { motion } from 'framer-motion';

const MotionDiv = motion.div as any;

export default function GlobalTasksPage() {
  return (
    <div className="flex-1 overflow-auto h-full p-4 sm:p-8 flex flex-col bg-black">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Tasks</h1>
            <p className="text-white/50 text-sm">Manage all your workspace tasks across pages</p>
          </div>
        </MotionDiv>

        <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
          {/* Note: In a production app, the status options could be configurable per workspace. 
              Here we default to standard options. */}
          <KanbanView 
            entityType="task" 
            statusOptions="Todo, In Progress, Done, Blocked" 
          />
        </div>
      </div>
    </div>
  );
}
