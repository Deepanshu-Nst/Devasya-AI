import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems } from "@blocknote/core";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";

// Minimal schema - ONLY defaults, no custom blocks
// This is a diagnostic build to isolate the Prosemirror crash
export const schema = BlockNoteSchema.create();

// Only default slash commands - custom AI ones disabled for diagnostic
export const getCustomSlashMenuItems = (editor: typeof schema.BlockNoteEditor) => [
  ...getDefaultReactSlashMenuItems(editor),
];
