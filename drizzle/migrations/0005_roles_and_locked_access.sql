CREATE TYPE public.app_role AS ENUM ('admin','editor','viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;

CREATE POLICY "own role or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "open members" ON public.members;
DROP POLICY IF EXISTS "open payments" ON public.member_payments;
DROP POLICY IF EXISTS "Anon full access" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated full access" ON public.transactions;
REVOKE ALL ON public.members, public.member_payments, public.transactions FROM anon;

CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "payments read" ON public.member_payments FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "payments write" ON public.member_payments FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "tx write" ON public.transactions FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));

DROP POLICY IF EXISTS "backups open read" ON storage.objects;
DROP POLICY IF EXISTS "backups open insert" ON storage.objects;
DROP POLICY IF EXISTS "backups open update" ON storage.objects;
DROP POLICY IF EXISTS "receipts read" ON storage.objects;
DROP POLICY IF EXISTS "receipts insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts update" ON storage.objects;
CREATE POLICY "files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('backups','receipts') AND public.has_any_role(auth.uid()));
CREATE POLICY "files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid()));
CREATE POLICY "files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid()))
  WITH CHECK (bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid()));