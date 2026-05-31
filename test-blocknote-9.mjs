import { createReactBlockSpec } from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

const DatabaseBlock = createReactBlockSpec({
  type: "database_view",
  propSchema: { entity_type: { default: "task" } },
  content: "none"
}, { render: () => null });

try {
  const spec = DatabaseBlock(); // CALLING IT!
  console.log("Spec created successfully! Has node?", spec.node !== undefined);
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      database_view: spec
    }
  });
  console.log("Schema created successfully!");
} catch (e) {
  console.error("Crash", e);
}
