-- Migrate document_chunks from memory_id to block_id

-- 1. Add block_id column
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE;

-- 2. Migrate existing memory_ids to block_ids
UPDATE public.document_chunks
SET block_id = memory_id
WHERE memory_id IS NOT NULL;

-- 3. Drop RLS policies that depend on memory_id
DROP POLICY IF EXISTS "Users can view document chunks in their workspaces" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can create document chunks in their workspaces" ON public.document_chunks;

-- 4. Drop old column
ALTER TABLE public.document_chunks DROP COLUMN memory_id;

-- 5. Recreate RLS policies using block_id
CREATE POLICY "Users can view document chunks in their workspaces" 
ON public.document_chunks FOR SELECT 
USING (
  document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())) OR
  block_id IN (SELECT id FROM public.blocks WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
);

CREATE POLICY "Users can create document chunks in their workspaces" 
ON public.document_chunks FOR INSERT 
WITH CHECK (
  document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())) OR
  block_id IN (SELECT id FROM public.blocks WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
);

-- 6. Create index
CREATE INDEX IF NOT EXISTS document_chunks_block_id_idx ON public.document_chunks(block_id);
