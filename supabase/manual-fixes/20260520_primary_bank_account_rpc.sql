-- Allow an order counterparty to resolve the other party's primary bank account id
-- without exposing bank account rows broadly via SELECT policies.
CREATE OR REPLACE FUNCTION public.get_primary_bank_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.bank_accounts
  WHERE user_id = _user_id
  ORDER BY is_primary DESC, created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_primary_bank_account_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_primary_bank_account_id(uuid) TO authenticated;
