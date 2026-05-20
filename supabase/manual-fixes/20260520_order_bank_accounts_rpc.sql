-- Allow order participants to read only the bank account details linked to their order.
-- This avoids broad bank_accounts SELECT exposure while still showing payment instructions.
CREATE OR REPLACE FUNCTION public.get_order_bank_accounts(_order_id uuid)
RETURNS TABLE (
  role text,
  bank_name text,
  account_number text,
  account_holder text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'seller'::text AS role, ba.bank_name, ba.account_number, ba.account_holder
  FROM public.orders o
  JOIN public.bank_accounts ba ON ba.id = o.seller_bank_account_id
  WHERE o.id = _order_id
    AND auth.uid() IN (o.buyer_id, o.seller_id)

  UNION ALL

  SELECT 'buyer'::text AS role, ba.bank_name, ba.account_number, ba.account_holder
  FROM public.orders o
  JOIN public.bank_accounts ba ON ba.id = o.buyer_bank_account_id
  WHERE o.id = _order_id
    AND auth.uid() IN (o.buyer_id, o.seller_id);
$$;

REVOKE ALL ON FUNCTION public.get_order_bank_accounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_bank_accounts(uuid) TO authenticated;
