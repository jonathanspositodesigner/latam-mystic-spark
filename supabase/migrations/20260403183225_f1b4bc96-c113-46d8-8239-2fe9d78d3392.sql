
-- 1. Fix admin-artes storage: restrict write ops to admins only
DROP POLICY "Admin upload admin-artes" ON storage.objects;
DROP POLICY "Admin update admin-artes" ON storage.objects;
DROP POLICY "Admin delete admin-artes" ON storage.objects;

CREATE POLICY "Admin upload admin-artes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-artes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update admin-artes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-artes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete admin-artes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-artes' AND public.has_role(auth.uid(), 'admin'));

-- 2. Fix pack-covers storage: restrict write ops to admins only
DROP POLICY "Admin upload pack-covers" ON storage.objects;
DROP POLICY "Admin update pack-covers" ON storage.objects;
DROP POLICY "Admin delete pack-covers" ON storage.objects;

CREATE POLICY "Admin upload pack-covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update pack-covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete pack-covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'));

-- 3. Fix partner-artes storage: restrict to authenticated partners
DROP POLICY "Auth upload partner-artes" ON storage.objects;
DROP POLICY "Auth update partner-artes" ON storage.objects;
DROP POLICY "Auth delete partner-artes" ON storage.objects;

CREATE POLICY "Partner upload partner-artes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-artes' AND EXISTS (SELECT 1 FROM public.partners WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Partner update partner-artes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'partner-artes' AND EXISTS (SELECT 1 FROM public.partners WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Partner delete partner-artes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'partner-artes' AND EXISTS (SELECT 1 FROM public.partners WHERE user_id = auth.uid() AND is_active = true));

-- Also allow admins full access to partner-artes
CREATE POLICY "Admin manage partner-artes" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'partner-artes' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'partner-artes' AND public.has_role(auth.uid(), 'admin'));

-- 4. Fix partners table: add self-read policy
CREATE POLICY "Partners can read own record"
  ON public.partners
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
