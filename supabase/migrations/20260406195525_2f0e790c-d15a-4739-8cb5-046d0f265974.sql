
-- Create ai-uploads storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-uploads', 'ai-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload files to their own folder
CREATE POLICY "Users upload own ai files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own uploaded files
CREATE POLICY "Users read own ai files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own files
CREATE POLICY "Users delete own ai files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
