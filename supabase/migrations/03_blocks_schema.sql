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

-- 2. Add RLS
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocks in their workspaces" 
ON public.blocks FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Users can create blocks in their workspaces" 
ON public.blocks FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update blocks in their workspaces" 
ON public.blocks FOR UPDATE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete blocks in their workspaces" 
ON public.blocks FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- 3. Auto-convert existing memory_pages to blocks
-- First, insert all memory pages as 'page' blocks
INSERT INTO public.blocks (id, workspace_id, type, properties, created_by, created_at, updated_at)
SELECT 
    id, 
    workspace_id, 
    'page', 
    jsonb_build_object('title', title, 'visibility', visibility), 
    created_by, 
    created_at, 
    updated_at
FROM public.memory_pages
ON CONFLICT (id) DO NOTHING;

-- Then, insert the content of those memory pages as child 'paragraph' blocks
INSERT INTO public.blocks (workspace_id, parent_id, type, content, position, created_by, created_at, updated_at)
SELECT 
    workspace_id, 
    id AS parent_id, 
    'paragraph', 
    content, 
    1.0 AS position, 
    created_by, 
    created_at, 
    updated_at
FROM public.memory_pages
WHERE content IS NOT NULL AND content != '';
