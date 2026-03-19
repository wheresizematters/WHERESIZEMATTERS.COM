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
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

  // Verify calling user's identity
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const admin = createClient(supabaseUrl, serviceKey)
  const { imagePath, reportedSize } = await req.json()

  // Download the verification photo
  const { data: imageBlob, error: downloadError } = await admin.storage
    .from('verifications')
    .download(imagePath)

  if (downloadError || !imageBlob) {
    await queuePending(admin, user.id, imagePath, reportedSize, null, null, 'Image download failed')
    return jsonResponse(corsHeaders, { status: 'pending', reason: 'download_failed' })
  }

  // Convert to base64 for Anthropic vision
  const arrayBuffer = await imageBlob.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  const base64 = btoa(binary)
  const mimeType = (imageBlob.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  // Call Claude vision
  const prompt = `You are a measurement verification assistant. This photo was submitted for penis length verification.

Examine the image carefully:
1. Identify any reference objects visible (credit card = 3.37" wide, US dollar bill = 6.14" long, US quarter = 0.955" diameter, ruler or measuring tape with markings)
2. Using the reference object for scale, estimate the erect length of the penis in inches
3. If no usable reference object is present, state that

Respond with JSON only — no markdown, no explanation:
{
  "has_reference": boolean,
  "reference_type": "credit_card" | "dollar_bill" | "quarter" | "ruler" | "none",
  "estimated_inches": number | null,
  "confidence": "low" | "medium" | "high",
  "notes": "one sentence explanation"
}`

  let parsed: {
    has_reference: boolean
    reference_type: string
    estimated_inches: number | null
    confidence: 'low' | 'medium' | 'high'
    notes: string
  } | null = null

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const raw = aiData.content?.[0]?.text ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    }
  } catch (_) {
    // Fall through to manual review
  }

  if (!parsed) {
    await queuePending(admin, user.id, imagePath, reportedSize, null, null, 'AI analysis failed')
    return jsonResponse(corsHeaders, { status: 'pending', reason: 'ai_failed' })
  }

  const { has_reference, estimated_inches, confidence, notes } = parsed
  const diff = estimated_inches !== null ? Math.abs(estimated_inches - reportedSize) : Infinity
  const autoVerify = has_reference && estimated_inches !== null && diff <= 0.5 && confidence !== 'low'

  if (autoVerify) {
    await admin.from('profiles').update({ is_verified: true }).eq('id', user.id)
    // Remove any prior pending request
    await admin.from('verification_requests').delete().eq('user_id', user.id)
    await admin.storage.from('verifications').remove([imagePath])
    return jsonResponse(corsHeaders, { status: 'auto_verified' })
  }

  await queuePending(admin, user.id, imagePath, reportedSize, estimated_inches ?? null, confidence, notes)
  return jsonResponse(corsHeaders, { status: 'pending', reason: 'manual_review' })
})

async function queuePending(
  admin: ReturnType<typeof createClient>,
  userId: string,
  imagePath: string,
  reportedSize: number,
  aiEstSize: number | null,
  aiConfidence: string | null,
  aiNotes: string | null,
) {
  await admin.from('verification_requests').upsert({
    user_id: userId,
    image_path: imagePath,
    reported_size: reportedSize,
    ai_est_size: aiEstSize,
    ai_confidence: aiConfidence,
    ai_notes: aiNotes,
    status: 'pending',
  }, { onConflict: 'user_id' })
}

function jsonResponse(headers: Record<string, string>, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
