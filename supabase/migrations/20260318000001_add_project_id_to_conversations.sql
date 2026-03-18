-- Allow conversations to be linked directly to a project (generic pitch link)
-- instead of requiring a pitch_link row

-- Make pitch_link_id nullable
ALTER TABLE public.conversations
  ALTER COLUMN pitch_link_id DROP NOT NULL;

-- Add project_id for generic-link conversations
ALTER TABLE public.conversations
  ADD COLUMN project_id uuid references public.projects(id) on delete cascade;

-- Ensure at least one of pitch_link_id or project_id is always set
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_requires_link_or_project
  CHECK (pitch_link_id IS NOT NULL OR project_id IS NOT NULL);

-- Index for analytics queries by project
CREATE INDEX conversations_project_id_idx ON public.conversations(project_id);
