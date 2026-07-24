const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'PON_AQUI_TU_SERVICE_ROLE_KEY') {
  throw new Error(
    'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en server/.env (Supabase > Project Settings > API > service_role key)'
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = supabaseAdmin;
