'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, UploadCloud, FileText, File, Trash2, Save, AlignLeft, ChevronRight, Check } from 'lucide-react';
import { memoryApi } from '@/lib/api-client';

const MotionDiv = motion.div as any;

export default function MemoryMode() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection & Editing
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // File Upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMemories();
  }, []);

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
    const newItem = {
      id: 'temp_' + Date.now(),
      title: '',
      content: '',
      isNew: true
    };
    setSelectedItem(newItem);
    setEditTitle('');
    setEditContent('');
  };

  const handleSelect = (item: any) => {
    setSelectedItem(item);
    if (item.isDocInfo) {
      setEditTitle(item.source);
      // Try to concatenate chunk contents if it's a doc to view it?
      setEditContent("Document content is split into chunks for processing. Note: Editing raw document chunks is currently limited.");
    } else {
      setEditTitle(item.title || '');
      setEditContent(item.content || '');
    }
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (selectedItem.isNew) {
        const res = await memoryApi.add(editContent, editTitle || undefined);
        if (res.status === 200) {
          const newMem = res.data;
          setMemories(prev => [newMem, ...prev]);
          setSelectedItem(newMem);
        }
      } else if (!selectedItem.isDocInfo) {
        const res = await memoryApi.update(selectedItem.id, editContent, editTitle || undefined);
        if (res.status === 200) {
          setMemories(prev => prev.map(m => m.id === selectedItem.id ? res.data : m));
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    const confirmed = window.confirm("Are you sure you want to delete this?");
    if (!confirmed) return;
    
    try {
      if (item.isDocInfo) {
        const pieces = memories.filter(m => m.meta_data?.source === item.source);
        await Promise.all(pieces.map(p => memoryApi.delete(p.id)));
      } else {
        await memoryApi.delete(item.id);
      }
      setMemories(m => item.isDocInfo ? m.filter(x => x.meta_data?.source !== item.source) : m.filter(x => x.id !== item.id));
      if (selectedItem?.id === item.id || selectedItem?.source === item.source) {
        setSelectedItem(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      try {
        const res = await memoryApi.upload(file);
        if (res.status === 200) {
          await loadMemories();
        } else {
          alert('Failed to upload document');
        }
      } catch (err) {
        alert('Upload completely failed.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  // Group chunks
  const displayItems = () => {
    const items: any[] = [];
    const docSources = new Set<string>();

    memories.forEach(m => {
      const source = m.meta_data?.source;
      if (m.meta_data?.type === 'document' && source) {
        if (!docSources.has(source)) {
          docSources.add(source);
          items.push({
            isDocInfo: true,
            source,
            id: 'doc_' + source,
            title: source,
            created_at: m.created_at,
          });
        }
      } else {
        items.push(m);
      }
    });

    return items
      .filter(m =>
        ((m.title || m.source || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
        (!m.isDocInfo && m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const filteredItems = displayItems();

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative text-foreground">
      
      {/* Sidebar - Notion Style */}
      <div className="w-64 md:w-72 border-r border-white/5 bg-card/10 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              D
            </div>
            <span className="font-semibold text-sm">Devasya Workspace</span>
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-full bg-white/5 text-sm rounded-md focus:outline-none focus:bg-white/10 transition-colors"
              />
            </div>
          </div>
          
          <button 
            onClick={handleCreateNew}
            className="w-full flex items-center gap-2 text-sm text-foreground hover:bg-white/5 p-1.5 rounded-md transition-colors font-medium mb-1"
          >
            <Plus className="w-4 h-4" /> Add a page
          </button>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 p-1.5 rounded-md transition-colors cursor-pointer mb-4"
          >
            {isUploading ? <span className="animate-pulse w-full text-left">Uploading...</span> : <><UploadCloud className="w-4 h-4" /> Upload Document</>}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 no-scrollbar pb-4">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 mt-2">Private</div>
          {loading ? (
             <div className="px-2 text-sm text-muted-foreground animate-pulse">Loading...</div>
          ) : filteredItems.length === 0 ? (
             <div className="px-2 text-sm text-muted-foreground">No pages found.</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${selectedItem?.id === item.id ? 'bg-white/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
              >
                <ChevronRight className={`w-3 h-3 ${selectedItem?.id === item.id ? 'rotate-90 text-foreground' : 'opacity-50'}`} />
                {item.isDocInfo ? <FileText className="w-3.5 h-3.5 opacity-70 shrink-0" /> : <AlignLeft className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                <span className="truncate flex-1">{item.isDocInfo ? item.source : (item.title || 'Untitled')}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-background relative overflow-y-auto">
        {selectedItem ? (
          <div className="max-w-4xl w-full mx-auto p-8 md:p-16 h-full flex flex-col">
              <MotionDiv 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center mb-12"
              >
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span>Workspace</span>
                  <span className="text-white/20">/</span>
                  <span className="text-foreground">{selectedItem.isDocInfo ? 'Document' : 'Note'}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {!selectedItem.isDocInfo && (
                     <button
                       onClick={handleSave}
                       disabled={isSaving}
                       className="flex items-center gap-2 text-sm font-medium hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors text-foreground/80"
                     >
                       {isSaving ? <span className="animate-pulse">Saving...</span> : saveSuccess ? <><Check className="w-4 h-4 text-green-500" /> Saved</> : 'Save'}
                     </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(selectedItem)}
                    className="flex items-center gap-2 text-sm font-medium text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </MotionDiv>

              {!selectedItem.isDocInfo ? (
                <MotionDiv 
                  key={selectedItem.id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="flex-1 flex flex-col space-y-6"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      setSaveSuccess(false);
                    }}
                    placeholder="Untitled"
                    className="text-4xl md:text-5xl font-bold bg-transparent outline-none placeholder:text-white/20 text-foreground w-full"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      setSaveSuccess(false);
                    }}
                    placeholder="Press space for AI, or start typing..."
                    className="flex-1 w-full text-base md:text-lg text-foreground/80 leading-relaxed bg-transparent outline-none resize-none placeholder:text-white/20 mt-4"
                  />
                </MotionDiv>
              ) : (
                <MotionDiv 
                  key={selectedItem.id}
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="flex-1 flex flex-col items-center justify-center text-center"
                >
                   <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                      <File className="w-10 h-10 text-primary" />
                   </div>
                   <h1 className="text-3xl font-bold mb-4">{editTitle}</h1>
                   <p className="text-muted-foreground max-w-md">{editContent}</p>
                </MotionDiv>
              )}
           </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
             <div className="text-center opacity-60">
               <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8" />
               </div>
               <p className="text-lg font-medium">Select a page or create a new one</p>
               <p className="text-sm mt-2 opacity-70 max-w-sm">Create documents, add context, and give your AI a rich second brain.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
