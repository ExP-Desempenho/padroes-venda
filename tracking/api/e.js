// Relay da API de Conversões da Meta: o navegador manda o evento (mesmo event_id do Pixel,
// para deduplicar) e aqui ele ganha IP, user agent e o token, que nunca vai para o front.
import { createHash } from 'node:crypto';

const PIXEL = '1011587088582742';
const ALLOWED = new Set(['PageView', 'ViewContent', 'CheckoutClick', 'ScrollDepth']);
const ORIGIN = /^https:\/\/([a-z0-9-]+\.)*aviradaenem\.com\.br(\/|$)/;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function POST(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!ORIGIN.test(origin)) return new Response(null, { status: 403 });

  let e;
  try { e = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  if (!ALLOWED.has(e.event_name) || typeof e.event_id !== 'string') return new Response(null, { status: 400 });

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const payload = {
    data: [{
      event_name: e.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.event_id,
      event_source_url: e.event_source_url,
      action_source: 'website',
      user_data: {
        client_ip_address: ip || undefined,
        client_user_agent: request.headers.get('user-agent') || undefined,
        fbp: e.fbp || undefined,
        fbc: e.fbc || undefined,
        external_id: e.external_id ? [sha256(String(e.external_id))] : undefined,
      },
      custom_data: e.custom_data || {},
    }],
    test_event_code: e.test_event_code || undefined,
  };

  const r = await fetch(`https://graph.facebook.com/v24.0/${PIXEL}/events?access_token=${process.env.META_TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error('capi', r.status, await r.text());
  return new Response(null, { status: 204 });
}
