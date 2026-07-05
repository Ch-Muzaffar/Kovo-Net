-- Migration: Create reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type  TEXT NOT NULL CHECK (target_type IN ('message', 'comment')),
    target_id    UUID NOT NULL,
    emoji        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_no_dup ON public.reactions(user_id, target_type, target_id);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Handle existing policy safety by dropping first if they exist (or use create policy)
DO $$
BEGIN
    DROP POLICY IF EXISTS reactions_select ON public.reactions;
    DROP POLICY IF EXISTS reactions_insert ON public.reactions;
    DROP POLICY IF EXISTS reactions_update ON public.reactions;
    DROP POLICY IF EXISTS reactions_delete ON public.reactions;
END $$;

CREATE POLICY reactions_select ON public.reactions FOR SELECT USING (true);
CREATE POLICY reactions_insert ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY reactions_update ON public.reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY reactions_delete ON public.reactions FOR DELETE USING (auth.uid() = user_id);
