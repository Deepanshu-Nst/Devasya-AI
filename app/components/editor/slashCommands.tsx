import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { DatabaseBlock } from "./blocks/DatabaseBlock";

// 1. Extend the default schema with our custom blocks
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // database_view: DatabaseBlock,
  },
});

// 2. Define custom slash commands
export const getCustomSlashMenuItems = (editor: typeof schema.BlockNoteEditor) => [
  ...getDefaultReactSlashMenuItems(editor),
  /*
  {
    title: "Task Kanban",
    onItemClick: () => {
      editor.insertBlocks([
        {
          type: "database_view",
          props: {
            entity_type: "task",
            view_type: "kanban",
            status_options: "Todo,In Progress,Done"
          }
        }
      ], editor.getTextCursorPosition().block, "after");
    },
    aliases: ["database", "board", "tasks", "kanban"],
    group: "Databases",
    icon: <span className="text-lg">📋</span>,
    subtext: "Insert a Kanban board for tasks.",
  },
  */
];
