'use client';

import React, { useState, useEffect, useRef } from 'react';
import { tasksApi } from '@/lib/api-client';
import { Plus, X, GripVertical, AlertCircle, Clock, CircleCheck, Ban, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import useSWR from 'swr';

const MotionDiv = motion.div as any;

const LightweightEditor = dynamic(
  () => import('@/app/components/editor/LightweightEditor'),
  { ssr: false }
);

interface KanbanViewProps {
  entityType?: string;
  statusOptions: string;
}

// ─── Design constants ────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType; dot: string }> = {
  'Todo': {
    color: 'oklch(0.52 0 0)',
    bg: 'oklch(0.18 0 0)',
    border: 'oklch(0.26 0 0)',
    icon: Circle,
    dot: 'oklch(0.42 0 0)',
  },
  'In Progress': {
    color: 'oklch(0.70 0.18 265)',
    bg: 'oklch(0.62 0.20 265 / 0.08)',
    border: 'oklch(0.62 0.20 265 / 0.22)',
    icon: Clock,
    dot: 'oklch(0.62 0.20 265)',
  },
  'Done': {
    color: 'oklch(0.65 0.18 145)',
    bg: 'oklch(0.65 0.18 145 / 0.08)',
    border: 'oklch(0.65 0.18 145 / 0.22)',
    icon: CircleCheck,
    dot: 'oklch(0.65 0.18 145)',
  },
  'Blocked': {
    color: 'oklch(0.65 0.20 25)',
    bg: 'oklch(0.60 0.22 25 / 0.08)',
    border: 'oklch(0.60 0.22 25 / 0.22)',
    icon: Ban,
    dot: 'oklch(0.60 0.22 25)',
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: {
    label: 'Urgent',
    color: 'oklch(0.70 0.20 25)',
    bg: 'oklch(0.60 0.22 25 / 0.12)',
    border: 'oklch(0.60 0.22 25 / 0.25)',
  },
  high: {
    label: 'High',
    color: 'oklch(0.72 0.16 50)',
    bg: 'oklch(0.68 0.18 50 / 0.12)',
    border: 'oklch(0.68 0.18 50 / 0.25)',
  },
  medium: {
    label: 'Medium',
    color: 'oklch(0.72 0.16 265)',
    bg: 'oklch(0.62 0.18 265 / 0.12)',
    border: 'oklch(0.62 0.18 265 / 0.25)',
  },
  low: {
    label: 'Low',
    color: 'oklch(0.48 0 0)',
    bg: 'oklch(0.22 0 0)',
    border: 'oklch(0.28 0 0)',
  },
};

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority?.toLowerCase()] || PRIORITY_CONFIG.low;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}

// ─── Inline creation input ────────────────────────────────────
function InlineCreateInput({
  onConfirm,
  onCancel,
}: {
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl p-3 mb-2"
      style={{ background: 'oklch(0.17 0 0)', border: '1px solid oklch(0.62 0.20 265 / 0.30)' }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title..."
        className="w-full bg-transparent text-[13px] outline-none mb-2"
        style={{ color: 'oklch(0.85 0 0)' }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (value.trim()) onConfirm(value.trim()); }}
          disabled={!value.trim()}
          className="text-[12px] font-semibold px-3 py-1 rounded-lg transition-all duration-150 disabled:opacity-40"
          style={{ background: 'oklch(0.62 0.20 265)', color: 'oklch(0.98 0 0)' }}
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-[12px] px-2 py-1 rounded-lg transition-colors"
          style={{ color: 'oklch(0.48 0 0)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0 0)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.48 0 0)')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </MotionDiv>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function KanbanView({ entityType = 'task', statusOptions }: KanbanViewProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskContent, setTaskContent] = useState<any[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const statuses = statusOptions.split(',').map(s => s.trim());

  const { data: fetchRes, error, mutate } = useSWR('/api/tasks', () =>
    tasksApi.query().then(r => r.data)
  );

  useEffect(() => {
    if (fetchRes) {
      setTasks(Array.isArray(fetchRes) ? fetchRes : []);
    }
  }, [fetchRes]);

  const handleCreateTask = async (status: string, title: string) => {
    setCreatingInColumn(null);
    const newTaskData = {
      title,
      status,
      priority: 'medium',
      position: tasks.filter(t => t.status === status).length * 1000,
      content: [{ type: 'paragraph', content: '' }],
    };
    const tempId = `temp-${Date.now()}`;
    setTasks(prev => [...prev, { ...newTaskData, id: tempId }]);
    try {
      const res = await tasksApi.create(newTaskData);
      if (res.status === 200) {
        mutate();
      } else {
        setTasks(Array.isArray(fetchRes) ? fetchRes : []);
      }
    } catch {
      setTasks(Array.isArray(fetchRes) ? fetchRes : []);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await tasksApi.update(taskId, { status: newStatus });
      mutate();
    } catch {
      setTasks(Array.isArray(fetchRes) ? fetchRes : []);
    }
  };

  const openTask = (task: any) => {
    setSelectedTask(task);
    setTaskContent(
      Array.isArray(task.content) && task.content.length > 0
        ? task.content
        : [{ type: 'paragraph', content: '' }]
    );
  };

  const handleTaskContentSave = async (blocks: any[]) => {
    setTaskContent(blocks);
    if (!selectedTask) return;
    setSavingTask(true);
    try {
      await tasksApi.update(selectedTask.id, { content: blocks });
      setTasks(prev => prev.map(t => (t.id === selectedTask.id ? { ...t, content: blocks } : t)));
      mutate();
    } catch (e) {
      console.error('Failed to save task content', e);
    } finally {
      setSavingTask(false);
    }
  };

  const handleUpdatePriority = async (taskId: string, priority: string) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, priority } : t)));
    if (selectedTask?.id === taskId) setSelectedTask((p: any) => ({ ...p, priority }));
    try {
      await tasksApi.update(taskId, { priority });
      mutate();
    } catch {}
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));
    if (selectedTask?.id === taskId) setSelectedTask((p: any) => ({ ...p, status }));
    try {
      await tasksApi.update(taskId, { status });
      mutate();
    } catch {}
  };

  if (error) {
    return (
      <div
        className="flex items-center gap-2 p-4 rounded-xl text-[13px]"
        style={{
          background: 'oklch(0.52 0.20 25 / 0.10)',
          border: '1px solid oklch(0.52 0.20 25 / 0.25)',
          color: 'oklch(0.70 0.18 25)',
        }}
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load tasks.
      </div>
    );
  }

  if (!fetchRes && tasks.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-[13px]" style={{ color: 'oklch(0.40 0 0)' }}>
        <div
          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
          style={{ borderColor: 'oklch(0.62 0.20 265)', borderTopColor: 'transparent' }}
        />
        Loading tasks...
      </div>
    );
  }

  return (
    <>
      {/* ─── Kanban board ─── */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-full styled-scrollbar">
        {statuses.map(status => {
          const config = STATUS_CONFIG[status] || STATUS_CONFIG['Todo'];
          const StatusIcon = config.icon;
          const columnTasks = tasks
            .filter(t => t.status === status)
            .sort((a, b) => (a.position || 0) - (b.position || 0));
          const isDragOver = dragOverColumn === status;

          return (
            <div
              key={status}
              className="flex-1 min-w-[240px] max-w-[300px] flex flex-col rounded-2xl transition-all duration-150"
              style={{
                background: isDragOver ? config.bg : 'oklch(0.155 0 0)',
                border: `1px solid ${isDragOver ? config.border : 'oklch(0.22 0 0)'}`,
              }}
              onDragOver={e => { e.preventDefault(); setDragOverColumn(status); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverColumn(null);
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) updateTaskStatus(taskId, status);
              }}
            >
              {/* Column header */}
              <div
                className="px-4 py-3 flex items-center gap-2.5 shrink-0"
                style={{ borderBottom: `1px solid oklch(0.20 0 0)` }}
              >
                {/* Left accent bar */}
                <div
                  className="w-1 h-4 rounded-full shrink-0"
                  style={{ background: config.dot }}
                />
                <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
                <span className="text-[13px] font-semibold flex-1" style={{ color: 'oklch(0.78 0 0)' }}>
                  {status}
                </span>
                {/* Count badge */}
                {columnTasks.length > 0 && (
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: 'oklch(0.20 0 0)', color: 'oklch(0.46 0 0)' }}
                  >
                    {columnTasks.length}
                  </span>
                )}
                {/* Add button */}
                <button
                  onClick={() => setCreatingInColumn(status)}
                  className="w-5 h-5 rounded flex items-center justify-center transition-all duration-150"
                  style={{ color: 'oklch(0.40 0 0)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'oklch(0.22 0 0)';
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0 0)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)';
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Column body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                {/* Inline create input */}
                <AnimatePresence>
                  {creatingInColumn === status && (
                    <InlineCreateInput
                      onConfirm={title => handleCreateTask(status, title)}
                      onCancel={() => setCreatingInColumn(null)}
                    />
                  )}
                </AnimatePresence>

                {/* Empty column state */}
                {columnTasks.length === 0 && creatingInColumn !== status && (
                  <div
                    className="flex flex-col items-center justify-center py-8 text-center rounded-xl"
                    style={{
                      border: `1px dashed oklch(0.24 0 0)`,
                      color: 'oklch(0.36 0 0)',
                    }}
                  >
                    <p className="text-[12px]">No tasks</p>
                    <button
                      onClick={() => setCreatingInColumn(status)}
                      className="text-[11px] mt-1 transition-colors"
                      style={{ color: 'oklch(0.44 0 0)' }}
                      onMouseEnter={e =>
                        ((e.currentTarget as HTMLElement).style.color = 'oklch(0.62 0.20 265)')
                      }
                      onMouseLeave={e =>
                        ((e.currentTarget as HTMLElement).style.color = 'oklch(0.44 0 0)')
                      }
                    >
                      + Add a task
                    </button>
                  </div>
                )}

                {/* Task cards */}
                <AnimatePresence>
                  {columnTasks.map(task => (
                    <MotionDiv
                      layout
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      draggable
                      onDragStart={(e: any) => e.dataTransfer.setData('taskId', task.id)}
                      onClick={() => openTask(task)}
                      className="group rounded-xl p-3 cursor-pointer transition-all duration-150"
                      style={{
                        background: 'oklch(0.13 0 0)',
                        border: '1px solid oklch(0.22 0 0)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.border = '1px solid oklch(0.28 0 0)';
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.16 0 0)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.border = '1px solid oklch(0.22 0 0)';
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.13 0 0)';
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical
                          className="w-3.5 h-3.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
                          style={{ color: 'oklch(0.36 0 0)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[13px] leading-snug mb-2"
                            style={{ color: 'oklch(0.82 0 0)' }}
                          >
                            {task.title || 'Untitled'}
                          </p>
                          {task.priority && (
                            <PriorityBadge priority={task.priority} />
                          )}
                        </div>
                      </div>
                    </MotionDiv>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Task detail sheet ─── */}
      <Sheet open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)}>
        <SheetContent
          side="right"
          className="w-[420px] sm:w-[500px] sm:max-w-[500px] overflow-y-auto p-0"
          style={{
            background: 'oklch(0.13 0 0)',
            borderLeft: '1px solid oklch(0.22 0 0)',
            color: 'oklch(0.88 0 0)',
          }}
        >
          {selectedTask && (
            <div className="flex flex-col h-full">
              <SheetHeader
                className="px-6 pt-6 pb-4"
                style={{ borderBottom: '1px solid oklch(0.20 0 0)' }}
              >
                {/* Metadata row */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {/* Status selector */}
                  <select
                    value={selectedTask.status}
                    onChange={e => handleUpdateStatus(selectedTask.id, e.target.value)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide appearance-none cursor-pointer outline-none"
                    style={{
                      background: STATUS_CONFIG[selectedTask.status]?.bg || 'oklch(0.20 0 0)',
                      color: STATUS_CONFIG[selectedTask.status]?.color || 'oklch(0.65 0 0)',
                      border: `1px solid ${STATUS_CONFIG[selectedTask.status]?.border || 'oklch(0.26 0 0)'}`,
                    }}
                  >
                    {statuses.map(s => (
                      <option key={s} value={s} style={{ background: 'oklch(0.16 0 0)', color: 'oklch(0.80 0 0)' }}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {/* Priority selector */}
                  <select
                    value={selectedTask.priority || 'medium'}
                    onChange={e => handleUpdatePriority(selectedTask.id, e.target.value)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide appearance-none cursor-pointer outline-none"
                    style={{
                      background: PRIORITY_CONFIG[selectedTask.priority?.toLowerCase()]?.bg || PRIORITY_CONFIG.medium.bg,
                      color: PRIORITY_CONFIG[selectedTask.priority?.toLowerCase()]?.color || PRIORITY_CONFIG.medium.color,
                      border: `1px solid ${PRIORITY_CONFIG[selectedTask.priority?.toLowerCase()]?.border || PRIORITY_CONFIG.medium.border}`,
                    }}
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key} style={{ background: 'oklch(0.16 0 0)', color: 'oklch(0.80 0 0)' }}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>

                  {savingTask && (
                    <span className="text-[11px] ml-auto" style={{ color: 'oklch(0.42 0 0)' }}>
                      Saving...
                    </span>
                  )}
                </div>

                <SheetTitle
                  className="text-xl font-bold leading-tight"
                  style={{ color: 'oklch(0.90 0 0)' }}
                >
                  {selectedTask.title || 'Untitled Task'}
                </SheetTitle>
              </SheetHeader>

              {/* Content editor */}
              <div className="flex-1 p-6">
                <p className="text-[11px] mb-3 text-label" style={{ color: 'oklch(0.38 0 0)' }}>
                  Notes
                </p>
                <ErrorBoundary>
                  <LightweightEditor
                    initialContent={taskContent}
                    onChange={handleTaskContentSave}
                  />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
