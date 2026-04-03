import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

export type AuthStep = 'email' | 'password' | 'signup' | 'waiting-link';

export interface AuthState {
  step: AuthStep;
  email: string;
  verifiedEmail: string;
  isLoading: boolean;
  error: string | null;
}

export interface SignupData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface AuthConfig {
  changePasswordRoute: string;
  loginRoute: string;
  forgotPasswordRoute: string;
  defaultRedirect: string;
  onLoginSuccess?: () => void;
  onSignupSuccess?: () => void;
  onNeedPasswordChange?: () => void;
  onClose?: () => void;
  postLoginValidation?: (user: User) => Promise<{ valid: boolean; error?: string }>;
}

export interface UseUnifiedAuthReturn {
  state: AuthState;
  checkEmail: (email?: string) => Promise<void>;
  loginWithPassword: (password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  resendLink: () => Promise<void>;
  changeEmail: () => void;
  goToSignup: () => void;
  goToLogin: () => void;
  setEmail: (email: string) => void;
  getForgotPasswordUrl: () => string;
}

export function useUnifiedAuth(config: AuthConfig): UseUnifiedAuthReturn {
  const navigate = useNavigate();

  const [state, setState] = useState<AuthState>({
    step: 'email',
    email: '',
    verifiedEmail: '',
    isLoading: false,
    error: null,
  });

  const setEmail = useCallback((email: string) => {
    setState(prev => ({ ...prev, email }));
  }, []);

  const changeEmail = useCallback(() => {
    setState({ step: 'email', email: state.email, verifiedEmail: '', isLoading: false, error: null });
  }, [state.email]);

  const goToSignup = useCallback(() => {
    setState(prev => ({ ...prev, step: 'signup' }));
  }, []);

  const goToLogin = useCallback(() => {
    setState(prev => ({ ...prev, step: 'email' }));
  }, []);

  const getForgotPasswordUrl = useCallback(() => {
    const email = state.verifiedEmail || state.email;
    return `${config.forgotPasswordRoute}?email=${encodeURIComponent(email)}`;
  }, [state.verifiedEmail, state.email, config.forgotPasswordRoute]);

  const checkEmail = useCallback(async (emailParam?: string) => {
    const emailToCheck = emailParam || state.email;
    if (!emailToCheck.trim()) {
      toast.error('Ingresa tu email');
      return;
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const normalizedEmail = emailToCheck.trim().toLowerCase();

    try {
      const { data: profileCheck, error } = await supabase
        .rpc('check_profile_exists', { check_email: normalizedEmail });

      if (error) throw error;

      const profileExists = profileCheck?.[0]?.exists_in_db || false;
      let passwordChanged = profileCheck?.[0]?.password_changed || false;
      const hasLoggedIn = profileCheck?.[0]?.has_logged_in || false;

      if (!profileExists) {
        toast.info('Email no encontrado. Crea una cuenta.');
        setState(prev => ({ ...prev, step: 'signup', email: normalizedEmail, isLoading: false }));
        return;
      }

      if (profileExists && !passwordChanged) {
        const { error: autoLoginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail, password: normalizedEmail,
        });
        if (!autoLoginError) {
          toast.success('¡Primer acceso! Establece tu contraseña.');
          config.onNeedPasswordChange?.();
          navigate(`${config.changePasswordRoute}?redirect=${encodeURIComponent(config.defaultRedirect)}`);
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }
        const waitingUrl = `${config.changePasswordRoute}?redirect=${encodeURIComponent(config.defaultRedirect)}&sent=1&email=${encodeURIComponent(normalizedEmail)}`;
        navigate(waitingUrl);
        config.onClose?.();
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setState(prev => ({ ...prev, step: 'password', verifiedEmail: normalizedEmail, isLoading: false }));
    } catch (error) {
      console.error('[UnifiedAuth] Check email error:', error);
      toast.error('Error al verificar registro');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.email, navigate, config]);

  const loginWithPassword = useCallback(async (password: string) => {
    if (!password) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: state.verifiedEmail, password,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          toast.error('Confirma tu email antes de iniciar sesión.');
        } else {
          toast.error('Email o contraseña incorrectos');
        }
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!data.user) {
        toast.error('Error al iniciar sesión');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (config.postLoginValidation) {
        const validation = await config.postLoginValidation(data.user);
        if (!validation.valid) {
          await supabase.auth.signOut();
          toast.error(validation.error || 'Error al iniciar sesión');
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('password_changed, email_verified')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile && profile.email_verified === false) {
        await supabase.auth.signOut();
        toast.error('Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!profile || !profile.password_changed) {
        if (!profile) {
          await supabase.from('profiles').upsert({
            id: data.user.id, email: data.user.email, password_changed: false,
          }, { onConflict: 'id' });
        }
        toast.success('¡Primer acceso! Establece tu contraseña.');
        config.onNeedPasswordChange?.();
        navigate(`${config.changePasswordRoute}?redirect=${encodeURIComponent(config.defaultRedirect)}`);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      toast.success('¡Inicio de sesión exitoso!');
      config.onLoginSuccess?.();
      navigate(config.defaultRedirect);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('[UnifiedAuth] Login error:', error);
      toast.error('Error al iniciar sesión');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.verifiedEmail, navigate, config]);

  const signup = useCallback(async (data: SignupData) => {
    const { email, password, name, phone } = data;
    if (!email.trim()) { toast.error('Ingresa tu email'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Use custom signup edge function (does NOT send Supabase's built-in email)
      const { data: signupData, error: signupError } = await supabase.functions.invoke('signup-user', {
        body: { email: normalizedEmail, password, name, phone }
      });

      if (signupError || (signupData && !signupData.success)) {
        const errMsg = signupData?.error || signupError?.message || 'Error al crear cuenta';
        if (errMsg === 'already_registered') {
          toast.error('Este email ya está registrado');
        } else {
          toast.error(`Error al crear cuenta: ${errMsg}`);
        }
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const userId = signupData.user_id;

      // Send confirmation email via SendPulse (only email sent)
      try {
        await supabase.functions.invoke('send-confirmation-email', {
          body: { email: normalizedEmail, user_id: userId }
        });
        console.log('[UnifiedAuth] Confirmation email sent');
      } catch (emailErr) {
        console.error('[UnifiedAuth] Confirmation email error:', emailErr);
      }

      toast.success('¡Cuenta creada! Revisa tu email para confirmar.');
      setState(prev => ({ ...prev, step: 'waiting-link', verifiedEmail: normalizedEmail, isLoading: false }));
      config.onSignupSuccess?.();
    } catch (error) {
      console.error('[UnifiedAuth] Signup error:', error);
      toast.error('Error al crear cuenta');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [config]);

  const resendLink = useCallback(async () => {
    const email = state.verifiedEmail || state.email;
    if (!email) return;
    try {
      await supabase.functions.invoke('send-confirmation-email', {
        body: { email, user_id: 'resend' }
      });
      toast.success('¡Link reenviado a tu email!');
    } catch {
      toast.error('Error al reenviar link');
    }
  }, [state.verifiedEmail, state.email]);

  return {
    state, checkEmail, loginWithPassword, signup, resendLink,
    changeEmail, goToSignup, goToLogin, setEmail, getForgotPasswordUrl,
  };
}
