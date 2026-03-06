import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

// We need the service role key to bypass RLS for uploads if RLS is enabled, 
// or at least anon key if storage is public. Assuming anon is enough for now or we must enable it.
export const supabase = createClient(supabaseUrl, supabaseKey);
