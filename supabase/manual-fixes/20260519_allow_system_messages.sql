-- Allow DB-generated/system messages inside valid orders.
-- Existing client-side text messages still require sender_id = auth.uid().
DROP POLICY IF EXISTS "Order parties send messages" ON public.messages;

CREATE POLICY "Order parties send messages" ON public.messages
  FOR INSERT WITH CHECK (
    (
      auth.uid() = sender_id
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
      )
    )
    OR
    (
      sender_id IS NULL
      AND type = 'system'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin'))
      )
    )
  );
