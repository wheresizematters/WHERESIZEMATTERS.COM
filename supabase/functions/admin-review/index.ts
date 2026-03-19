import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify the caller's identity
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const admin = createClient(supabaseUrl, serviceKey)

  // Confirm caller is an admin
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { requestId, action } = await req.json() // action: 'approve' | 'reject'

  const { data: verReq, error: fetchError } = await admin
    .from('verification_requests')
    .select('user_id, image_path')
    .eq('id', requestId)
    .single()

  if (fetchError || !verReq) return new Response('Not found', { status: 404, headers: corsHeaders })

  await admin.from('verification_requests').update({
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq('id', requestId)

  if (action === 'approve') {
    await admin.from('profiles').update({ is_verified: true }).eq('id', verReq.user_id)
  }

  // Delete photo either way — privacy
  await admin.storage.from('verifications').remove([verReq.image_path])

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
