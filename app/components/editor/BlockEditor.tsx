'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { Block, PartialBlock, filterSuggestionItems, defaultBlockSpecs } from '@blocknote/core';
import { SuggestionMenuController } from "@blocknote/react";
import '@blocknote/core/fonts/inter.css';
import '@blocknote/shadcn/style.css';
import { useTheme } from 'next-themes';
import { schema, getCustomSlashMenuItems } from './slashCommands';

interface BlockEditorProps {
  initialContent?: PartialBlock[];
  onChange: (blocks: Block[]) => void;
  editable?: boolean;
}

export default function BlockEditor({ initialContent, onChange, editable = true }: BlockEditorProps) {
  const { theme } = useTheme();
  // Filter unknown block types to prevent Prosemirror 'reading node' crashes
  const knownTypes = new Set([
    ...Object.keys(defaultBlockSpecs),
    'database_view', 'ai'
  ]);

  const sanitizeBlocks = (blocks: any): any[] | undefined => {
    if (!Array.isArray(blocks)) {
      if (typeof blocks === 'string') {
        try {
          const parsed = JSON.parse(blocks);
          if (Array.isArray(parsed)) return sanitizeBlocks(parsed);
          return undefined;
        } catch {
          return undefined;
        }
      }
      return undefined;
    }
    
    const validBlocks = [];
    for (const b of blocks) {
      if (!b || typeof b !== 'object') continue;
      
      const isKnown = typeof b.type === 'string' && knownTypes.has(b.type);
      const sanitized: any = { type: isKnown ? b.type : 'paragraph' };
      
      if (!isKnown) {
        console.warn(`Unknown or missing block type: ${b.type || 'undefined'}, converting to paragraph.`);
        sanitized.content = [{ type: "text", text: `[Unsupported Block Type: ${b.type || 'missing'}]`, styles: {} }];
        sanitized.props = {}; 
      } else {
        if (b.props && typeof b.props === 'object') {
          sanitized.props = { ...b.props };
        }
        if (typeof b.content === 'string') {
          sanitized.content = b.content;
        } else if (Array.isArray(b.content)) {
          // BlockNote default inline types: text, link
          sanitized.content = b.content.filter((c: any) => c && typeof c === 'object' && (c.type === 'text' || c.type === 'link'));
        }
      }
      
      if (b.children && Array.isArray(b.children)) {
        const sanitizedChildren = sanitizeBlocks(b.children);
        if (sanitizedChildren && sanitizedChildren.length > 0) {
          sanitized.children = sanitizedChildren;
        }
      }
      validBlocks.push(sanitized);
    }
    return validBlocks.length > 0 ? validBlocks : undefined;
  };

  const sanitized = sanitizeBlocks(initialContent);
  const safeInitialContent = sanitized && sanitized.length > 0 ? sanitized : undefined;

  // Initialize the editor with initial content.
  // We use useCreateBlockNote to properly manage the editor lifecycle in React.
  const editorOptions: any = { schema };
  if (safeInitialContent) {
    editorOptions.initialContent = safeInitialContent;
  }
  const editor = useCreateBlockNote(editorOptions);

  return (
    <div className="w-full min-h-[500px]">
      <BlockNoteView
        editor={editor as any}
        theme={theme === 'dark' ? 'dark' : 'light'}
        editable={editable}
        slashMenu={false}
        onChange={() => {
          onChange(editor.document as any);
        }}
      >
        {/* Custom slash menu implementation */}
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor as any), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
