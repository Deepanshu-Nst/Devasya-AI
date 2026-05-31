import { createReactBlockSpec } from "@blocknote/react";
import { createBlockSpec } from "@blocknote/core";

const mySpec = createBlockSpec({
  type: "my_block",
  propSchema: {},
  content: "none"
});

console.log("Keys of mySpec:", Object.keys(mySpec));
console.log("has node?", "node" in mySpec);
