-- 05_tasks_schema.sql
-- Creates the tasks table as structured metadata linked to blocks

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Todo',
    priority TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    position FLOAT NOT NULL DEFAULT 0,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for efficient Kanban querying and ordering
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON public.tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_block_id ON public.tasks(block_id);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks in their workspaces
DROP POLICY IF EXISTS "Users can view tasks in their workspaces" ON public.tasks;
CREATE POLICY "Users can view tasks in their workspaces" 
ON public.tasks FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- Policy: Users can create tasks in their workspaces
DROP POLICY IF EXISTS "Users can create tasks in their workspaces" ON public.tasks;
CREATE POLICY "Users can create tasks in their workspaces" 
ON public.tasks FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- Policy: Users can update tasks in their workspaces
DROP POLICY IF EXISTS "Users can update tasks in their workspaces" ON public.tasks;
CREATE POLICY "Users can update tasks in their workspaces" 
ON public.tasks FOR UPDATE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- Policy: Users can delete tasks in their workspaces
DROP POLICY IF EXISTS "Users can delete tasks in their workspaces" ON public.tasks;
CREATE POLICY "Users can delete tasks in their workspaces" 
ON public.tasks FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at_column();
