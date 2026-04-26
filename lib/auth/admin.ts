import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin env vars missing');
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function generateKidLoginCode(): string {
  // 6 chars, no confusing characters
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function generateKidInternalEmail(): string {
  const random = crypto.randomUUID();
  return `kid_${random}@noreply.local`;
}

export function generateKidInternalPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}
