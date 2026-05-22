-- Phone-based blacklist foundation for EXPEER.
-- Apply in Supabase Dashboard SQL Editor for the active EXPEER project.
-- Safe to rerun.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.phone_blacklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash text NOT NULL UNIQUE,
  phone_last4 text,
  reason text,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_blacklist_entries_hash
  ON public.phone_blacklist_entries(phone_hash)
  WHERE is_active = true;

ALTER TABLE public.phone_blacklist_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage phone blacklist" ON public.phone_blacklist_entries;
CREATE POLICY "Admins manage phone blacklist"
  ON public.phone_blacklist_entries
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.phone_hash(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(public.normalize_phone(_phone)::bytea, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.is_phone_blacklisted(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.phone_blacklist_entries b
    WHERE b.is_active = true
      AND b.phone_hash = public.phone_hash(_phone)
      AND public.normalize_phone(_phone) <> ''
  );
$$;

CREATE OR REPLACE FUNCTION public.add_phone_blacklist_entry(
  _phone text,
  _reason text DEFAULT NULL,
  _source text DEFAULT 'manual'
)
RETURNS public.phone_blacklist_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := public.normalize_phone(_phone);
  _row public.phone_blacklist_entries;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF _normalized = '' THEN
    RAISE EXCEPTION 'phone number required';
  END IF;

  INSERT INTO public.phone_blacklist_entries (
    phone_hash,
    phone_last4,
    reason,
    source,
    is_active,
    created_by,
    updated_at
  )
  VALUES (
    public.phone_hash(_normalized),
    right(_normalized, 4),
    NULLIF(trim(coalesce(_reason, '')), ''),
    NULLIF(trim(coalesce(_source, 'manual')), ''),
    true,
    auth.uid(),
    now()
  )
  ON CONFLICT (phone_hash) DO UPDATE SET
    phone_last4 = EXCLUDED.phone_last4,
    reason = EXCLUDED.reason,
    source = EXCLUDED.source,
    is_active = true,
    updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trade_approval_status(_user_id uuid)
RETURNS TABLE (
  ok boolean,
  code text,
  phone_last4 text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.normalize_phone(p.phone) = '' THEN false
      WHEN public.is_phone_blacklisted(p.phone) THEN false
      WHEN p.is_suspended OR p.kyc_status = 'rejected' THEN false
      ELSE true
    END AS ok,
    CASE
      WHEN public.normalize_phone(p.phone) = '' THEN 'phone_required'
      WHEN public.is_phone_blacklisted(p.phone) THEN 'phone_blacklisted'
      WHEN p.is_suspended OR p.kyc_status = 'rejected' THEN 'account_blocked'
      ELSE 'approved'
    END AS code,
    right(public.normalize_phone(p.phone), 4) AS phone_last4
  FROM public.profiles p
  WHERE p.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    public.normalize_phone(NEW.raw_user_meta_data->>'phone')
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    nickname = COALESCE(public.profiles.nickname, EXCLUDED.nickname);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phone_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_phone_blacklisted(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_phone_blacklist_entry(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trade_approval_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_phone_blacklist_entry(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_approval_status(uuid) TO authenticated;
