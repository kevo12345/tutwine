import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify caller is service_role
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const parts = token.split('.')
  if (parts.length >= 2) {
    try {
      const payload = parts[1]
        .replaceAll('-', '+')
        .replaceAll('_', '/')
        .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
      const claims = JSON.parse(atob(payload))
      if (claims?.role !== 'service_role') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find users who signed up more than 24 hours ago but haven't completed onboarding
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: incompleteProfiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, display_name, created_at')
    .or('onboarding_complete.is.null,onboarding_complete.eq.false')
    .lt('created_at', twentyFourHoursAgo)
    .gt('created_at', sevenDaysAgo) // Only nudge users from last 7 days

  if (profileError) {
    console.error('Failed to fetch incomplete profiles', profileError)
    return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!incompleteProfiles?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No incomplete profiles found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get emails for these users from auth.users
  const userIds = incompleteProfiles.map((p) => p.user_id)
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })

  if (authError) {
    console.error('Failed to fetch auth users', authError)
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Build a map of user_id -> email
  const emailMap = new Map<string, string>()
  for (const u of authUsers.users) {
    if (u.email && userIds.includes(u.id)) {
      emailMap.set(u.id, u.email)
    }
  }

  // Check which users already received a reminder recently (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const emails = Array.from(emailMap.values())

  const { data: recentlySent } = await supabase
    .from('email_send_log')
    .select('recipient_email')
    .eq('template_name', 'onboarding-reminder')
    .in('recipient_email', emails)
    .gte('created_at', threeDaysAgo)

  const alreadySentEmails = new Set((recentlySent ?? []).map((r) => r.recipient_email))

  // Check suppression list
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('email')
    .in('email', emails)

  const suppressedEmails = new Set((suppressed ?? []).map((s) => s.email))

  let enqueued = 0

  for (const profile of incompleteProfiles) {
    const email = emailMap.get(profile.user_id)
    if (!email) continue
    if (alreadySentEmails.has(email)) continue
    if (suppressedEmails.has(email)) continue

    const displayName = profile.display_name || 'there'
    const messageId = `onboarding-reminder-${profile.user_id}-${new Date().toISOString().slice(0, 10)}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#1a1a1a;">Tutwine</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;background:linear-gradient(135deg,#fff5f5,#fff0f0);border-radius:16px;">
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;">
                Hey ${displayName} 👋
              </h2>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4a4a4a;">
                You're almost there! Complete your profile to start discovering amazing people near you.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4a4a4a;">
                It only takes a minute — add your photos and a little about yourself, and you'll be ready to connect.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://tutwine.lovable.app/onboarding" 
                       style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#e8756a,#d4634f);color:#ffffff;text-decoration:none;border-radius:999px;font-size:16px;font-weight:600;">
                      Complete My Profile
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:13px;color:#999999;">
                You received this because you signed up for Tutwine.<br>
                If you no longer wish to receive these emails, you can ignore this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: email,
        from: 'Tutwine <hello@notify.tutwine.com>',
        sender_domain: 'notify.tutwine.com',
        subject: `${displayName}, your profile is almost ready! ✨`,
        html,
        text: `Hey ${displayName}! Complete your Tutwine profile to start discovering people near you. Visit https://tutwine.lovable.app/onboarding`,
        purpose: 'transactional',
        label: 'onboarding-reminder',
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('Failed to enqueue reminder', { email, error: enqueueError })
    } else {
      // Log pending status
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'onboarding-reminder',
        recipient_email: email,
        status: 'pending',
      })
      enqueued++
    }
  }

  console.log(`Onboarding reminders enqueued: ${enqueued}`)

  return new Response(JSON.stringify({ sent: enqueued }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})