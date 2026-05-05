-- Garantir tabela de configurações
CREATE TABLE IF NOT EXISTS public.ai_tool_settings (
    tool_name TEXT PRIMARY KEY,
    credit_cost INTEGER NOT NULL DEFAULT 100,
    has_api_cost BOOLEAN NOT NULL DEFAULT false,
    api_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drop para permitir mudar o retorno
DROP FUNCTION IF EXISTS public.user_cancel_ai_job(text, uuid);

-- Recriar função com retorno JSON (Padrão ArcanoApp)
CREATE OR REPLACE FUNCTION public.user_cancel_ai_job(
    p_table_name text,
    p_job_id uuid
)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
    v_status text;
BEGIN
    EXECUTE format('SELECT user_id, status FROM public.%I WHERE id = %L', p_table_name, p_job_id)
    INTO v_user_id, v_status;

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error_message', 'Job não encontrado');
    END IF;

    IF v_status NOT IN ('pending', 'queued', 'starting') THEN
        RETURN json_build_object('success', false, 'error_message', 'O processamento já iniciou e não pode ser cancelado');
    END IF;

    EXECUTE format('UPDATE public.%I SET status = %L, completed_at = now() WHERE id = %L', p_table_name, 'cancelled', p_job_id);
    
    RETURN json_build_object('success', true, 'refunded_amount', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para falhas
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
