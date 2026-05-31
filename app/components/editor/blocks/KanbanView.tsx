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

// ─── Design constants (Sparse/Minimal) ────────────────────────
const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  'Todo': { color: 'oklch(0.40 0 0)', icon: Circle },
  'In Progress': { color: 'oklch(0.65 0.20 250)', icon: Clock },
  'Done': { color: 'oklch(0.65 0.15 150)', icon: CircleCheck },
  'Blocked': { color: 'oklch(0.60 0.20 25)', icon: Ban },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'URG', color: 'oklch(0.60 0.20 25)' },
  high: { label: 'HI', color: 'oklch(0.65 0.15 45)' },
  medium: { label: 'MED', color: 'oklch(0.65 0.20 250)' },
  low: { label: 'LOW', color: 'oklch(0.50 0 0)' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority?.toLowerCase()] || PRIORITY_CONFIG.low;
  return (
    <span
      className="text-[10px] font-mono tracking-wider font-semibold"
      style={{ color: config.color }}
    >
      [{config.label}]
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
      className="p-2 mb-2"
      style={{ borderBottom: '1px solid oklch(0.65 0.20 250)' }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title..."
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'oklch(0.95 0 0)' }}
      />
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
      if (res.status === 200) mutate();
      else setTasks(Array.isArray(fetchRes) ? fetchRes : []);
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
    } catch (e) {}
    finally { setSavingTask(false); }
  };

  const handleUpdatePriority = async (taskId: string, priority: string) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, priority } : t)));
    if (selectedTask?.id === taskId) setSelectedTask((p: any) => ({ ...p, priority }));
    try { await tasksApi.update(taskId, { priority }); mutate(); } catch {}
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));
    if (selectedTask?.id === taskId) setSelectedTask((p: any) => ({ ...p, status }));
    try { await tasksApi.update(taskId, { status }); mutate(); } catch {}
  };

  if (error) {
    return <div className="text-[13px]" style={{ color: 'oklch(0.70 0.18 25)' }}>Failed to load tasks.</div>;
  }

  if (!fetchRes && tasks.length === 0) {
    return (
      <div className="flex gap-12 overflow-x-auto h-full styled-scrollbar pr-12 pl-6 pt-6 pb-12 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 min-w-[280px] max-w-[340px] flex flex-col p-4 opacity-40">
            <div className="pb-4 border-t border-[oklch(0.20_0_0_/_0.3)] pt-3 mb-4">
              <div className="w-1/2 h-3 ambient-skeleton-subtle" />
            </div>
            <div className="space-y-4">
              <div className="w-full h-20 ambient-skeleton rounded-xl" />
              <div className="w-full h-16 ambient-skeleton rounded-xl" />
              <div className="w-5/6 h-24 ambient-skeleton rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-12 overflow-x-auto h-full styled-scrollbar pr-12 pl-6 pt-6 pb-12">
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
              className="flex-1 min-w-[280px] max-w-[340px] flex flex-col transition-all duration-300 rounded-xl p-4"
              style={{
                background: isDragOver ? 'oklch(0.12 0 0)' : 'transparent',
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
              {/* Minimal Column Header with top rail */}
              <div className="pb-4 pt-3 flex items-center gap-3 shrink-0 border-t border-[oklch(0.20_0_0_/_0.5)]">
                <StatusIcon className="w-4 h-4 shrink-0" style={{ color: config.color }} />
                <span className="text-[13px] font-semibold tracking-wider uppercase flex-1" style={{ color: 'oklch(0.50 0 0)' }}>
                  {status} <span className="opacity-40 font-normal ml-1 normal-case text-[12px]">({columnTasks.length})</span>
                </span>
                <button
                  onClick={() => setCreatingInColumn(status)}
                  className="w-6 h-6 flex items-center justify-center transition-all duration-150 rounded-full"
                  style={{ color: 'oklch(0.40 0 0)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.95 0 0)';
                    (e.currentTarget as HTMLElement).style.background = 'oklch(0.15 0 0)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Column body */}
              <div className="flex-1 overflow-y-auto pt-2 space-y-4 no-scrollbar min-h-[150px]">
                <AnimatePresence>
                  {creatingInColumn === status && (
                    <InlineCreateInput
                      onConfirm={title => handleCreateTask(status, title)}
                      onCancel={() => setCreatingInColumn(null)}
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {columnTasks.map(task => (
                    <MotionDiv
                      layout
                      key={task.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      draggable
                      onDragStart={(e: any) => e.dataTransfer.setData('taskId', task.id)}
                      onClick={() => openTask(task)}
                      className="group p-3.5 cursor-pointer transition-all duration-150 relative rounded-xl"
                      style={{ background: 'oklch(0.13 0 0)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.16 0 0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px 0 oklch(0.15 0 0 / 0.5)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.13 0 0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      <div className="absolute left-0 top-3 bottom-3 w-[2px] opacity-0 group-hover:opacity-100 transition-all duration-150 rounded-full blur-[1px]" style={{ background: 'oklch(0.65 0.20 250)' }} />
                      <div className="flex items-start gap-2 pl-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] leading-snug mb-1.5 transition-colors duration-300 group-hover:text-[oklch(0.95_0_0)]" style={{ color: 'oklch(0.85 0 0)' }}>
                            {task.title || 'Untitled'}
                          </p>
                          {task.priority && <PriorityBadge priority={task.priority} />}
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

      <Sheet open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)}>
        <SheetContent
          side="right"
          className="w-[500px] sm:max-w-[500px] overflow-y-auto p-0 border-l border-[oklch(0.15_0_0)]"
          style={{ background: 'oklch(0.08 0 0)', color: 'oklch(0.95 0 0)' }}
        >
          {selectedTask && (
            <div className="flex flex-col h-full p-8">
              <div className="flex items-center gap-4 mb-8 text-[11px] font-mono tracking-widest uppercase">
                <select
                  value={selectedTask.status}
                  onChange={e => handleUpdateStatus(selectedTask.id, e.target.value)}
                  className="appearance-none bg-transparent outline-none cursor-pointer border-b border-transparent hover:border-[oklch(0.40_0_0)] pb-0.5"
                  style={{ color: STATUS_CONFIG[selectedTask.status]?.color || 'oklch(0.60 0 0)' }}
                >
                  {statuses.map(s => <option key={s} value={s} style={{ background: 'oklch(0.11 0 0)' }}>{s}</option>)}
                </select>
                <span style={{ color: 'oklch(0.30 0 0)' }}>/</span>
                <select
                  value={selectedTask.priority || 'medium'}
                  onChange={e => handleUpdatePriority(selectedTask.id, e.target.value)}
                  className="appearance-none bg-transparent outline-none cursor-pointer border-b border-transparent hover:border-[oklch(0.40_0_0)] pb-0.5"
                  style={{ color: PRIORITY_CONFIG[selectedTask.priority?.toLowerCase()]?.color || PRIORITY_CONFIG.medium.color }}
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key} style={{ background: 'oklch(0.11 0 0)' }}>{cfg.label}</option>
                  ))}
                </select>
                {savingTask && <span className="ml-auto opacity-50">Saving...</span>}
              </div>

              <h2 className="text-2xl font-semibold leading-tight mb-8" style={{ color: 'oklch(0.95 0 0)' }}>
                {selectedTask.title || 'Untitled'}
              </h2>

              <div className="flex-1">
                <p className="text-[11px] mb-4 text-label" style={{ color: 'oklch(0.30 0 0)' }}>Content</p>
                <ErrorBoundary>
                  <LightweightEditor initialContent={taskContent} onChange={handleTaskContentSave} />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
