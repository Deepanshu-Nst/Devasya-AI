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
    return blocks.map(b => {
      const isKnown = b.type && knownTypes.has(b.type);
      const sanitized = { ...b };
      if (!isKnown) {
        sanitized.type = 'paragraph';
        sanitized.content = [{ type: "text", text: `[Unsupported Block Type: ${b.type || 'missing'}]`, styles: {} }];
        sanitized.props = {}; 
      }
      if (sanitized.children && Array.isArray(sanitized.children)) {
        const sanitizedChildren = sanitizeBlocks(sanitized.children);
        if (sanitizedChildren) sanitized.children = sanitizedChildren;
      }
      return sanitized;
    });
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
            filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
