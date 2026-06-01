'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  UploadCloud,
  FileText,
  File,
  Trash2,
  AlignLeft,
  Check,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { memoryApi, blocksApi } from '@/lib/api-client';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

const BlockEditor = dynamic(() => import('@/app/components/editor/BlockEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-3 p-2">
      <div className="skeleton h-4 rounded w-3/4" />
      <div className="skeleton h-4 rounded w-1/2" />
    </div>
  ),
});

const MotionDiv = motion.div as any;

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MemoryMode() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (selectedItem && !selectedItem.isDocInfo) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItem, editTitle, editContent]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const res = await memoryApi.list(0, 100);
      if (res.status === 200) {
        setMemories((res.data as any)?.memories || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    const newItem = { id: 'temp_' + Date.now(), title: '', content: '', isNew: true };
    setSelectedItem(newItem);
    setEditTitle('');
    setEditContent([]);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSelect = async (item: any) => {
    setSelectedItem(item);
    setSaveError(null);
    setSaveSuccess(false);

    if (item.isDocInfo) {
      setEditTitle(item.source);
      setEditContent([]);
      return;
    }

    setEditTitle(item.title || '');
    setIsFetchingContent(true);
    try {
      const res = await blocksApi.getChildren(item.id);
      if (res.status === 200 && res.data) {
        const children = res.data as any[];
        if (children.length > 0) {
          const mappedBlocks = children.map(b => ({
            id: b.id,
            type: b.type,
            props: b.properties,
            content: b.content ? JSON.parse(b.content) : undefined,
            children: [],
          }));
          setEditContent(mappedBlocks);
        } else {
          let blocks: any[] = [];
          try {
            blocks = JSON.parse(item.content);
            if (!Array.isArray(blocks)) throw new Error('Not array');
          } catch {
            blocks = item.content ? [{ type: 'paragraph', content: item.content }] : [];
          }
          setEditContent(blocks);
        }
      } else {
        throw new Error('Failed to fetch children');
      }
    } catch {
      let blocks: any[] = [];
      try {
        blocks = JSON.parse(item.content);
        if (!Array.isArray(blocks)) throw new Error('Not array');
      } catch {
        blocks = item.content ? [{ type: 'paragraph', content: item.content }] : [];
      }
      setEditContent(blocks);
    } finally {
      setIsFetchingContent(false);
    }
  };

  const handleSave = async () => {
    if (
      !editContent ||
      editContent.length === 0 ||
      (editContent.length === 1 && editContent[0].content === undefined)
    ) {
      setSaveError('Note content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      let pageId = selectedItem.id;

      if (selectedItem.isNew) {
        const pageRes = await blocksApi.create({
          type: 'page',
          properties: { title: editTitle || 'Untitled', visibility: 'private' },
        });
        if (pageRes.status === 200 && pageRes.data) {
          pageId = (pageRes.data as any).id;
        } else {
          setSaveError(pageRes.error || 'Failed to create page.');
          setIsSaving(false);
          return;
        }
      } else {
        await blocksApi.update(pageId, {
          properties: { title: editTitle || 'Untitled' },
        });
      }

      const operations: any[] = [];
      const flattenBlocks = (blocks: any[], parentId: string, offset = 0) => {
        blocks.forEach((b, i) => {
          operations.push({
            op: 'update',
            block: {
              id: b.id,
              type: b.type,
              parent_id: parentId,
              position: offset + i,
              content: b.content ? JSON.stringify(b.content) : null,
              properties: b.props || {},
            },
          });
          if (b.children?.length) flattenBlocks(b.children, b.id, offset + i * 1000);
        });
      };
      flattenBlocks(editContent, pageId);

      const batchRes = await blocksApi.batch(operations);
      if (batchRes.status === 200) {
        await loadMemories();
        const listRes = await memoryApi.list(0, 100);
        if (listRes.status === 200) {
          const list = (listRes.data as any)?.memories || [];
          const freshItem = list.find((m: any) => m.id === pageId);
          if (freshItem) setSelectedItem(freshItem);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setSaveError(batchRes.error || 'Failed to persist memory.');
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Unexpected error.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!window.confirm('Delete this permanently?')) return;
    try {
      if (item.isDocInfo) {
        const pieces = memories.filter(m => m.meta_data?.source === item.source);
        await Promise.all(pieces.map(p => memoryApi.delete(p.id)));
      } else {
        await memoryApi.delete(item.id);
      }
      setMemories(m =>
        item.isDocInfo
          ? m.filter(x => x.meta_data?.source !== item.source)
          : m.filter(x => x.id !== item.id)
      );
      if (selectedItem?.id === item.id || selectedItem?.source === item.source) {
        setSelectedItem(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsUploading(true);
    setUploadStatus('Indexing context chunks...');
    setUploadError(null);

    const stages = [
      { delay: 3000, msg: 'Extracting text...' },
      { delay: 15000, msg: 'Indexing context chunks...' },
    ];
    const timers = stages.map(({ delay, msg }) => setTimeout(() => setUploadStatus(msg), delay));

    try {
      const res = await memoryApi.upload(file);
      timers.forEach(clearTimeout);
      if (res.status === 200) {
        setUploadStatus('');
        await loadMemories();
      } else {
        const err = (res.data as any)?.detail || res.error || 'Upload failed.';
        setUploadError(err);
      }
    } catch (err: any) {
      timers.forEach(clearTimeout);
      setUploadError(err?.message || 'Network error.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayItems = () => {
    const items: any[] = [];
    const docSources = new Set<string>();
    memories.forEach(m => {
      const source = m.meta_data?.source;
      if (m.meta_data?.type === 'document' && source) {
        if (!docSources.has(source)) {
          docSources.add(source);
          items.push({ isDocInfo: true, source, id: 'doc_' + source, title: source, created_at: m.created_at });
        }
      } else {
        items.push(m);
      }
    });
    return items
      .filter(m =>
        (m.title || m.source || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (!m.isDocInfo && m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const filteredItems = displayItems();
  const noteItems = filteredItems.filter(i => !i.isDocInfo);
  const docItems = filteredItems.filter(i => i.isDocInfo);

  const PageItem = ({ item }: { item: any }) => {
    const isActive = selectedItem?.id === item.id;
    return (
      <button
        onClick={() => handleSelect(item)}
        className="w-full group flex items-center gap-3 px-3 py-2 text-left transition-all duration-150 rounded-lg relative cognitive-surface"
        style={{ 
          color: isActive ? 'oklch(0.95 0 0)' : 'oklch(0.50 0 0)',
          background: isActive ? 'oklch(0.14 0 0)' : 'transparent' 
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.11 0 0)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.85 0 0)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.50 0 0)';
          }
        }}
      >
        {item.isDocInfo ? (
          <FileText className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${isActive ? 'opacity-100 animate-pulse-glow text-[oklch(0.65_0.20_250)]' : 'opacity-40 text-inherit'}`} />
        ) : (
          <AlignLeft className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${isActive ? 'opacity-100 animate-pulse-glow text-[oklch(0.65_0.20_250)]' : 'opacity-40 text-inherit'}`} />
        )}
        <span className="text-[13px] truncate flex-1 leading-relaxed font-medium tracking-wide">{item.isDocInfo ? item.source : item.title || 'Untitled'}</span>
        <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 font-mono tracking-widest" style={{ color: 'oklch(0.35 0 0)' }}>
          {formatRelativeDate(item.created_at)}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* ─── Page list sidebar (Sparse) ─── */}
      <div className="w-56 shrink-0 flex flex-col h-full pl-6 pt-6 pb-6 pr-2">
        
        {/* Header Actions */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase font-medium transition-colors"
            style={{ color: 'oklch(0.65 0.20 250)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.75 0.20 250)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)')}
          >
            <Plus className="w-4 h-4" /> Instantiate
          </button>
          
          <button
            onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
            disabled={isUploading}
            title="Ingest document"
            className="flex items-center justify-center w-6 h-6 ml-auto transition-colors disabled:opacity-50"
            style={{ color: 'oklch(0.40 0 0)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.80 0 0)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)')}
          >
            <UploadCloud className="w-3.5 h-3.5" />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
        </div>

        {/* Upload status */}
        <AnimatePresence>
          {isUploading && (
            <MotionDiv initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pb-4 overflow-hidden">
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'oklch(0.65 0.20 250)' }}>
                <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: 'oklch(0.65 0.20 250)' }} />
                <span className="truncate">{uploadStatus}</span>
              </div>
            </MotionDiv>
          )}
          {uploadError && (
            <MotionDiv initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pb-4 overflow-hidden">
              <div className="flex items-start gap-2 text-[12px]" style={{ color: 'oklch(0.70 0.18 25)' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="flex-1">{uploadError}</span>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Page list */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="space-y-4 px-2 mt-4">
              <div className="h-2 w-1/3 ambient-skeleton-subtle" />
              <div className="h-6 w-full ambient-skeleton rounded-lg opacity-40" />
              <div className="h-6 w-full ambient-skeleton rounded-lg opacity-40" />
              <div className="h-6 w-3/4 ambient-skeleton rounded-lg opacity-40" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-[12px] px-2" style={{ color: 'oklch(0.40 0 0)' }}>No context items.</div>
          ) : (
            <div className="space-y-14 px-2 mt-4">
              {noteItems.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pl-3" style={{ color: 'oklch(0.30 0 0)' }}>Notes</div>
                  <div className="space-y-0.5">
                    {noteItems.map(item => <PageItem key={item.id} item={item} />)}
                  </div>
                </div>
              )}
              {docItems.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pl-3" style={{ color: 'oklch(0.30 0 0)' }}>Documents</div>
                  <div className="space-y-0.5">
                    {docItems.map(item => <PageItem key={item.id} item={item} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Editor area (Sparse) ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {selectedItem ? (
          <div className="flex-1 overflow-y-auto styled-scrollbar">
            <div className="max-w-3xl mx-auto px-8 md:px-16 py-12">
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
                
                {/* Minimal Header */}
                <div className="flex items-center justify-between mb-24">
                  <div className="text-[11px] font-mono tracking-[0.18em] uppercase" style={{ color: 'oklch(0.35 0 0)' }}>
                    [ {selectedItem.isDocInfo ? 'CONTEXT / DOC' : 'CONTEXT / NOTE'} ]
                  </div>

                  <div className="flex items-center gap-4">
                    {saveError && (
                      <span className="text-[12px]" style={{ color: 'oklch(0.70 0.18 25)' }}>{saveError}</span>
                    )}
                    {!selectedItem.isDocInfo && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="text-[11px] tracking-[0.18em] uppercase font-medium transition-colors disabled:opacity-50"
                        style={{ color: saveSuccess ? 'oklch(0.65 0.15 150)' : 'oklch(0.50 0 0)' }}
                      >
                        {isSaving ? 'Persisting...' : saveSuccess ? 'Persisted' : 'Persist'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(selectedItem)}
                      className="text-[12px] transition-colors"
                      style={{ color: 'oklch(0.30 0 0)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.18 25)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.30 0 0)')}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {selectedItem.isDocInfo ? (
                  <div className="flex flex-col py-10 opacity-70">
                    <File className="w-8 h-8 mb-4" style={{ color: 'oklch(0.65 0.20 250)' }} />
                    <h2 className="text-2xl font-semibold mb-2" style={{ color: 'oklch(0.95 0 0)' }}>{editTitle}</h2>
                    <p className="text-[14px]" style={{ color: 'oklch(0.50 0 0)' }}>Indexed for retrieval context.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => { setEditTitle(e.target.value); setSaveSuccess(false); setSaveError(null); }}
                      placeholder="Context title"
                      className="w-full bg-transparent outline-none font-medium tracking-tight mb-4 placeholder:text-[oklch(0.25_0_0)]"
                      style={{ fontSize: '2rem', lineHeight: '1.2', color: 'oklch(0.95 0 0)' }}
                    />
                    <div className="flex gap-4 mb-16 text-[11px] tracking-[0.18em] uppercase font-medium opacity-40" style={{ color: 'oklch(0.50 0 0)' }}>
                      <span>coherence stable</span>
                      <span className="opacity-50">•</span>
                      <span>indexed recently</span>
                      <span className="opacity-50">•</span>
                      <span>linked across threads</span>
                    </div>
                    <div className="min-h-[400px]">
                      {isFetchingContent ? (
                        <div className="flex flex-col gap-3 p-2">
                          <div className="skeleton h-4 rounded w-3/4 opacity-50" />
                          <div className="skeleton h-4 rounded w-1/2 opacity-50" />
                          <div className="skeleton h-4 rounded w-5/6 opacity-50" />
                        </div>
                      ) : (
                        <ErrorBoundary>
                          <BlockEditor
                            key={selectedItem.id}
                            initialContent={editContent}
                            onChange={blocks => { setEditContent(blocks); setSaveSuccess(false); setSaveError(null); }}
                          />
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                )}
              </MotionDiv>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative flex flex-col items-end justify-end p-12 md:p-24 overflow-hidden">
            {/* Archival Background Grid & Faint Glow */}
            <div className="absolute inset-0 archival-grid opacity-[0.015] pointer-events-none" />
            <div className="absolute right-[-10%] bottom-[-10%] w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ background: 'oklch(0.65 0.20 250 / 0.05)' }} />
            
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="text-right max-w-sm relative z-10 opacity-[0.15] -translate-x-8 translate-y-8">
              <h2 className="text-6xl md:text-8xl font-bold tracking-tighter mb-4 uppercase" style={{ color: 'oklch(0.40 0 0)' }}>Archive</h2>
              <div className="w-16 h-[2px] ml-auto mb-6" style={{ background: 'oklch(0.20 0 0)' }} />
              <p className="text-[13px] leading-relaxed font-semibold tracking-widest uppercase" style={{ color: 'oklch(0.35 0 0)' }}>
                System ready. Select a document or note from the left to access context.
              </p>
            </MotionDiv>
          </div>
        )}
      </div>
    </div>
  );
}
