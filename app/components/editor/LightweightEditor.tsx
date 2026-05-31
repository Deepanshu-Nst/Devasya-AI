'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { Block, PartialBlock, filterSuggestionItems, defaultBlockSpecs } from '@blocknote/core';
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import '@blocknote/core/fonts/inter.css';
import '@blocknote/shadcn/style.css';
import { useTheme } from 'next-themes';

interface LightweightEditorProps {
  initialContent?: PartialBlock[];
  onChange: (blocks: Block[]) => void;
  editable?: boolean;
}

export default function LightweightEditor({ initialContent, onChange, editable = true }: LightweightEditorProps) {
  const { theme } = useTheme();

  const knownTypes = new Set(Object.keys(defaultBlockSpecs));

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
        sanitized.content = [{ type: "text", text: `[Unsupported Block Type: ${b.type || 'missing'}]`, styles: {} }];
        sanitized.props = {}; 
      } else {
        if (b.props && typeof b.props === 'object') {
          sanitized.props = { ...b.props };
        }
        if (typeof b.content === 'string') {
          sanitized.content = b.content;
        } else if (Array.isArray(b.content)) {
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

  const safeInitialContent = sanitizeBlocks(initialContent);

  // Create a clean blocknote instance without our custom recursive blocks
  const editorOptions: any = {};
  if (safeInitialContent && safeInitialContent.length > 0) {
    editorOptions.initialContent = safeInitialContent;
  }
  const editor = useCreateBlockNote(editorOptions);

  return (
    <div className="w-full h-full min-h-[300px]">
      <BlockNoteView
        editor={editor as any}
        theme={theme === 'dark' ? 'dark' : 'light'}
        editable={editable}
        slashMenu={false}
        onChange={() => {
          onChange(editor.document as any);
        }}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            filterSuggestionItems(getDefaultReactSlashMenuItems(editor as any), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
