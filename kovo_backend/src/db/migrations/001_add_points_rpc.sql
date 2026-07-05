-- Atomic points increment to prevent race conditions
-- Run in Supabase SQL Editor AFTER schema.sql
CREATE OR REPLACE FUNCTION public.increment_points(p_user_id UUID, p_points INTEGER)
RETURNS VOID AS $$ DECLARE
    new_total INTEGER;
    new_level INTEGER;
BEGIN
    UPDATE public.user_points
    SET
        total_points = total_points + p_points,
        level        = GREATEST(1, ((total_points + p_points) / 100) + 1),
        updated_at   = now()
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.user_points (user_id, total_points, level)
        VALUES (p_user_id, p_points, GREATEST(1, (p_points / 100) + 1));
    END IF;
END;
 $$ LANGUAGE plpgsql;
