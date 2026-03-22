import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Stripe signature verification using Web Crypto
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce((acc: any, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts['t'];
    const sig = parts['v1'];
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computedSig = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedSig === sig;
  } catch {
    return false;
  }
}

async function setPremium(supabase: any, userId: string, active: boolean, subscriptionId?: string, expiresAt?: string) {
  await supabase.from('profiles').update({
    is_premium: active,
    stripe_subscription_id: subscriptionId ?? null,
    premium_expires_at: expiresAt ?? null,
  }).eq('id', userId);
}

serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  const valid = await verifyStripeSignature(payload, sig, STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(payload);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
        if (!userId) break;

        // Get subscription end date
        let expiresAt: string | undefined;
        if (session.subscription) {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
            headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
          });
          const sub = await subRes.json();
          expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        }

        await setPremium(supabase, userId, true, session.subscription, expiresAt);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        const active = sub.status === 'active' || sub.status === 'trialing';
        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        await setPremium(supabase, userId, active, sub.id, expiresAt);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        await setPremium(supabase, userId, false);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Webhook error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
