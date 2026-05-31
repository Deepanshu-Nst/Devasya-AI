import { createReactBlockSpec } from "@blocknote/react";

console.log("Keys:", Object.keys(createReactBlockSpec({
  type: "database_view",
  propSchema: {},
  content: "none"
}, { render: () => null })));
