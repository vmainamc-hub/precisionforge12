-- PARITY SIGNALS (precision-parity published track record)
CREATE TABLE public.parity_signals (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC,
  entry_formula TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parity_signals TO authenticated;
GRANT ALL ON public.parity_signals TO service_role;
ALTER TABLE public.parity_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parity signals readable" ON public.parity_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "parity signals insertable" ON public.parity_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "parity signals updatable" ON public.parity_signals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);