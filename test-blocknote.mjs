import { createReactBlockSpec } from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

console.log("Imports succeeded");
try {
  const DatabaseBlock = createReactBlockSpec({
    type: "database_view",
    propSchema: {
      entity_type: { default: "task" },
    },
    content: "none"
  }, {
    render: () => null
  });

  console.log("DatabaseBlock created", typeof DatabaseBlock);
  
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      database_view: DatabaseBlock
    }
  });
  console.log("Schema created");
} catch(e) {
  console.error("CRASH", e);
}
