// Webhook da Kiwify -> GA4 (Measurement Protocol). Purchase só com compra aprovada;
// reembolso e chargeback viram refund. A Meta recebe o Purchase pela integração nativa da Kiwify.
// O site manda o client_id e o session_id do GA4 no parâmetro sck do checkout ("cid_sid").
import { createHmac, timingSafeEqual } from 'node:crypto';

const GA4 = 'G-CYZ3LZE0KW';
const EVENTS = { order_approved: 'purchase', order_refunded: 'refund', chargeback: 'refund' };

const hmac = (s) => createHmac('sha1', process.env.KIWIFY_TOKEN).update(s).digest('hex');
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function toGa4(o) {
  const name = EVENTS[o.webhook_event_type];
  if (!name) return null;
  const [cid, sid] = String(o.TrackingParameters?.sck || '').split('_');
  const value = Number(o.Commissions?.charge_amount || 0) / 100;
  return {
    client_id: cid || `kiwify.${o.order_id}`,
    events: [{
      name,
      params: {
        transaction_id: o.order_id,
        value,
        currency: 'BRL',
        payment_type: o.payment_method,
        items: [{ item_id: o.Product?.product_id, item_name: o.Product?.product_name, price: value, quantity: 1 }],
        ...(sid && { session_id: sid }),
        engagement_time_msec: 1,
      },
    }],
  };
}

export async function POST(request) {
  const raw = await request.text();
  const sig = new URL(request.url).searchParams.get('signature') || '';
  let o;
  try { o = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  // A Kiwify assina JSON.stringify(body); confere também o corpo cru por garantia.
  if (!same(sig, hmac(JSON.stringify(o))) && !same(sig, hmac(raw))) return new Response('bad signature', { status: 401 });

  const hit = toGa4(o);
  if (!hit) return new Response('ignored');
  const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA4}&api_secret=${process.env.GA4_SECRET}`, {
    method: 'POST',
    body: JSON.stringify(hit),
  });
  return new Response(r.ok ? 'ok' : 'ga4 error', { status: r.ok ? 200 : 502 });
}
