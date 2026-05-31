import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { DatabaseBlock } from "./blocks/DatabaseBlock";
import { AiBlock } from "./blocks/AiBlock";
import { Sparkles, FileText, CheckSquare, RefreshCw, ChevronRight } from "lucide-react";

// 1. Extend the default schema with our custom blocks
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    ai: AiBlock as any,
  },
});

// 2. Define custom slash commands
export const getCustomSlashMenuItems = (editor: typeof schema.BlockNoteEditor) => [
  ...getDefaultReactSlashMenuItems(editor),
  {
    title: "AI Assistant",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "ai",
        props: { action: "custom", status: "input" },
      } as any);
    },
    aliases: ["ai", "ask"],
    group: "AI",
    icon: <Sparkles size={18} className="text-primary" />,
  },
  {
    title: "Summarize",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "ai",
        props: { action: "summarize", status: "input" },
      } as any);
    },
    aliases: ["summarize", "tl;dr"],
    group: "AI",
    icon: <FileText size={18} className="text-primary" />,
  },
  {
    title: "Action Items",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "ai",
        props: { action: "extract_tasks", status: "input" },
      } as any);
    },
    aliases: ["action", "tasks", "todo"],
    group: "AI",
    icon: <CheckSquare size={18} className="text-primary" />,
  },
  {
    title: "Rewrite / Improve",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "ai",
        props: { action: "rewrite", status: "input" },
      } as any);
    },
    aliases: ["rewrite", "improve"],
    group: "AI",
    icon: <RefreshCw size={18} className="text-primary" />,
  },
  {
    title: "Continue Writing",
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "ai",
        props: { action: "continue_writing", status: "input" },
      } as any);
    },
    aliases: ["continue", "more"],
    group: "AI",
    icon: <ChevronRight size={18} className="text-primary" />,
  },
];
