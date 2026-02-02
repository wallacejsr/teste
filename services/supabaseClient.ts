import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let initialized = false;

export const getSupabaseClient = (supabaseUrl: string, supabaseKey: string): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  initialized = true;
  return supabaseClient;
};

export const isSupabaseInitialized = () => initialized;