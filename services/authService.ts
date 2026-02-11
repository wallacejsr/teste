// ================================================
// AUTHENTICATION SERVICE - PILAR 3
// ================================================
// Arquivo: services/authService.ts
// Propósito: Gerenciar autenticação via Supabase Auth
// Segurança: JWT como única fonte de verdade
// Data: 2026-01-22
// ================================================

import { SupabaseClient, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { User, Role } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { logger } from './logger';

// ================================================
// INTERFACES
// ================================================

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface SignupData {
  email: string;
  password: string;
  nome: string;
  tenantId: string;
  role?: Role;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface PasswordResetData {
  email: string;
}

// ================================================
// AUTHENTICATION SERVICE CLASS
// ================================================

class AuthService {
  private supabase: SupabaseClient | null = null;
  private currentSession: Session | null = null;
  
  // 🔒 RATE LIMITING: Proteção contra brute force
  private loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos
  private readonly ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutos

  /**
   * Inicializar o serviço de autenticação
   */
  initialize(supabaseUrl: string, supabaseKey: string): boolean {
    try {
      if (this.supabase) {
        return true;
      }

      this.supabase = getSupabaseClient(supabaseUrl, supabaseKey);
      return true;
    } catch (error) {
      logger.error('❌ [AuthService] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Verificar se o serviço está disponível
   */
  isAvailable(): boolean {
    return this.supabase !== null;
  }

  /**
   * Obter cliente Supabase (para uso em outros serviços)
   */
  getClient(): SupabaseClient | null {
    return this.supabase;
  }

  // ================================================
  // SIGNUP (Criar Nova Conta)
  // ================================================

  /**
   * Criar novo usuário no Supabase Auth
   * NOTA: O trigger on_auth_user_created cria automaticamente o registro em public.users
   */
  async signup(data: SignupData): Promise<AuthResult> {
    if (!this.supabase) {
      return { success: false, error: 'Serviço não inicializado' };
    }

    try {
      logger.log('[AuthService] Iniciando signup para:', data.email);

      // Criar usuário no Supabase Auth
      // O trigger on_auth_user_created cuidará da criação do registro em public.users
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.nome,
            tenant_id: data.tenantId,
            role: data.role || Role.LEITURA,
          },
        },
      });

      if (authError) {
        logger.error('[AuthService] Signup auth error:', authError);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Falha ao criar usuário' };
      }

      logger.log('✅ [AuthService] User created successfully:', authData.user.id);

      // Converter para User type
      const user = this.convertToUser(authData.user, data.tenantId, data.role || Role.LEITURA);

      return {
        success: true,
        user,
        session: authData.session || undefined,
      };
    } catch (error: any) {
      logger.error('[AuthService] Signup exception:', error);
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }

  // ================================================
  // LOGIN (Entrar na Conta)
  // ================================================

  /**
   * Verificar rate limit antes de permitir tentativa de login
   */
  private checkRateLimit(email: string): { allowed: boolean; error?: string; remainingTime?: number } {
    const key = email.toLowerCase().trim();
    const now = Date.now();
    const attempt = this.loginAttempts.get(key);

    // Se não há tentativas anteriores, permitir
    if (!attempt) {
      return { allowed: true };
    }

    // Se está bloqueado, verificar se o tempo de bloqueio expirou
    if (attempt.blockedUntil && now < attempt.blockedUntil) {
      const remainingMinutes = Math.ceil((attempt.blockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Muitas tentativas de login. Tente novamente em ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}.`,
        remainingTime: attempt.blockedUntil - now
      };
    }

    // Se o bloqueio expirou, resetar contador
    if (attempt.blockedUntil && now >= attempt.blockedUntil) {
      this.loginAttempts.delete(key);
      return { allowed: true };
    }

    // Se a última tentativa foi há mais de 15 minutos, resetar
    if (now - attempt.lastAttempt > this.ATTEMPT_WINDOW) {
      this.loginAttempts.delete(key);
      return { allowed: true };
    }

    // Se atingiu o limite de tentativas, bloquear
    if (attempt.count >= this.MAX_ATTEMPTS) {
      const blockedUntil = now + this.BLOCK_DURATION;
      this.loginAttempts.set(key, {
        ...attempt,
        blockedUntil
      });
      
      const remainingMinutes = Math.ceil(this.BLOCK_DURATION / 60000);
      return {
        allowed: false,
        error: `Muitas tentativas de login. Conta bloqueada por ${remainingMinutes} minutos.`,
        remainingTime: this.BLOCK_DURATION
      };
    }

    // Permitir tentativa
    return { allowed: true };
  }

  /**
   * Registrar tentativa de login (sucesso ou falha)
   */
  private recordLoginAttempt(email: string, success: boolean) {
    const key = email.toLowerCase().trim();
    const now = Date.now();

    if (success) {
      // Login bem-sucedido: limpar tentativas
      this.loginAttempts.delete(key);
      return;
    }

    // Login falhou: incrementar contador
    const attempt = this.loginAttempts.get(key);
    
    if (!attempt) {
      this.loginAttempts.set(key, {
        count: 1,
        lastAttempt: now
      });
    } else {
      this.loginAttempts.set(key, {
        count: attempt.count + 1,
        lastAttempt: now,
        blockedUntil: attempt.blockedUntil
      });
    }
  }

  /**
   * Fazer login com email e senha
   */
  async login(data: LoginData): Promise<AuthResult> {
    if (!this.supabase) {
      return { success: false, error: 'Serviço não inicializado' };
    }

    try {
      // 🔒 RATE LIMITING: Verificar antes de tentar autenticar
      const rateLimitCheck = this.checkRateLimit(data.email);
      if (!rateLimitCheck.allowed) {
        logger.debug('[AuthService] Login blocked by rate limit:', data.email);
        // ⚠️ BLOQUEIO TOTAL: Return ANTES de qualquer chamada ao Supabase
        // Impede erro 400 no console e economiza requisições
        return { success: false, error: rateLimitCheck.error };
      }

      logger.log('[AuthService] Tentando login para:', data.email);

      // 1. Autenticar via Supabase (apenas se rate limit permitir)
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        logger.warn('[AuthService] Login failed - Invalid credentials:', data.email);
        
        // 🔒 RATE LIMITING: Registrar tentativa falhada (CRÍTICO!)
        this.recordLoginAttempt(data.email, false);
        
        return { success: false, error: 'Email ou senha incorretos' };
      }

      if (!authData.user || !authData.session) {
        return { success: false, error: 'Falha na autenticação' };
      }

      logger.log('[AuthService] Auth successful:', authData.user.id);
      this.currentSession = authData.session;

      // 2. Buscar dados do usuário no banco
      const { data: userData, error: dbError } = await this.supabase
        .from('users')
        .select('id, email, nome, role, ativo, tenant_id, lastPasswordChange')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !userData) {
        logger.error('[AuthService] Database fetch error:', dbError);
        await this.logout(); // Limpar sessão inválida
        
        // 🔒 RATE LIMITING: Registrar tentativa falhada (usuário não encontrado)
        this.recordLoginAttempt(data.email, false);
        
        return { success: false, error: 'Usuário não encontrado no banco' };
      }

      // 3. Verificar se usuário está ativo
      if (!userData.ativo) {
        logger.warn('[AuthService] User is inactive:', userData.id);
        await this.logout();
        
        // 🔒 RATE LIMITING: Registrar tentativa falhada (usuário inativo)
        this.recordLoginAttempt(data.email, false);
        
        return { success: false, error: 'Usuário inativo' };
      }

      logger.log('✅ [AuthService] Login successful');
      
      // 🔒 RATE LIMITING: Registrar tentativa bem-sucedida (limpa contador)
      this.recordLoginAttempt(data.email, true);

      // 4. Converter para User type
      const user: User = {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        role: userData.role,
        ativo: userData.ativo,
        tenantId: userData.tenant_id,
        lastPasswordChange: userData.lastPasswordChange,
      };

      return {
        success: true,
        user,
        session: authData.session,
      };
    } catch (error: any) {
      logger.error('[AuthService] Login exception:', error);
      
      // 🔒 RATE LIMITING: Registrar tentativa falhada (exceção)
      this.recordLoginAttempt(data.email, false);
      
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }

  // ================================================
  // LOGOUT (Sair da Conta)
  // ================================================

  /**
   * Fazer logout e limpar sessão
   */
  async logout(): Promise<void> {
    if (!this.supabase) {
      logger.warn('[AuthService] Logout called but service not initialized');
      return;
    }

    try {
      logger.log('[AuthService] Logging out');
      await this.supabase.auth.signOut();
      this.currentSession = null;
      logger.log('✅ [AuthService] Logout successful');
    } catch (error) {
      logger.error('[AuthService] Logout error:', error);
    }
  }

  // ================================================
  // SESSION MANAGEMENT
  // ================================================

  /**
   * Obter sessão atual
   */
  async getSession(): Promise<Session | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        logger.error('[AuthService] Get session error:', error);
        return null;
      }

      this.currentSession = session;
      return session;
    } catch (error) {
      logger.error('[AuthService] Get session exception:', error);
      return null;
    }
  }

  /**
   * Obter usuário atual (do JWT)
   */
  async getCurrentUser(): Promise<User | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data: { user: authUser }, error } = await this.supabase.auth.getUser();

      if (error || !authUser) {
        logger.error('[AuthService] Get user error:', error);
        return null;
      }

      // Buscar dados completos do usuário no banco
      const { data: userData, error: dbError } = await this.supabase
        .from('users')
        .select('id, email, nome, role, ativo, tenant_id, lastPasswordChange, avatarUrl')
        .eq('id', authUser.id)
        .single();

      if (dbError || !userData) {
        logger.error('[AuthService] Database fetch error:', dbError);
        return null;
      }

      return {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        role: userData.role,
        ativo: userData.ativo,
        tenantId: userData.tenant_id,
        avatarUrl: userData.avatarUrl || undefined,
        lastPasswordChange: userData.lastPasswordChange,
      };
    } catch (error) {
      logger.error('[AuthService] Get current user exception:', error);
      return null;
    }
  }

  /**
   * Refresh token (renovar sessão)
   */
  async refreshSession(): Promise<Session | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data: { session }, error } = await this.supabase.auth.refreshSession();

      if (error) {
        logger.error('[AuthService] Refresh session error:', error);
        return null;
      }

      this.currentSession = session;
      return session;
    } catch (error) {
      logger.error('[AuthService] Refresh session exception:', error);
      return null;
    }
  }

  // ================================================
  // PASSWORD RESET
  // ================================================

  /**
   * Solicitar reset de senha (enviar email)
   */
  async requestPasswordReset(data: PasswordResetData): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Serviço não inicializado' };
    }

    try {
      logger.log('[AuthService] Requesting password reset for:', data.email);

      const { error } = await this.supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logger.error('[AuthService] Password reset error:', error);
        return { success: false, error: error.message };
      }

      logger.log('✅ [AuthService] Password reset email sent');
      return { success: true };
    } catch (error: any) {
      logger.error('[AuthService] Password reset exception:', error);
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }

  /**
   * Atualizar senha (após clicar no link do email)
   * Feedback depende exclusivamente de supabase.auth.updateUser()
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Serviço não inicializado' };
    }

    try {
      logger.log('🔍 [AuthService] Iniciando updatePassword');

      // Atualizar senha no Supabase Auth
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      // DEBUG PROFUNDO: Log completo do resultado
      logger.log('🔍 [AuthService] updateUser result:', {
        hasError: !!error,
        error: error ? { message: error.message, status: error.status, name: error.name } : null,
        hasData: !!data,
        userData: data?.user ? {
          id: data.user.id,
          email: data.user.email,
          updated_at: data.user.updated_at,
        } : null,
      });

      if (error) {
        logger.error('❌ [AuthService] Update password error:', error);
        return { success: false, error: error.message };
      }

      if (!data || !data.user) {
        logger.warn('⚠️ [AuthService] Update returned no user data (may indicate stale session)');
        return { success: false, error: 'Sessão expirada. Faça login novamente.' };
      }

      // Atualizar lastPasswordChange na tabela users
      const now = new Date().toISOString();
      const { error: updateError } = await this.supabase
        .from('users')
        .update({ lastPasswordChange: now })
        .eq('id', data.user.id);

      if (updateError) {
        logger.warn('⚠️ [AuthService] Failed to update last_password_change:', updateError);
        // Não falhar a operação se não conseguir atualizar o timestamp
      } else {
        logger.log('✅ [AuthService] last_password_change updated for user:', data.user.email);
      }

      // Sucesso depende apenas do Supabase Auth
      logger.log('✅ [AuthService] Password updated successfully for user:', data.user.email);
      return { success: true };
    } catch (error: any) {
      logger.error('[AuthService] Update password exception:', error);
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }

  // ================================================
  // AUTH STATE LISTENER
  // ================================================

  /**
   * Escutar mudanças no estado de autenticação
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
    if (!this.supabase) {
      logger.warn('[AuthService] onAuthStateChange called but service not initialized');
      return () => {};
    }

    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      (event, session) => {
        this.currentSession = session;
        callback(event, session);
      }
    );

    // Retornar função de cleanup
    return () => {
      subscription.unsubscribe();
    };
  }

  // ================================================
  // UTILITY FUNCTIONS
  // ================================================

  /**
   * Converter SupabaseUser para User type
   */
  private convertToUser(authUser: SupabaseUser, tenantId: string, role: Role): User {
    return {
      id: authUser.id,
      email: authUser.email || '',
      nome: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
      role: role,
      ativo: true,
      tenantId: tenantId,
    };
  }

  /**
   * Verificar se email é válido
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Verificar se senha é forte o suficiente
   */
  isStrongPassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: 'Senha deve ter no mínimo 8 caracteres' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Senha deve conter letra minúscula' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Senha deve conter letra maiúscula' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Senha deve conter número' };
    }

    return { valid: true };
  }

  /**
   * Extrair tenant_id do JWT
   */
  getTenantIdFromSession(session: Session | null): string | null {
    if (!session) return null;

    try {
      // JWT payload está no access_token
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      return payload.tenant_id || payload.user_metadata?.tenant_id || null;
    } catch (error) {
      logger.error('[AuthService] Error parsing JWT:', error);
      return null;
    }
  }
}

// ================================================
// SINGLETON INSTANCE
// ================================================

export const authService = new AuthService();

// ================================================
// EXEMPLO DE USO
// ================================================

/*
// Inicializar (uma vez no App.tsx)
authService.initialize(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Signup
const result = await authService.signup({
  email: 'user@example.com',
  password: 'Senha123!',
  nome: 'João Silva',
  tenantId: 'tenant-uuid',
  role: Role.GESTOR
});

if (result.success) {
  logger.log('Usuário criado:', result.user);
}

// Login
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'Senha123!'
});

if (loginResult.success) {
  logger.log('Login bem-sucedido:', loginResult.user);
}

// Logout
await authService.logout();

// Password Reset
await authService.requestPasswordReset({ email: 'user@example.com' });

// Escutar mudanças de auth
authService.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    logger.log('Usuário fez login');
  } else if (event === 'SIGNED_OUT') {
    logger.log('Usuário fez logout');
  }
});
*/

// ================================================
// FIM DO ARQUIVO
// ================================================
