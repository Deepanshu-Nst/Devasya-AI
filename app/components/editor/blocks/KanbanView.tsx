'use client';

import React, { useState, useEffect } from 'react';
import { blocksApi } from '@/lib/api-client';
import { Plus, GripVertical, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import dynamic from 'next/dynamic';

const BlockEditor = dynamic(() => import('@/app/components/editor/BlockEditor'), { ssr: false });

interface KanbanViewProps {
  entityType: string;
  statusOptions: string;
}

export default function KanbanView({ entityType, statusOptions }: KanbanViewProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskContent, setTaskContent] = useState<any[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const statuses = statusOptions.split(',').map(s => s.trim());

  useEffect(() => {
    loadTasks();
  }, [entityType]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await blocksApi.query({ type: entityType, limit: 200 });
      if (res.status === 200 && res.data) {
        setTasks(res.data as any[]);
      }
    } catch (e) {
      console.error("Failed to load tasks", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (status: string) => {
    try {
      const title = prompt("Task title:");
      if (!title) return;
      
      const res = await blocksApi.create({
        type: entityType,
        properties: { 
          title: title,
          status: status,
          priority: "medium"
        }
      });
      
      if (res.status === 200) {
        loadTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, properties: { ...t.properties, status: newStatus } } : t));
    try {
      await blocksApi.update(taskId, {
        properties: { status: newStatus }
      });
      // Optionally reload to ensure sync
    } catch (e) {
      console.error(e);
      loadTasks(); // rollback on failure
    }
  };

  const openTask = async (task: any) => {
    setSelectedTask(task);
    setTaskContent([]); // clear while loading
    try {
      const res = await blocksApi.getChildren(task.id);
      if (res.status === 200 && res.data) {
        const children = res.data as any[];
        if (children.length > 0) {
          const mappedBlocks = children.map(b => ({
            id: b.id,
            type: b.type,
            props: b.properties,
            content: b.content ? JSON.parse(b.content) : undefined,
            children: [] 
          }));
          setTaskContent(mappedBlocks);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTaskContentSave = async (blocks: any[]) => {
    setTaskContent(blocks);
    if (!selectedTask) return;
    
    // Auto-save logic for task content (similar to batch save)
    setSavingTask(true);
    const operations: any[] = [];
    const flattenBlocks = (blocksToFlatten: any[], parentId: string, positionOffset = 0) => {
      blocksToFlatten.forEach((b, index) => {
        operations.push({
          op: "update",
          block: {
            id: b.id,
            type: b.type,
            parent_id: parentId,
            position: positionOffset + index,
            content: b.content ? JSON.stringify(b.content) : null,
            properties: b.props || {}
          }
        });
        if (b.children && b.children.length > 0) {
          flattenBlocks(b.children, b.id, positionOffset + index * 1000);
        }
      });
    };
    
    flattenBlocks(blocks, selectedTask.id);
    await blocksApi.batch(operations);
    setSavingTask(false);
  };

  if (loading) {
    return <div className="p-4 text-white/50 text-sm">Loading database...</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 min-h-[400px]">
      {statuses.map(status => (
        <div 
          key={status} 
          className="flex-1 min-w-[250px] max-w-[350px] bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
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
              {tasks.filter(t => (t.properties?.status || statuses[0]) === status).map(task => (
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
                      <p className="text-sm text-white/90">{task.properties?.title || 'Untitled'}</p>
                      {task.properties?.priority && (
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-white/60">
                          {task.properties.priority}
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
                    {selectedTask.properties?.status}
                  </span>
                  {selectedTask.properties?.priority && (
                    <span className="text-[10px] uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                      {selectedTask.properties.priority}
                    </span>
                  )}
                  {savingTask && <span className="text-xs text-white/40 ml-auto">Saving...</span>}
                </div>
                <SheetTitle className="text-2xl font-bold text-white">
                  {selectedTask.properties?.title || 'Untitled Task'}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 p-6">
                <BlockEditor 
                  initialContent={taskContent} 
                  onChange={handleTaskContentSave} 
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
