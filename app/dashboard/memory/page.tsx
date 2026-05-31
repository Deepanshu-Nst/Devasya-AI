'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  FolderOpen,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { memoryApi, blocksApi } from '@/lib/api-client';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

const BlockEditor = dynamic(() => import('@/app/components/editor/BlockEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-3 p-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${75 + Math.random() * 20}%` }} />
      ))}
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
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MemoryMode() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Keyboard shortcut: Ctrl/Cmd + S to save
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
        setSaveError(batchRes.error || 'Failed to save.');
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
    setUploadStatus('Uploading document...');
    setUploadError(null);

    const stages = [
      { delay: 5000, msg: 'Server starting up...' },
      { delay: 20000, msg: 'Extracting and processing text...' },
      { delay: 50000, msg: 'Indexing document chunks...' },
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
      setUploadError(err?.message || 'Network error. Try again.');
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
        className="w-full group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors duration-150 relative"
        style={{
          background: isActive ? 'oklch(0.62 0.20 265 / 0.10)' : 'transparent',
          color: isActive ? 'oklch(0.85 0 0)' : 'oklch(0.52 0 0)',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.72 0 0)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.52 0 0)';
          }
        }}
      >
        {/* Active accent dot */}
        {isActive && (
          <span
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
            style={{ background: 'oklch(0.70 0.18 265)' }}
          />
        )}

        {item.isDocInfo ? (
          <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
        ) : (
          <AlignLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />
        )}

        <span className="text-[13px] truncate flex-1" style={{ color: 'inherit' }}>
          {item.isDocInfo ? item.source : item.title || 'Untitled'}
        </span>

        {/* Relative date on hover */}
        <span
          className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          style={{ color: 'oklch(0.40 0 0)' }}
        >
          {formatRelativeDate(item.created_at)}
        </span>
      </button>
    );
  };

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: 'oklch(0.115 0 0)' }}
    >
      {/* ─── Page list sidebar ─── */}
      <div
        className="w-56 shrink-0 flex flex-col h-full"
        style={{ borderRight: '1px solid oklch(0.20 0 0)' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: 'oklch(0.75 0 0)' }}
            >
              My Notes
            </h2>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{
                background: 'oklch(0.20 0 0)',
                color: 'oklch(0.45 0 0)',
              }}
            >
              {noteItems.length}
            </span>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'oklch(0.18 0 0)', border: '1px solid oklch(0.22 0 0)' }}
          >
            <Search className="w-3 h-3 shrink-0" style={{ color: 'oklch(0.42 0 0)' }} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-[oklch(0.38_0_0)]"
              style={{ color: 'oklch(0.80 0 0)' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={handleCreateNew}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150"
            style={{ background: 'oklch(0.62 0.20 265 / 0.12)', color: 'oklch(0.75 0.16 265)' }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.background = 'oklch(0.62 0.20 265 / 0.18)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.background = 'oklch(0.62 0.20 265 / 0.12)')
            }
          >
            <Plus className="w-3.5 h-3.5" /> New note
          </button>
          <button
            onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
            disabled={isUploading}
            title="Upload document"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 shrink-0 disabled:opacity-50"
            style={{
              background: 'oklch(0.18 0 0)',
              border: '1px solid oklch(0.24 0 0)',
              color: 'oklch(0.52 0 0)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'oklch(0.22 0 0)';
              (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0 0)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0 0)';
              (e.currentTarget as HTMLElement).style.color = 'oklch(0.52 0 0)';
            }}
          >
            <UploadCloud className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
          />
        </div>

        {/* Upload status */}
        <AnimatePresence>
          {isUploading && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-2 overflow-hidden"
            >
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                style={{ background: 'oklch(0.62 0.20 265 / 0.08)', color: 'oklch(0.65 0.15 265)' }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                  style={{ borderColor: 'oklch(0.62 0.20 265)', borderTopColor: 'transparent' }}
                />
                <span className="truncate">{uploadStatus || 'Uploading...'}</span>
              </div>
            </MotionDiv>
          )}
          {uploadError && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-2 overflow-hidden"
            >
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
                style={{
                  background: 'oklch(0.52 0.20 25 / 0.10)',
                  border: '1px solid oklch(0.52 0.20 25 / 0.25)',
                  color: 'oklch(0.70 0.18 25)',
                }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="flex-1">{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="opacity-60 hover:opacity-100 shrink-0">✕</button>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Separator */}
        <div className="mx-3 mb-2" style={{ height: '1px', background: 'oklch(0.20 0 0)' }} />

        {/* Page list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          {loading ? (
            <div className="px-3 space-y-2 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-7 rounded-lg" style={{ width: i % 2 === 0 ? '80%' : '65%' }} />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <BookOpen className="w-8 h-8 mb-2" style={{ color: 'oklch(0.28 0 0)' }} />
              <p className="text-[12px]" style={{ color: 'oklch(0.38 0 0)' }}>
                {searchQuery ? 'No results' : 'No notes yet'}
              </p>
            </div>
          ) : (
            <>
              {noteItems.length > 0 && (
                <>
                  <div className="px-3 py-2">
                    <span className="text-label" style={{ color: 'oklch(0.36 0 0)' }}>
                      Notes
                    </span>
                  </div>
                  {noteItems.map(item => <PageItem key={item.id} item={item} />)}
                </>
              )}
              {docItems.length > 0 && (
                <>
                  <div className="px-3 py-2 mt-2">
                    <span className="text-label" style={{ color: 'oklch(0.36 0 0)' }}>
                      Documents
                    </span>
                  </div>
                  {docItems.map(item => <PageItem key={item.id} item={item} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Editor area ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {selectedItem ? (
          <div className="flex-1 overflow-y-auto styled-scrollbar">
            <div className="max-w-3xl mx-auto px-8 md:px-16 py-10">
              <MotionDiv
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-8">
                  <div
                    className="flex items-center gap-1.5 text-[12px]"
                    style={{ color: 'oklch(0.40 0 0)' }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Memory</span>
                    <span style={{ color: 'oklch(0.28 0 0)' }}>/</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>
                      {selectedItem.isDocInfo ? 'Document' : 'Note'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {saveError && (
                      <MotionDiv
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg"
                        style={{
                          background: 'oklch(0.52 0.20 25 / 0.10)',
                          border: '1px solid oklch(0.52 0.20 25 / 0.25)',
                          color: 'oklch(0.70 0.18 25)',
                        }}
                      >
                        <AlertCircle className="w-3 h-3" />
                        {saveError}
                      </MotionDiv>
                    )}

                    {!selectedItem.isDocInfo && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-50"
                        style={{
                          background: saveSuccess
                            ? 'oklch(0.65 0.18 145 / 0.12)'
                            : 'oklch(0.20 0 0)',
                          color: saveSuccess ? 'oklch(0.70 0.16 145)' : 'oklch(0.65 0 0)',
                          border: `1px solid ${saveSuccess ? 'oklch(0.65 0.18 145 / 0.25)' : 'oklch(0.26 0 0)'}`,
                        }}
                      >
                        {isSaving ? (
                          <>
                            <div
                              className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                              style={{ borderColor: 'oklch(0.62 0.20 265)', borderTopColor: 'transparent' }}
                            />
                            Saving...
                          </>
                        ) : saveSuccess ? (
                          <>
                            <Check className="w-3 h-3" /> Saved
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteItem(selectedItem)}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all duration-150"
                      style={{ color: 'oklch(0.55 0.15 25)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.52 0.20 25 / 0.10)';
                        (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.18 25)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'oklch(0.55 0.15 25)';
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Document info view */}
                {selectedItem.isDocInfo ? (
                  <MotionDiv
                    key={selectedItem.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                      style={{ background: 'oklch(0.20 0 0)', border: '1px solid oklch(0.26 0 0)' }}
                    >
                      <File className="w-7 h-7" style={{ color: 'oklch(0.62 0.20 265)' }} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: 'oklch(0.88 0 0)' }}>
                      {editTitle}
                    </h2>
                    <p className="text-[14px] max-w-sm" style={{ color: 'oklch(0.48 0 0)' }}>
                      This document has been indexed for AI context. Its content is split into semantic chunks for retrieval.
                    </p>
                  </MotionDiv>
                ) : (
                  /* Note editor */
                  <MotionDiv
                    key={selectedItem.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col"
                  >
                    {/* Title */}
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => {
                        setEditTitle(e.target.value);
                        setSaveSuccess(false);
                        setSaveError(null);
                      }}
                      placeholder="Untitled"
                      className="w-full bg-transparent outline-none font-bold tracking-tight mb-6 placeholder:text-[oklch(0.28_0_0)]"
                      style={{
                        fontSize: '2.25rem',
                        lineHeight: '1.2',
                        color: 'oklch(0.92 0 0)',
                      }}
                    />

                    {/* Editor */}
                    <div
                      className="min-h-[400px] rounded-xl"
                      style={{
                        background: 'oklch(0.14 0 0)',
                        border: '1px solid oklch(0.20 0 0)',
                        padding: '20px 24px',
                      }}
                    >
                      <ErrorBoundary>
                        <BlockEditor
                          initialContent={editContent}
                          onChange={blocks => {
                            setEditContent(blocks);
                            setSaveSuccess(false);
                            setSaveError(null);
                          }}
                        />
                      </ErrorBoundary>
                    </div>

                    {/* Footer hint */}
                    <p className="text-[11px] mt-3 text-center" style={{ color: 'oklch(0.30 0 0)' }}>
                      ⌘S to save · Type / for commands
                    </p>
                  </MotionDiv>
                )}
              </MotionDiv>
            </div>
          </div>
        ) : (
          /* Empty state — no page selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <MotionDiv
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-center max-w-sm"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'oklch(0.18 0 0)', border: '1px solid oklch(0.24 0 0)' }}
              >
                <BookOpen className="w-6 h-6" style={{ color: 'oklch(0.40 0 0)' }} />
              </div>

              <h2
                className="text-xl font-semibold tracking-tight mb-2"
                style={{ color: 'oklch(0.65 0 0)' }}
              >
                Your second brain
              </h2>
              <p className="text-[14px] mb-8 leading-relaxed" style={{ color: 'oklch(0.40 0 0)' }}>
                Select a note to open it, or create a new one to start writing.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-[13px] font-semibold transition-all duration-150"
                  style={{ background: 'oklch(0.62 0.20 265)', color: 'oklch(0.98 0 0)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                >
                  <Plus className="w-4 h-4" /> New note
                </button>
                <button
                  onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
                  className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-[13px] font-medium transition-all duration-150"
                  style={{
                    background: 'oklch(0.18 0 0)',
                    border: '1px solid oklch(0.26 0 0)',
                    color: 'oklch(0.58 0 0)',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'oklch(0.22 0 0)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0 0)')}
                >
                  <UploadCloud className="w-4 h-4" /> Upload doc
                </button>
              </div>
            </MotionDiv>
          </div>
        )}
      </div>
    </div>
  );
}
