CREATE SEQUENCE public.member_code_seq START 1;
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code integer NOT NULL UNIQUE DEFAULT nextval('public.member_code_seq'),
  name text NOT NULL,
  phone text,
  pledged bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.member_code_seq OWNED BY public.members.code;
GRANT USAGE, SELECT ON SEQUENCE public.member_code_seq TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO anon, authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open members" ON public.members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.member_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  note text,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_payments TO anon, authenticated;
GRANT ALL ON public.member_payments TO service_role;
ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open payments" ON public.member_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);