// Shared helpers used by sellapay-callback and nowpayments-callback to
// activate Go Live sessions / viewer passes by external order/reference id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AnyClient = ReturnType<typeof createClient>;

async function provisionDailyRoom(name: string, expSeconds: number): Promise<string | null> {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) return null;
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      privacy: 'public',
      properties: { exp: expSeconds, enable_chat: true, enable_screenshare: false, max_participants: 50 },
    }),
  });
  if (!res.ok) {
    console.error('Daily room create failed:', res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json.url ?? null;
}

/**
 * Try to activate a live_sessions row by id. Returns true if matched.
 */
export async function tryActivateLiveSession(
  service: AnyClient,
  candidateIds: string[],
  isSuccess: boolean,
): Promise<boolean> {
  for (const id of candidateIds) {
    const { data: row } = await service
      .from('live_sessions')
      .select('id, host_id, duration_hours, status')
      .eq('id', id)
      .maybeSingle();
    if (!row) continue;

    if (row.status === 'active') return true;

    if (!isSuccess) {
      await service.from('live_sessions').update({ status: 'canceled' }).eq('id', row.id);
      return true;
    }

    const durationMs = Number(row.duration_hours) * 60 * 60 * 1000;
    const startedAt = new Date();
    const expiresAt = new Date(Date.now() + durationMs);
    const roomName = `live-${row.id.slice(0, 12)}`;
    const roomUrl = await provisionDailyRoom(roomName, Math.floor(expiresAt.getTime() / 1000));

    await service
      .from('live_sessions')
      .update({
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        daily_room_url: roomUrl,
        daily_room_name: roomName,
      })
      .eq('id', row.id);

    console.log('Live session activated:', row.id, 'until', expiresAt.toISOString());
    return true;
  }
  return false;
}

/**
 * Try to activate a live_passes row by id. Returns true if matched.
 */
export async function tryActivateLivePass(
  service: AnyClient,
  candidateIds: string[],
  isSuccess: boolean,
): Promise<boolean> {
  for (const id of candidateIds) {
    const { data: row } = await service
      .from('live_passes')
      .select('id, viewer_id, session_id, duration_hours, status')
      .eq('id', id)
      .maybeSingle();
    if (!row) continue;

    if (row.status === 'active') return true;

    if (!isSuccess) {
      await service.from('live_passes').update({ status: 'canceled' }).eq('id', row.id);
      return true;
    }

    const durationMs = Number(row.duration_hours) * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    await service
      .from('live_passes')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', row.id);

    console.log('Live pass activated:', row.id, 'until', expiresAt.toISOString());
    return true;
  }
  return false;
}
