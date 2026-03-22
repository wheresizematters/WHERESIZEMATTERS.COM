import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  // Only POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, title, body: messageBody, data } = body;

    if (!user_id || !title || !messageBody) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fetch the recipient's push token
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', user_id)
      .single();

    if (profileErr || !profile?.push_token) {
      // User hasn't registered for push — not an error
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'no_token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const token: string = profile.push_token;

    // Only send to Expo tokens
    if (!token.startsWith('ExponentPushToken[')) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'invalid_token_format' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Send via Expo Push API
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: token,
        title,
        body: messageBody,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
      }),
    });

    const pushResult = await pushRes.json();

    // If Expo reports the token is invalid/unregistered, clear it from the profile
    const ticket = pushResult?.data;
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      await supabase
        .from('profiles')
        .update({ push_token: null })
        .eq('id', user_id);
    }

    return new Response(
      JSON.stringify({ ok: true, result: pushResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
