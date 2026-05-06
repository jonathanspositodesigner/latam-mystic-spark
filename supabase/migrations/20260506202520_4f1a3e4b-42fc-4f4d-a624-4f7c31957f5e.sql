-- Criar tabela de créditos se não existir (formato ArcanoApp)
CREATE TABLE IF NOT EXISTS public.upscaler_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  monthly_balance INTEGER DEFAULT 0,
  lifetime_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.upscaler_credits ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own credits" ON public.upscaler_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Adicionar coluna rh_cost em seedance_jobs se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'seedance_jobs' AND column_name = 'rh_cost') THEN
    ALTER TABLE public.seedance_jobs ADD COLUMN rh_cost INTEGER;
  END IF;
END $$;

-- Função para consumir créditos de forma forçada (idêntica ao ArcanoApp)
CREATE OR REPLACE FUNCTION public.consume_upscaler_credits_forced(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'AI Tool'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_monthly INTEGER;
  current_lifetime INTEGER;
  total_balance INTEGER;
  monthly_to_consume INTEGER;
  lifetime_to_consume INTEGER;
  updated_monthly INTEGER;
  updated_lifetime INTEGER;
  updated_balance INTEGER;
  tx_credit_type TEXT;
BEGIN
  IF _amount <= 0 OR _amount > 50000 THEN
    RETURN QUERY SELECT FALSE, 0, 'Invalid amount'::TEXT;
    RETURN;
  END IF;

  -- Garantir que a linha existe
  INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Bloquear linha para atualização
  SELECT COALESCE(uc.monthly_balance, 0), COALESCE(uc.lifetime_balance, 0)
  INTO current_monthly, current_lifetime
  FROM public.upscaler_credits uc
  WHERE uc.user_id = _user_id
  FOR UPDATE;

  total_balance := current_monthly + current_lifetime;

  IF total_balance < _amount THEN
    RETURN QUERY SELECT FALSE, total_balance, 'Saldo insuficiente'::TEXT;
    RETURN;
  END IF;

  -- Priorizar saldo mensal (mesma lógica do ArcanoApp)
  IF current_monthly >= _amount THEN
    monthly_to_consume := _amount;
    lifetime_to_consume := 0;
    tx_credit_type := 'monthly';
  ELSIF current_monthly > 0 THEN
    monthly_to_consume := current_monthly;
    lifetime_to_consume := _amount - current_monthly;
    tx_credit_type := 'mixed';
  ELSE
    monthly_to_consume := 0;
    lifetime_to_consume := _amount;
    tx_credit_type := 'lifetime';
  END IF;

  updated_monthly := current_monthly - monthly_to_consume;
  updated_lifetime := current_lifetime - lifetime_to_consume;
  updated_balance := updated_monthly + updated_lifetime;

  UPDATE public.upscaler_credits
  SET monthly_balance = updated_monthly,
      lifetime_balance = updated_lifetime,
      balance = updated_balance,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.upscaler_credit_transactions (
    user_id, amount, balance_after, transaction_type, description, credit_type
  ) VALUES (
    _user_id, -_amount, updated_balance, 'consumption',
    COALESCE(_description, 'AI Tool'), tx_credit_type
  );

  RETURN QUERY SELECT TRUE, updated_balance, NULL::TEXT;
END;
$$;

-- Sincronizar saldos iniciais a partir das transações existentes (para não zerar ninguém)
INSERT INTO public.upscaler_credits (user_id, balance, monthly_balance, lifetime_balance)
SELECT 
  user_id, 
  SUM(amount) as balance,
  0 as monthly_balance,
  SUM(amount) as lifetime_balance
FROM public.upscaler_credit_transactions
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  balance = EXCLUDED.balance,
  lifetime_balance = EXCLUDED.lifetime_balance;
