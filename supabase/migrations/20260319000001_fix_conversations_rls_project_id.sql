-- Fix: Allow project owners to view conversations linked via project_id (generic link conversations)
DROP POLICY "Users can view own conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (
    pitch_link_id IN (
      SELECT pl.id FROM public.pitch_links pl
      JOIN public.projects p ON pl.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );
