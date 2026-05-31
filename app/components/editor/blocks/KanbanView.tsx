'use client';

import React, { useState, useEffect } from 'react';
import { tasksApi } from '@/lib/api-client';
import { Plus, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import useSWR from 'swr';


// Use the non-recursive LightweightEditor
const LightweightEditor = dynamic(() => import('@/app/components/editor/LightweightEditor'), { ssr: false });

interface KanbanViewProps {
  entityType?: string;
  statusOptions: string;
}

export default function KanbanView({ entityType = "task", statusOptions }: KanbanViewProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskContent, setTaskContent] = useState<any[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const statuses = statusOptions.split(',').map(s => s.trim());

  // Fetch tasks
  const { data: fetchRes, error, mutate } = useSWR(
    '/api/tasks',
    () => tasksApi.query('').then(r => r.data)
  );

  useEffect(() => {
    if (fetchRes) setTasks(fetchRes as any[]);
  }, [fetchRes]);

  const handleCreateTask = async (status: string) => {
    try {
      const title = prompt("Task title:");
      if (!title) return;
      
      const newTaskData = {
        title: title,
        status: status,
        priority: "medium",
        position: tasks.filter(t => t.status === status).length * 1000,
        content: [{ type: "paragraph", content: "" }]
      };
      
      // Optimistic create
      const tempId = `temp-${Date.now()}`;
      setTasks(prev => [...prev, { ...newTaskData, id: tempId }]);
      
      const res = await tasksApi.create(newTaskData);
      
      if (res.status === 200) {
        mutate();
      } else {
        // Rollback
        setTasks(fetchRes as any[] || []);
      }
    } catch (e) {
      console.error(e);
      setTasks(fetchRes as any[] || []);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await tasksApi.update(taskId, {
        status: newStatus
      });
      mutate();
    } catch (e) {
      console.error(e);
      setTasks(fetchRes as any[] || []); // rollback on failure
    }
  };

  const openTask = async (task: any) => {
    setSelectedTask(task);
    if (task.content && Array.isArray(task.content)) {
        setTaskContent(task.content);
    } else {
        setTaskContent([{ type: "paragraph", content: "No content." }]);
    }
  };

  const handleTaskContentSave = async (blocks: any[]) => {
    setTaskContent(blocks);
    if (!selectedTask) return;
    
    setSavingTask(true);
    
    try {
      await tasksApi.update(selectedTask.id, {
        content: blocks
      });
      // also optimistic update local task state
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, content: blocks } : t));
      mutate();
    } catch (e) {
      console.error("Failed to save task content", e);
    } finally {
      setSavingTask(false);
    }
  };

  if (error) {
    return <div className="p-4 text-red-400 text-sm border border-red-500/30 rounded-xl bg-red-900/10">Failed to load tasks.</div>;
  }
  
  if (!fetchRes && tasks.length === 0) {
    return <div className="p-4 text-white/50 text-sm">Loading tasks database...</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 min-h-[400px]">
      {statuses.map(status => (
        <div 
          key={status} 
          className="flex-1 min-w-[250px] max-w-[350px] bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("taskId");
            if (taskId) updateTaskStatus(taskId, status);
          }}
        >
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-sm font-semibold text-white/80">{status}</h3>
            <button 
              onClick={() => handleCreateTask(status)}
              className="text-white/40 hover:text-white transition-colors p-1"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col gap-2">
            <AnimatePresence>
              {tasks.filter(t => t.status === status)
                .sort((a, b) => (a.position || 0) - (b.position || 0))
                .map(task => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={task.id}
                  draggable
                  onDragStart={(e: any) => e.dataTransfer.setData("taskId", task.id)}
                  className="bg-black/40 border border-white/5 rounded-lg p-3 cursor-pointer hover:border-white/20 transition-all group"
                  onClick={() => openTask(task)}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={16} className="text-white/20 opacity-0 group-hover:opacity-100 cursor-grab mt-0.5 -ml-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-white/90">{task.title || 'Untitled'}</p>
                      {task.priority && (
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-white/60">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}

      {/* Task Side Peek Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(isOpen) => !isOpen && setSelectedTask(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] sm:max-w-[540px] border-l border-white/10 bg-black/95 text-white overflow-y-auto p-0">
          {selectedTask && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-6 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-white/60">
                    {selectedTask.status}
                  </span>
                  {selectedTask.priority && (
                    <span className="text-[10px] uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                      {selectedTask.priority}
                    </span>
                  )}
                  {savingTask && <span className="text-xs text-white/40 ml-auto">Saving...</span>}
                </div>
                <SheetTitle className="text-2xl font-bold text-white">
                  {selectedTask.title || 'Untitled Task'}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 p-6">
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
    </div>
  );
}
