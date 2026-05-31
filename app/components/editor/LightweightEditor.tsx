'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { Block, PartialBlock, filterSuggestionItems } from '@blocknote/core';
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

  let safeInitialContent: any = undefined;
  if (initialContent) {
    if (typeof initialContent === 'string') {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          safeInitialContent = parsed;
        }
      } catch (e) {
        // ignore
      }
    } else if (Array.isArray(initialContent) && initialContent.length > 0) {
      safeInitialContent = initialContent;
    }
  }

  // Create a clean blocknote instance without our custom recursive blocks
  const editor = useCreateBlockNote({
    initialContent: safeInitialContent,
  });

  return (
    <div className="w-full h-full min-h-[300px]">
      <BlockNoteView
        editor={editor}
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
