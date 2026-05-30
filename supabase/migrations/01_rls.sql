-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Workspaces RLS
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspaces;
CREATE POLICY "Users can view their workspaces" 
ON public.workspaces FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create their workspaces" ON public.workspaces;
CREATE POLICY "Users can create their workspaces" 
ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their workspaces" ON public.workspaces;
CREATE POLICY "Users can update their workspaces" 
ON public.workspaces FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their workspaces" ON public.workspaces;
CREATE POLICY "Users can delete their workspaces" 
ON public.workspaces FOR DELETE USING (auth.uid() = owner_id);

-- 3. Memory Pages RLS
DROP POLICY IF EXISTS "Users can view memory pages in their workspaces" ON public.memory_pages;
CREATE POLICY "Users can view memory pages in their workspaces" 
ON public.memory_pages FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create memory pages in their workspaces" ON public.memory_pages;
CREATE POLICY "Users can create memory pages in their workspaces" 
ON public.memory_pages FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update memory pages in their workspaces" ON public.memory_pages;
CREATE POLICY "Users can update memory pages in their workspaces" 
ON public.memory_pages FOR UPDATE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete memory pages in their workspaces" ON public.memory_pages;
CREATE POLICY "Users can delete memory pages in their workspaces" 
ON public.memory_pages FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- 4. Documents RLS
DROP POLICY IF EXISTS "Users can view documents in their workspaces" ON public.documents;
CREATE POLICY "Users can view documents in their workspaces" 
ON public.documents FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can upload documents to their workspaces" ON public.documents;
CREATE POLICY "Users can upload documents to their workspaces" 
ON public.documents FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete documents in their workspaces" ON public.documents;
CREATE POLICY "Users can delete documents in their workspaces" 
ON public.documents FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- 5. Document Chunks RLS
DROP POLICY IF EXISTS "Users can view document chunks in their workspaces" ON public.document_chunks;
CREATE POLICY "Users can view document chunks in their workspaces" 
ON public.document_chunks FOR SELECT 
USING (
  document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())) OR
  memory_id IN (SELECT id FROM public.memory_pages WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can create document chunks in their workspaces" ON public.document_chunks;
CREATE POLICY "Users can create document chunks in their workspaces" 
ON public.document_chunks FOR INSERT 
WITH CHECK (
  document_id IN (SELECT id FROM public.documents WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())) OR
  memory_id IN (SELECT id FROM public.memory_pages WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()))
);

-- 6. Chat Sessions RLS
DROP POLICY IF EXISTS "Users can view chat sessions in their workspaces" ON public.chat_sessions;
CREATE POLICY "Users can view chat sessions in their workspaces" 
ON public.chat_sessions FOR SELECT 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create chat sessions in their workspaces" ON public.chat_sessions;
CREATE POLICY "Users can create chat sessions in their workspaces" 
ON public.chat_sessions FOR INSERT 
WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete chat sessions in their workspaces" ON public.chat_sessions;
CREATE POLICY "Users can delete chat sessions in their workspaces" 
ON public.chat_sessions FOR DELETE 
USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- 7. Chat Messages RLS
DROP POLICY IF EXISTS "Users can view chat messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can view chat messages in their sessions" 
ON public.chat_messages FOR SELECT 
USING (session_id IN (SELECT id FROM public.chat_sessions WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())));

DROP POLICY IF EXISTS "Users can create chat messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can create chat messages in their sessions" 
ON public.chat_messages FOR INSERT 
WITH CHECK (session_id IN (SELECT id FROM public.chat_sessions WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())));

-- Storage Bucket Policies
-- documents
DROP POLICY IF EXISTS "Users can view their workspace documents" ON storage.objects;
CREATE POLICY "Users can view their workspace documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Users can upload their workspace documents" ON storage.objects;
CREATE POLICY "Users can upload their workspace documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Users can delete their workspace documents" ON storage.objects;
CREATE POLICY "Users can delete their workspace documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

-- memory-assets
DROP POLICY IF EXISTS "Users can view their memory assets" ON storage.objects;
CREATE POLICY "Users can view their memory assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'memory-assets' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Users can upload their memory assets" ON storage.objects;
CREATE POLICY "Users can upload their memory assets" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'memory-assets' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Users can delete their memory assets" ON storage.objects;
CREATE POLICY "Users can delete their memory assets" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'memory-assets' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

-- avatars
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
