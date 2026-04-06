
-- Drop existing ai-uploads storage policies
DROP POLICY IF EXISTS "Users upload own ai files" ON storage.objects;
DROP POLICY IF EXISTS "Users read own ai files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own ai files" ON storage.objects;

-- Recreate with correct path: tool/userId/filename
-- foldername returns array of folder segments, so for "upscaler/USER_ID/file.jpg"
-- foldername[1] = 'upscaler', foldername[2] = USER_ID
-- We need to check the SECOND segment

CREATE POLICY "Users upload own ai files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ai-uploads'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users read own ai files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ai-uploads'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users delete own ai files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ai-uploads'
  AND (auth.uid())::text = (storage.foldername(name))[2]
);

-- Service role needs to read uploaded files to send to RunningHub
-- Allow edge functions (service role) full access
CREATE POLICY "Service role full access ai-uploads"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'ai-uploads')
WITH CHECK (bucket_id = 'ai-uploads');
