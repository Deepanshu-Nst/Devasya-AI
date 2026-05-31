import { createBlockSpec, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

const mySpec = createBlockSpec({
  type: "my_block",
  propSchema: {},
  content: "none"
});

console.log("has node?", mySpec.node !== undefined);

try {
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      my_block: mySpec
    }
  });
  console.log("Schema created successfully!");
} catch (e) {
  console.error("Crash", e);
}
