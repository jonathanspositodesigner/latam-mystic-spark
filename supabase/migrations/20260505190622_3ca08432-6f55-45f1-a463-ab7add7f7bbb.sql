INSERT INTO storage.buckets (id, name, public) VALUES ('artes-cloudinary', 'artes-cloudinary', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Acesso público aos arquivos do Flyer Maker" ON storage.objects FOR SELECT USING (bucket_id = 'artes-cloudinary');
CREATE POLICY "Usuários podem fazer upload de seus próprios arquivos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'artes-cloudinary' AND auth.uid()::text = (storage.foldername(name))[2]);
CREATE POLICY "Usuários podem atualizar seus próprios arquivos" ON storage.objects FOR UPDATE USING (bucket_id = 'artes-cloudinary' AND auth.uid()::text = (storage.foldername(name))[2]);
CREATE POLICY "Usuários podem deletar seus próprios arquivos" ON storage.objects FOR DELETE USING (bucket_id = 'artes-cloudinary' AND auth.uid()::text = (storage.foldername(name))[2]);
