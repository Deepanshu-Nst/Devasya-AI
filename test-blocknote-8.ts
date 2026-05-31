import { createReactBlockSpec } from "@blocknote/react";
const spec = createReactBlockSpec({ type: "test", propSchema: {}, content: "none" }, { render: () => null });
console.log(spec);
