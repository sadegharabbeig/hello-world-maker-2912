CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  note TEXT,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access" ON public.transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_transactions_occurred_at ON public.transactions (occurred_at DESC);