'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { Block, PartialBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/shadcn/style.css';
import { useTheme } from 'next-themes';

interface BlockEditorProps {
  initialContent?: PartialBlock[];
  onChange: (blocks: Block[]) => void;
  editable?: boolean;
}

export default function BlockEditor({ initialContent, onChange, editable = true }: BlockEditorProps) {
  const { theme } = useTheme();

  // Initialize the editor with initial content.
  // We use useCreateBlockNote to properly manage the editor lifecycle in React.
  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
  });

  return (
    <div className="w-full min-h-[500px]">
      <BlockNoteView
        editor={editor}
        theme={theme === 'dark' ? 'dark' : 'light'}
        editable={editable}
        onChange={() => {
          onChange(editor.document);
        }}
      />
    </div>
  );
}
