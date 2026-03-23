import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tolerance by reference object — rulers/tape measures are most accurate
const TOLERANCE_BY_REF: Record<string, number> = {
  ruler:       0.40,
  tape:        0.40,
  credit_card: 0.75,
  dollar_bill: 0.75,
  quarter:     0.65,
  a4_paper:    0.75,
  iphone:      0.75,
  other:       0.85,
  none:        Infinity,
}

const PROMPT = `You are a forensic measurement analyst. A user has submitted a photo for penis length verification. Your job is to estimate the erect length as accurately as possible using any reference objects visible in the frame.

STEP 1 — IDENTIFY REFERENCE OBJECTS
Scan the entire image for any of the following:
- Ruler or measuring tape (most accurate — read the markings directly)
- US credit/debit card: 3.37" (85.6mm) wide × 2.13" (53.98mm) tall
- US dollar bill: 6.14" (156mm) long × 2.61" (66.3mm) wide
- US quarter coin: 0.955" (24.26mm) diameter
- A4 / letter paper: 8.27" × 11.69" (or 8.5" × 11")
- iPhone 15: 5.81" tall × 2.82" wide
- iPhone 15 Pro Max: 6.29" tall × 3.02" wide
- iPhone 14: 5.78" tall × 2.82" wide

STEP 2 — CALIBRATE SCALE
Using the reference object's known real-world dimensions:
- Measure the reference object's pixel span in the image
- Calculate pixels-per-inch ratio
- Account for any visible perspective distortion (if camera angle is not directly overhead, objects appear shorter — adjust upward by up to 5% for mild angles)

STEP 3 — MEASURE LENGTH
- Measure erect length from the pubic bone at the base to the tip of the glans
- Measure along the TOP side (dorsal), not the underside or curved path
- Use the pixels-per-inch ratio from Step 2 to convert to inches
- Do NOT include foreskin beyond the glans

STEP 4 — ESTIMATE GIRTH (if visible)
- If the circumference/girth can be estimated from the image, provide it
- Girth is the circumference measured at mid-shaft

STEP 5 — ASSESS CONFIDENCE
- high: ruler/tape with clear markings AND subject is erect AND shot from above
- medium: card/bill/coin reference AND subject appears erect AND reasonable angle
- low: reference object partially visible, subject may not be fully erect, or significant perspective distortion

CRITICAL RULES:
- If no usable reference object is present, set has_reference: false and estimated_inches: null
- Never estimate without a reference — it is better to queue for manual review than guess
- If the image does not contain a penis, set estimated_inches: null and notes: "no subject detected"
- Be precise to one decimal place

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "has_reference": boolean,
  "reference_type": "ruler" | "tape" | "credit_card" | "dollar_bill" | "quarter" | "a4_paper" | "iphone" | "other" | "none",
  "reference_confidence": "clear" | "partial" | "unclear",
  "estimated_inches": number | null,
  "estimated_girth_inches": number | null,
  "confidence": "low" | "medium" | "high",
  "perspective_adjusted": boolean,
  "notes": "one sentence explanation"
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

  // Verify calling user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const admin = createClient(supabaseUrl, serviceKey)
  const { imagePath, reportedSize, reportedGirth } = await req.json()

  // Download verification photo
  const { data: imageBlob, error: downloadError } = await admin.storage
    .from('verifications')
    .download(imagePath)

  if (downloadError || !imageBlob) {
    await queuePending(admin, user.id, imagePath, reportedSize, null, null, 'Image download failed')
    return jsonResponse(corsHeaders, { status: 'pending', reason: 'download_failed' })
  }

  // Convert to base64
  const arrayBuffer = await imageBlob.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  const base64 = btoa(binary)
  const mimeType = (imageBlob.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  // Run first AI analysis pass
  const pass1 = await callClaude(anthropicKey, base64, mimeType)

  if (!pass1) {
    await queuePending(admin, user.id, imagePath, reportedSize, null, null, 'AI analysis failed')
    return jsonResponse(corsHeaders, { status: 'pending', reason: 'ai_failed' })
  }

  let finalEstimate = pass1.estimated_inches
  let finalConfidence = pass1.confidence
  let finalNotes = pass1.notes

  // If medium confidence, run a second pass and average for better accuracy
  if (pass1.confidence === 'medium' && pass1.has_reference && pass1.estimated_inches !== null) {
    const pass2 = await callClaude(anthropicKey, base64, mimeType)
    if (pass2 && pass2.estimated_inches !== null && pass2.has_reference) {
      const avg = (pass1.estimated_inches + pass2.estimated_inches) / 2
      const agreement = Math.abs(pass1.estimated_inches - pass2.estimated_inches)
      // If both passes agree within 0.3", upgrade confidence and use average
      if (agreement <= 0.3) {
        finalEstimate = Math.round(avg * 10) / 10
        finalConfidence = 'high'
        finalNotes = `Two-pass avg: ${pass1.estimated_inches}" + ${pass2.estimated_inches}" = ${finalEstimate}". ${pass1.notes}`
      } else {
        // Disagreement — flag for manual review
        finalNotes = `Two passes disagreed: ${pass1.estimated_inches}" vs ${pass2.estimated_inches}". ${pass1.notes}`
        finalConfidence = 'low'
      }
    }
  }

  const { has_reference, reference_type, estimated_girth_inches } = pass1

  // Girth cross-check — if user reported girth and AI estimated it, flag large discrepancy
  let girthFraudFlag = false
  if (reportedGirth && estimated_girth_inches !== null) {
    const girthDiff = Math.abs(estimated_girth_inches - reportedGirth)
    if (girthDiff > 1.0) {
      girthFraudFlag = true
      finalConfidence = 'low'
      finalNotes = `Girth discrepancy: reported ${reportedGirth}", AI estimated ${estimated_girth_inches}". ${finalNotes}`
    }
  }

  // Determine tolerance based on reference object type
  const tolerance = TOLERANCE_BY_REF[reference_type ?? 'none'] ?? 0.85
  const diff = finalEstimate !== null ? Math.abs(finalEstimate - reportedSize) : Infinity

  const autoVerify = (
    has_reference &&
    finalEstimate !== null &&
    diff <= tolerance &&
    finalConfidence !== 'low' &&
    !girthFraudFlag
  )

  if (autoVerify) {
    await admin.from('profiles').update({ is_verified: true }).eq('id', user.id)
    await admin.from('verification_requests').delete().eq('user_id', user.id)
    await admin.storage.from('verifications').remove([imagePath])
    return jsonResponse(corsHeaders, { status: 'auto_verified' })
  }

  // Queue for manual review with full AI analysis data
  await queuePending(
    admin, user.id, imagePath, reportedSize,
    finalEstimate, finalConfidence,
    finalNotes + (girthFraudFlag ? ' [GIRTH FLAG]' : '')
  )
  return jsonResponse(corsHeaders, { status: 'pending', reason: 'manual_review' })
})

async function callClaude(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<{
  has_reference: boolean
  reference_type: string
  reference_confidence: string
  estimated_inches: number | null
  estimated_girth_inches: number | null
  confidence: 'low' | 'medium' | 'high'
  perspective_adjusted: boolean
  notes: string
} | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const raw = data.content?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0])

    // Sanity check the parsed data
    if (typeof parsed.has_reference !== 'boolean') return null
    if (parsed.estimated_inches !== null && (
      typeof parsed.estimated_inches !== 'number' ||
      parsed.estimated_inches < 1 ||
      parsed.estimated_inches > 16
    )) {
      parsed.estimated_inches = null
      parsed.confidence = 'low'
    }

    return parsed
  } catch {
    return null
  }
}

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
