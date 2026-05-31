'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { Block, PartialBlock, filterSuggestionItems } from '@blocknote/core';
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
    'paragraph', 'heading', 'bulletListItem', 'numberedListItem', 
    'checkListItem', 'image', 'file', 'video', 'audio', 'table', 
    'codeBlock', 'database_view', 'ai'
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
    return blocks.map(b => {
      const isKnown = b.type && knownTypes.has(b.type);
      const sanitized = { ...b };
      if (!isKnown && b.type) {
        console.warn(`Unknown block type: ${b.type}, converting to paragraph to prevent crash.`);
        sanitized.type = 'paragraph';
        sanitized.content = [{ type: "text", text: `[Unsupported Block Type: ${b.type}]`, styles: {} }];
        sanitized.props = {}; // clear unsupported props
      }
      if (sanitized.children && Array.isArray(sanitized.children)) {
        const sanitizedChildren = sanitizeBlocks(sanitized.children);
        if (sanitizedChildren) sanitized.children = sanitizedChildren;
      }
      return sanitized;
    });
  };

  const sanitized = sanitizeBlocks(initialContent);
  const safeInitialContent = sanitized && sanitized.length > 0 ? sanitized : undefined;

  // Initialize the editor with initial content.
  // We use useCreateBlockNote to properly manage the editor lifecycle in React.
  const editor = useCreateBlockNote({
    schema,
    initialContent: safeInitialContent as any,
  });

  return (
    <div className="w-full min-h-[500px]">
      <BlockNoteView
        editor={editor}
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
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
