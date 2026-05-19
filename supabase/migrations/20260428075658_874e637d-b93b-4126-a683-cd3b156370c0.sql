ALTER TABLE public.messages REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_messages_order_created ON public.messages(order_id, created_at);