CREATE OR REPLACE FUNCTION public.mark_pending_job_as_failed(
    p_table_name text,
    p_job_id uuid,
    p_error_message text
)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET status = %L, error_message = %L, completed_at = now() WHERE id = %L AND status IN (%L, %L)', 
        p_table_name, 'failed', p_error_message, p_job_id, 'pending', 'starting');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
