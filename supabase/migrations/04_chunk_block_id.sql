-- Migrate document_chunks from memory_id to block_id

-- 1. Add block_id column
ALTER TABLE public.document_chunks ADD COLUMN block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE;

-- 2. Migrate existing memory_ids to block_ids (since block ids are identical to old memory_ids for the pages)
UPDATE public.document_chunks
SET block_id = memory_id
WHERE memory_id IS NOT NULL;

-- 3. Drop old column
ALTER TABLE public.document_chunks DROP COLUMN memory_id;

-- 4. Create index
CREATE INDEX IF NOT EXISTS document_chunks_block_id_idx ON public.document_chunks(block_id);
