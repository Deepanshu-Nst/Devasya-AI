import { createReactBlockSpec } from "@blocknote/react";

const DatabaseBlock = createReactBlockSpec(
  {
    type: "database_view",
    propSchema: {
      entity_type: { default: "task" },
    },
    content: "none",
  },
  {
    render: () => null,
  }
);
console.log(Object.keys(DatabaseBlock));
