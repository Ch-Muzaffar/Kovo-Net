-- ═══════════════════════════════════════════════════════════════════════
-- Kovo-Net Database Schema
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. User Profiles (Supabase Auth handles credentials) ───
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    country       TEXT NOT NULL,
    city          TEXT NOT NULL,
    profession    TEXT NOT NULL,
    user_type     TEXT NOT NULL CHECK (user_type IN ('student', 'professional')),
    avatar_url    TEXT,
    bio           TEXT DEFAULT '',
    departments   TEXT[] DEFAULT '{}',
    hobbies       TEXT[] DEFAULT '{}',
    master_skills TEXT[] DEFAULT '{}',
    is_profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
    tos_accepted  BOOLEAN NOT NULL DEFAULT FALSE,
    tos_accepted_at TIMESTAMPTZ,
    banned        BOOLEAN NOT NULL DEFAULT FALSE,
    banned_at     TIMESTAMPTZ,
    banned_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_complete ON public.user_profiles(is_profile_complete);
CREATE INDEX idx_user_profiles_departments ON public.user_profiles USING GIN(departments);
CREATE INDEX idx_user_profiles_hobbies ON public.user_profiles USING GIN(hobbies);
CREATE INDEX idx_user_profiles_skills ON public.user_profiles USING GIN(master_skills);
CREATE INDEX idx_user_profiles_type ON public.user_profiles(user_type);

-- ─── 2. Posts ───
CREATE TABLE IF NOT EXISTS public.posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_hidden ON public.posts(is_hidden) WHERE is_hidden = FALSE;
CREATE INDEX idx_posts_report_count ON public.posts(report_count) WHERE report_count > 0;

-- ─── 3. Post Tags (for targeted feed matching) ───
CREATE TABLE IF NOT EXISTS public.post_tags (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id   UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_type  TEXT NOT NULL CHECK (tag_type IN ('department', 'profession', 'user', 'skill', 'hobby', 'topic')),
    tag_value TEXT NOT NULL
);

CREATE INDEX idx_post_tags_type_value ON public.post_tags(tag_type, tag_value);
CREATE INDEX idx_post_tags_post_id ON public.post_tags(post_id);

-- ─── 4. Comments ───
CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON public.comments(post_id, created_at);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

-- ─── 5. Direct Messages ───
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id     UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dm_no_self CHECK (sender_id != receiver_id)
);

CREATE INDEX idx_dm_sender ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX idx_dm_receiver ON public.direct_messages(receiver_id, created_at DESC);
CREATE INDEX idx_dm_conversation ON public.direct_messages(
    LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC
);

-- ─── 6. Ledger Transactions (Immutable gamification records) ───
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id         UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    comment_id      UUID REFERENCES public.comments(id) ON DELETE SET NULL,
    action_type     TEXT NOT NULL CHECK (action_type IN ('helpful_comment', 'helpful_idea', 'bonus')),
    base_points     INTEGER NOT NULL,
    penalty_rate    NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    points_awarded  INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_target ON public.ledger_transactions(target_user_id, created_at DESC);
CREATE INDEX idx_ledger_source ON public.ledger_transactions(source_user_id);
CREATE INDEX idx_ledger_post ON public.ledger_transactions(post_id);
CREATE INDEX idx_ledger_comment ON public.ledger_transactions(comment_id);

-- Prevent duplicate helpful marks on same comment by same user
CREATE UNIQUE INDEX idx_ledger_no_dup_helpful
    ON public.ledger_transactions(comment_id, source_user_id)
    WHERE action_type = 'helpful_comment';

-- ─── 7. User Points Aggregate (denormalized for fast reads) ───
CREATE TABLE IF NOT EXISTS public.user_points (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    level        INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. Reports ───
CREATE TABLE IF NOT EXISTS public.reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'dm')),
    target_id    UUID NOT NULL,
    reason       TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'disturbing')),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    resolved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_reports_target ON public.reports(target_type, target_id, status);
CREATE INDEX idx_reports_pending ON public.reports(status) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_reports_no_dup ON public.reports(reporter_id, target_type, target_id);

-- ─── 9. Notifications ───
CREATE TABLE IF NOT EXISTS public.notifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type           TEXT NOT NULL,
    title          TEXT NOT NULL,
    body           TEXT NOT NULL DEFAULT '',
    reference_type TEXT,
    reference_id   UUID,
    is_read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- ─── 10. Connections (Friendships) ───
CREATE TABLE IF NOT EXISTS public.connections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conn_no_self CHECK (sender_id != receiver_id),
    CONSTRAINT conn_unique_pair UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_connections_sender ON public.connections(sender_id, status);
CREATE INDEX idx_connections_receiver ON public.connections(receiver_id, status);

-- ─── 11. Refresh Token Blacklist (for logout) ───
CREATE TABLE IF NOT EXISTS public.token_blacklist (
    jti            TEXT PRIMARY KEY,
    exp            TIMESTAMPTZ NOT NULL,
    blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_blacklist_exp ON public.token_blacklist(exp);

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_blacklist    ENABLE ROW LEVEL SECURITY;

-- User profiles: anyone can read, only owner can write
CREATE POLICY "profiles_select" ON public.user_profiles
    FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts: anyone reads non-hidden, only author writes
CREATE POLICY "posts_select" ON public.posts
    FOR SELECT USING (is_hidden = FALSE OR auth.uid() = user_id);
CREATE POLICY "posts_insert" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON public.posts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.posts
    FOR DELETE USING (auth.uid() = user_id);

-- Post tags: read all, write only if you own the post
CREATE POLICY "tags_select" ON public.post_tags FOR SELECT USING (true);
CREATE POLICY "tags_insert" ON public.post_tags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid())
);
CREATE POLICY "tags_delete" ON public.post_tags FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid())
);

-- Comments: read non-hidden, author writes
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (
    is_hidden = FALSE
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid())
);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid())
);

-- DMs: only sender or receiver can read/write
CREATE POLICY "dm_select" ON public.direct_messages
    FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "dm_insert" ON public.direct_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Ledger: users read own, system writes
CREATE POLICY "ledger_select" ON public.ledger_transactions
    FOR SELECT USING (auth.uid() IN (target_user_id, source_user_id));

-- User points: users read own
CREATE POLICY "points_select" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

-- Reports: users read own and insert own; admins read all via service role
CREATE POLICY "reports_select" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Notifications: only target user reads/updates
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Connections: only sender or receiver can select/update/delete; only sender can insert
CREATE POLICY "connections_select" ON public.connections FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "connections_insert" ON public.connections FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "connections_update" ON public.connections FOR UPDATE USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "connections_delete" ON public.connections FOR DELETE USING (auth.uid() IN (sender_id, receiver_id));

-- Token blacklist: no direct RLS access (service role only)
CREATE POLICY "blacklist_select" ON public.token_blacklist FOR SELECT USING (false);
CREATE POLICY "blacklist_insert" ON public.token_blacklist FOR INSERT WITH CHECK (false);

-- ═══════════════════════════════════════════════════════════════════════
-- Helper Functions & Triggers
-- ═══════════════════════════════════════════════════════════════════════

-- Auto-hide content when report count reaches threshold
CREATE OR REPLACE FUNCTION public.check_report_threshold()
RETURNS TRIGGER AS $$ DECLARE
    threshold INTEGER := 3;
BEGIN
    IF NEW.report_count >= threshold AND NEW.is_hidden = FALSE THEN
        NEW.is_hidden := TRUE;
    END IF;
    RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_report_check
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.check_report_threshold();

CREATE TRIGGER trg_comments_report_check
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.check_report_threshold();

CREATE TRIGGER trg_dm_report_check
    BEFORE UPDATE ON public.direct_messages
    FOR EACH ROW EXECUTE FUNCTION public.check_report_threshold();

COMMIT;
