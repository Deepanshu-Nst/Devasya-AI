import React, { useState, useEffect, useRef } from 'react';
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { aiApi, tasksApi } from '@/lib/api-client';
import { Sparkles, Loader2, X, Check, RefreshCw } from 'lucide-react';

export const AiBlock = createReactBlockSpec(
  {
    type: "ai",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      action: {
        default: "custom",
      },
      prompt: {
        default: "",
      },
      status: {
        default: "input", // input, generating, done, error
      },
      generatedText: {
        default: "",
      }
    },
    content: "none",
  },
  {
    render: (props) => {
      const [promptInput, setPromptInput] = useState(props.block.props.prompt);
      const [status, setStatus] = useState(props.block.props.status);
      const [streamedText, setStreamedText] = useState(props.block.props.generatedText);
      const [error, setError] = useState("");
      const abortControllerRef = useRef<AbortController | null>(null);

      // Focus input on mount if status is input
      const inputRef = useRef<HTMLInputElement>(null);
      useEffect(() => {
        if (status === "input" && inputRef.current) {
          inputRef.current.focus();
        }
      }, [status]);

      const startGeneration = async (overridePrompt?: string) => {
        const finalPrompt = overridePrompt ?? promptInput;
        setStatus("generating");
        setStreamedText("");
        setError("");
        
        props.editor.updateBlock(props.block, {
          props: { ...props.block.props, status: "generating", prompt: finalPrompt }
        });

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
          // Gather context (simple nearby blocks for now)
          // To be safe, just grab the block before this one
          const prevBlock = props.editor.getTextCursorPosition().block; // Not always reliable if async
          // Better: get some surrounding blocks
          const allBlocks = props.editor.document;
          const blockIdx = allBlocks.findIndex(b => b.id === props.block.id);
          const startIdx = Math.max(0, blockIdx - 5);
          const contextBlocks = allBlocks.slice(startIdx, blockIdx)
            .map(b => (b.content as any)?.map?.((c: any) => c.text).join(" ") || "")
            .filter(t => t.trim().length > 0);

          let currentText = "";
          await aiApi.inlineGenerate(
            { 
              action: props.block.props.action, 
              prompt: finalPrompt,
              context_blocks: contextBlocks 
            },
            (chunk) => {
              currentText += chunk;
              setStreamedText(currentText);
            },
            abortController.signal
          );
          
          setStatus("done");
          
          // ATOMIC INSERTION:
          if (props.block.props.action === "extract_tasks") {
            try {
              // Parse the JSON block
              const match = currentText.match(/\{[\s\S]*\}/);
              const jsonStr = match ? match[0] : currentText;
              const parsed = JSON.parse(jsonStr);
              const tasks = parsed.tasks || [];
              
              if (tasks.length === 0) throw new Error("No tasks found");
              
              const newBlocks: any[] = [];
              for (const task of tasks) {
                // Create backend task
                const res = await tasksApi.create({
                  title: task.title || "Untitled Task",
                  status: task.status || "Todo",
                  priority: task.priority || "medium",
                  content: [{ type: "paragraph", content: "Extracted via AI from document context." }]
                });
                
                // Add a visual block
                newBlocks.push({
                  type: "paragraph",
                  content: `✅ Task Created: ${task.title} (${task.priority})`,
                  props: { textColor: "blue", generated_by_ai: true }
                });
              }
              
              props.editor.replaceBlocks([props.block], newBlocks);
            } catch (e) {
              console.error("Failed to parse AI tasks output", e);
              props.editor.replaceBlocks([props.block], [{
                type: "paragraph",
                content: "Failed to extract tasks. Output was: " + currentText
              }] as any);
            }
          } else {
            // Standard markdown conversion for text
            try {
              const blocks = await props.editor.tryParseMarkdownToBlocks(currentText);
              // Add metadata
              blocks.forEach(b => {
                b.props = { 
                  ...b.props, 
                  generated_by_ai: true,
                  model_used: "groq-llama3"
                } as any;
              });
              
              // Replace this AI block with the generated blocks
              props.editor.replaceBlocks([props.block], blocks);
            } catch (e) {
              console.error("Failed to parse AI output to blocks", e);
              // fallback: insert raw text
              props.editor.replaceBlocks([props.block], [{
                type: "paragraph",
                content: currentText,
                props: { generated_by_ai: true }
              }] as any);
            }
          }

        } catch (err: any) {
          if (err.name === 'AbortError') {
            setStatus("input");
          } else {
            setStatus("error");
            setError(err.message || "Failed to generate");
          }
        }
      };

      // Auto-start if action is not custom
      useEffect(() => {
        if (props.block.props.action !== "custom" && props.block.props.status === "input") {
          startGeneration("");
        }
      }, []);

      const handleCancel = () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (status === "input") {
          props.editor.removeBlocks([props.block]);
        }
      };

      return (
        <div className="w-full my-4 rounded-xl border border-primary/20 bg-primary/5 shadow-lg overflow-hidden flex flex-col font-sans" contentEditable={false}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/10">
            <div className="flex items-center gap-2 text-primary text-sm font-semibold">
              <Sparkles size={14} className={status === "generating" ? "animate-pulse" : ""} />
              {props.block.props.action === "custom" ? "AI Assistant" : `AI Action: ${props.block.props.action}`}
            </div>
            <div className="flex gap-1">
              {status === "generating" && (
                <button onClick={handleCancel} className="p-1 hover:bg-black/10 rounded-md text-primary/70 transition-colors" title="Cancel">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4">
            {status === "input" && props.block.props.action === "custom" && (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && promptInput.trim()) {
                      startGeneration();
                    }
                    if (e.key === 'Escape') {
                      handleCancel();
                    }
                  }}
                  placeholder="Ask AI to write, rewrite, or summarize..."
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-white"
                />
                <button
                  onClick={() => promptInput.trim() && startGeneration()}
                  disabled={!promptInput.trim()}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Generate
                </button>
              </div>
            )}

            {status === "generating" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-primary/80 font-medium">
                  <Loader2 size={14} className="animate-spin" /> Generating...
                </div>
                {streamedText && (
                  <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed opacity-80 border-l-2 border-primary/30 pl-3">
                    {streamedText}
                  </div>
                )}
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-destructive font-medium flex items-center gap-2">
                  <X size={14} /> Error: {error}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => startGeneration()} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/20 transition-colors">
                    <RefreshCw size={12} /> Retry
                  </button>
                  <button onClick={() => props.editor.removeBlocks([props.block])} className="text-xs text-white/50 hover:text-white transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  }
);
