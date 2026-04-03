import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isDisposableEmail } from "@/utils/disposableEmailDomains";
import { getSignupDeviceFingerprint } from "@/lib/deviceFingerprint";

export type AuthStep = 'email' | 'password' | 'set-password' | 'signup' | 'waiting-confirmation';

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
}

export function useAuthFlow() {
  const navigate = useNavigate();

  const [state, setState] = useState<AuthState>({
    step: 'email',
    email: '',
    verifiedEmail: '',
    isLoading: false,
    error: null,
  });

  const setEmail = useCallback((email: string) => {
    setState(prev => ({ ...prev, email, error: null }));
  }, []);

  const goToEmail = useCallback(() => {
    setState(prev => ({ ...prev, step: 'email', error: null }));
  }, []);

  const goToSignup = useCallback(() => {
    setState(prev => ({ ...prev, step: 'signup', error: null }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Step 1: Check email → 3 outcomes
   * A) Has password → show password field
   * B) Exists but no password (webhook) → show set-password
   * C) Not found → open signup modal
   */
  const checkEmail = useCallback(async () => {
    const emailToCheck = state.email.trim().toLowerCase();
    if (!emailToCheck) {
      setState(prev => ({ ...prev, error: 'Ingresa tu correo electrónico' }));
      return;
    }

    // Check disposable email
    if (isDisposableEmail(emailToCheck)) {
      setState(prev => ({ ...prev, error: 'Los correos temporales no están permitidos. Usa un correo real.' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: profileCheck, error } = await supabase
        .rpc('check_profile_exists', { check_email: emailToCheck }) as {
          data: { exists_in_db: boolean; password_changed: boolean; has_logged_in: boolean }[] | null;
          error: any;
        };

      if (error) throw error;

      const result = profileCheck?.[0];
      const profileExists = result?.exists_in_db || false;
      const passwordChanged = result?.password_changed || false;

      // Case C: Not found → signup
      if (!profileExists) {
        setState(prev => ({
          ...prev,
          step: 'signup',
          email: emailToCheck,
          isLoading: false,
        }));
        return;
      }

      // Case B: Exists but no password → set password flow
      if (profileExists && !passwordChanged) {
        // Try auto-login with email as password (webhook-created accounts)
        const { error: autoLoginError } = await supabase.auth.signInWithPassword({
          email: emailToCheck,
          password: emailToCheck,
        });

        if (!autoLoginError) {
          setState(prev => ({
            ...prev,
            step: 'set-password',
            verifiedEmail: emailToCheck,
            isLoading: false,
          }));
          return;
        }

        // Auto-login failed, still show set-password
        setState(prev => ({
          ...prev,
          step: 'set-password',
          verifiedEmail: emailToCheck,
          isLoading: false,
        }));
        return;
      }

      // Case A: Has password → show password field
      setState(prev => ({
        ...prev,
        step: 'password',
        verifiedEmail: emailToCheck,
        isLoading: false,
      }));
    } catch (error) {
      console.error('[AuthFlow] Check email error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al verificar el correo. Intenta de nuevo.',
      }));
    }
  }, [state.email]);

  /**
   * Case A: Login with password
   */
  const loginWithPassword = useCallback(async (password: string) => {
    if (!password || password.length < 6) {
      setState(prev => ({ ...prev, error: 'La contraseña debe tener al menos 6 caracteres' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: state.verifiedEmail,
        password,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
          }));
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Correo o contraseña incorrectos',
          }));
        }
        return;
      }

      if (!data.user) {
        setState(prev => ({ ...prev, isLoading: false, error: 'Error al iniciar sesión' }));
        return;
      }

      // Check email verification
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified, password_changed')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile && profile.email_verified === false) {
        await supabase.auth.signOut();
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
        }));
        return;
      }

      // Mark has_logged_in
      await supabase.from('profiles').update({ has_logged_in: true }).eq('id', data.user.id);

      toast.success('¡Inicio de sesión exitoso!');
      navigate('/');
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('[AuthFlow] Login error:', error);
      setState(prev => ({ ...prev, isLoading: false, error: 'Error al iniciar sesión' }));
    }
  }, [state.verifiedEmail, navigate]);

  /**
   * Case B: Set password for webhook-created account
   */
  const setPassword = useCallback(async (password: string, confirmPassword: string) => {
    if (password.length < 6) {
      setState(prev => ({ ...prev, error: 'La contraseña debe tener al menos 6 caracteres' }));
      return;
    }
    if (password !== confirmPassword) {
      setState(prev => ({ ...prev, error: 'Las contraseñas no coinciden' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          password_changed: true,
          has_logged_in: true,
        }).eq('id', user.id);
      }

      toast.success('¡Contraseña creada! Bienvenido.');
      navigate('/');
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error: any) {
      console.error('[AuthFlow] Set password error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Error al crear la contraseña',
      }));
    }
  }, [navigate]);

  /**
   * Case C: Signup new user
   */
  const signup = useCallback(async (data: SignupData) => {
    const { email, password, name } = data;
    if (!email.trim()) {
      setState(prev => ({ ...prev, error: 'Ingresa tu correo electrónico' }));
      return;
    }

    // Check disposable email
    if (isDisposableEmail(email)) {
      setState(prev => ({ ...prev, error: 'Los correos temporales no están permitidos. Usa un correo real.' }));
      return;
    }

    if (password.length < 6) {
      setState(prev => ({ ...prev, error: 'La contraseña debe tener al menos 6 caracteres' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check device fingerprint limit
      const deviceFingerprint = getSignupDeviceFingerprint();
      try {
        const { data: alreadyUsed, error: deviceError } = await supabase
          .rpc('check_device_signup_limit', { p_fingerprint: deviceFingerprint });

        if (deviceError) {
          console.error('[AuthFlow] Device check error:', deviceError);
        } else if (alreadyUsed) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Este dispositivo ya tiene una cuenta registrada. Usa tu cuenta existente.',
          }));
          return;
        }
      } catch (fpErr) {
        console.error('[AuthFlow] Fingerprint check error:', fpErr);
      }

      // Use custom signup edge function (does NOT send Supabase's built-in email)
      const { data: signupData, error: signupError } = await supabase.functions.invoke('signup-user', {
        body: { email: normalizedEmail, password, name }
      });

      if (signupError || (signupData && !signupData.success)) {
        const errMsg = signupData?.error || signupError?.message || 'Error al crear cuenta';
        if (errMsg === 'already_registered') {
          setState(prev => ({ ...prev, isLoading: false, error: 'Este correo ya está registrado' }));
        } else {
          setState(prev => ({ ...prev, isLoading: false, error: `Error al crear cuenta: ${errMsg}` }));
        }
        return;
      }

      const userId = signupData.user_id;

      // Register device fingerprint
      try {
        await supabase.rpc('register_device_signup', {
          p_fingerprint: deviceFingerprint,
          p_user_id: userId,
        });
        console.log('[AuthFlow] Device fingerprint registered');
      } catch (fpErr) {
        console.error('[AuthFlow] Failed to register device fingerprint:', fpErr);
      }

      // Send confirmation email via SendPulse (only email sent)
      try {
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('send-confirmation-email', {
          body: { email: normalizedEmail, user_id: userId }
        });

        if (confirmError || (confirmData && !confirmData.success)) {
          console.error('[AuthFlow] Error sending confirmation email:', confirmError || confirmData?.error);
        } else {
          console.log('[AuthFlow] Confirmation email sent successfully');
        }
      } catch (emailErr) {
        console.error('[AuthFlow] Confirmation email exception:', emailErr);
      }

      setState(prev => ({
        ...prev,
        step: 'waiting-confirmation',
        verifiedEmail: normalizedEmail,
        isLoading: false,
      }));
    } catch (error) {
      console.error('[AuthFlow] Signup error:', error);
      setState(prev => ({ ...prev, isLoading: false, error: 'Error al crear la cuenta' }));
    }
  }, []);

  const resendConfirmation = useCallback(async () => {
    const email = state.verifiedEmail || state.email;
    if (!email) return;
    try {
      // First get user_id from profile
      const { data: profileCheck } = await supabase
        .rpc('check_profile_exists', { check_email: email }) as { data: any[] | null; error: any };
      
      // Re-send via our custom SendPulse function
      // We need user_id — get it from the profiles via a lookup edge function
      await supabase.functions.invoke('send-confirmation-email', {
        body: { email, user_id: 'resend' }
      });
      toast.success('¡Enlace reenviado! Revisa tu correo.');
    } catch {
      toast.error('Error al reenviar el enlace');
    }
  }, [state.verifiedEmail, state.email]);

  return {
    state,
    setEmail,
    checkEmail,
    loginWithPassword,
    setPassword,
    signup,
    resendConfirmation,
    goToEmail,
    goToSignup,
    clearError,
  };
}
