import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './public-config';
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL||publicConfig.url,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||publicConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
