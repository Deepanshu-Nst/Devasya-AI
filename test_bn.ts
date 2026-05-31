import { createReactBlockSpec } from "@blocknote/react";
export const DatabaseBlock = createReactBlockSpec(
  {
    type: "database_view",
    propSchema: {
      entity_type: { default: "task" },
      view_type: { default: "kanban" },
      status_options: { default: "Todo,In Progress,Done" },
    },
    content: "none",
  },
  {
    render: (props) => null,
  }
);
