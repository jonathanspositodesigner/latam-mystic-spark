-- Create storage bucket for flyer maker uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('flyer-maker-uploads', 'flyer-maker-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for flyer-maker-uploads
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'flyer-maker-uploads');

CREATE POLICY "Authenticated Users can upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'flyer-maker-uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own uploads" ON storage.objects FOR UPDATE 
USING (bucket_id = 'flyer-maker-uploads' AND auth.uid()::text = owner::text);
