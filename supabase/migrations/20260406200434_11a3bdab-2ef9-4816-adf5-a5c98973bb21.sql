-- Add missing columns to upscaler_jobs for full RunningHub integration
ALTER TABLE public.upscaler_jobs
  ADD COLUMN IF NOT EXISTS job_payload jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS input_file_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS detail_denoise numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolution integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS framing_mode text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS editing_level numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_attempted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_task_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waited_in_queue boolean DEFAULT false;