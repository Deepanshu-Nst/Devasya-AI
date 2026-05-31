-- 1. Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    position REAL DEFAULT 0.0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add block_id to document_chunks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='document_chunks' AND column_name='block_id'
    ) THEN
        ALTER TABLE public.document_chunks ADD COLUMN block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Drop memory_id from document_chunks (ignoring dependent policies safely)
-- First drop the policies that depend on memory_id
DROP POLICY IF EXISTS "Users can view document chunks in their workspaces" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can create document chunks in their workspaces" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can update document chunks in their workspaces" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete document chunks in their workspaces" ON public.document_chunks;

-- Now drop the column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='document_chunks' AND column_name='memory_id'
    ) THEN
        ALTER TABLE public.document_chunks DROP COLUMN memory_id CASCADE;
    END IF;
END $$;

-- 4. Recreate RLS policies for document_chunks based on document_id and block_id
CREATE POLICY "Users can view document chunks in their workspaces" 
ON public.document_chunks FOR SELECT 
USING (
    (document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())))
    OR
    (block_id IN (SELECT id FROM public.blocks WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())))
);

CREATE POLICY "Users can create document chunks in their workspaces" 
ON public.document_chunks FOR INSERT 
WITH CHECK (
    (document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())))
    OR
    (block_id IN (SELECT id FROM public.blocks WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())))
);

-- Add RLS for blocks
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view blocks in their workspaces" ON public.blocks;
CREATE POLICY "Users can view blocks in their workspaces" 
ON public.blocks FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create blocks in their workspaces" ON public.blocks;
CREATE POLICY "Users can create blocks in their workspaces" 
ON public.blocks FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update blocks in their workspaces" ON public.blocks;
CREATE POLICY "Users can update blocks in their workspaces" 
ON public.blocks FOR UPDATE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete blocks in their workspaces" ON public.blocks;
CREATE POLICY "Users can delete blocks in their workspaces" 
ON public.blocks FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));
