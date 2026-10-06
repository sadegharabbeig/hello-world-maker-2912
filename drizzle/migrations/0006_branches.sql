CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.my_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "branches read" ON public.branches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR id = public.my_branch(auth.uid()));
CREATE POLICY "branches owner write" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.branches (name) VALUES ('شعبه ۱');

ALTER TABLE public.members ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT public.my_branch(auth.uid());
ALTER TABLE public.transactions ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT public.my_branch(auth.uid());
UPDATE public.members SET branch_id = (SELECT id FROM public.branches WHERE name = 'شعبه ۱') WHERE branch_id IS NULL;
UPDATE public.transactions SET branch_id = (SELECT id FROM public.branches WHERE name = 'شعبه ۱') WHERE branch_id IS NULL;
ALTER TABLE public.members ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX members_branch_idx ON public.members(branch_id);

DROP POLICY IF EXISTS "members read" ON public.members;
DROP POLICY IF EXISTS "members write" ON public.members;
CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated
  USING (branch_id = public.my_branch(auth.uid()));
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated
  USING (branch_id = public.my_branch(auth.uid()) AND public.can_edit(auth.uid()))
  WITH CHECK (branch_id = public.my_branch(auth.uid()) AND public.can_edit(auth.uid()));

DROP POLICY IF EXISTS "payments read" ON public.member_payments;
DROP POLICY IF EXISTS "payments write" ON public.member_payments;
CREATE POLICY "payments read" ON public.member_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.branch_id = public.my_branch(auth.uid())));
CREATE POLICY "payments write" ON public.member_payments FOR ALL TO authenticated
  USING (public.can_edit(auth.uid()) AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.branch_id = public.my_branch(auth.uid())))
  WITH CHECK (public.can_edit(auth.uid()) AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.branch_id = public.my_branch(auth.uid())));

DROP POLICY IF EXISTS "tx read" ON public.transactions;
DROP POLICY IF EXISTS "tx write" ON public.transactions;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated
  USING (branch_id = public.my_branch(auth.uid()));
CREATE POLICY "tx write" ON public.transactions FOR ALL TO authenticated
  USING (branch_id = public.my_branch(auth.uid()) AND public.can_edit(auth.uid()))
  WITH CHECK (branch_id = public.my_branch(auth.uid()) AND public.can_edit(auth.uid()));

DROP POLICY IF EXISTS "files read" ON storage.objects;
DROP POLICY IF EXISTS "files insert" ON storage.objects;
DROP POLICY IF EXISTS "files update" ON storage.objects;
CREATE POLICY "files read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id IN ('backups','receipts') AND (
    (storage.foldername(name))[1] = public.my_branch(auth.uid())::text
    OR (bucket_id = 'receipts' AND EXISTS (
      SELECT 1 FROM public.member_payments p JOIN public.members m ON m.id = p.member_id
      WHERE p.receipt_url = storage.objects.name AND m.branch_id = public.my_branch(auth.uid())))
  ));
CREATE POLICY "files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid())
  AND (storage.foldername(name))[1] = public.my_branch(auth.uid())::text);
CREATE POLICY "files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid()) AND (storage.foldername(name))[1] = public.my_branch(auth.uid())::text)
  WITH CHECK (bucket_id IN ('backups','receipts') AND public.can_edit(auth.uid()) AND (storage.foldername(name))[1] = public.my_branch(auth.uid())::text);