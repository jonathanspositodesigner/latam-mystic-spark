-- Create image_generator_jobs table
CREATE TABLE IF NOT EXISTS public.image_generator_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id TEXT,
    prompt TEXT NOT NULL,
    aspect_ratio TEXT DEFAULT '1:1',
    model TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'pending',
    output_url TEXT,
    error_message TEXT,
    credits_charged BOOLEAN DEFAULT false,
    user_credit_cost INTEGER DEFAULT 1,
    task_id TEXT,
    current_step TEXT,
    step_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.image_generator_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own image generator jobs"
ON public.image_generator_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image generator jobs"
ON public.image_generator_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own image generator jobs"
ON public.image_generator_jobs FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_image_generator_jobs_updated_at
BEFORE UPDATE ON public.image_generator_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
