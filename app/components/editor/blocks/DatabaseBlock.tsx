import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import KanbanView from "./KanbanView";

// We define the block schema using createReactBlockSpec
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
    render: (props) => {
      // The render function defines what is displayed in the editor
      return (
        <div contentEditable={false} className="w-full my-4 select-none">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">📋</span> 
                {props.block.props.entity_type === 'task' ? 'Tasks' : 'Database'}
              </h2>
              <div className="text-xs text-white/40 uppercase tracking-wider bg-black/40 px-2 py-1 rounded">
                {props.block.props.view_type} View
              </div>
            </div>
            
            {props.block.props.view_type === 'kanban' && (
              <KanbanView 
                entityType={props.block.props.entity_type} 
                statusOptions={props.block.props.status_options} 
              />
            )}
            
            {props.block.props.view_type !== 'kanban' && (
              <div className="p-8 text-center text-white/50">
                {props.block.props.view_type} view is not yet implemented.
              </div>
            )}
          </div>
        </div>
      );
    },
  }
);
