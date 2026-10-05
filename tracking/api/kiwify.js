// Webhook da Kiwify -> GA4 (Measurement Protocol). Purchase só com compra aprovada;
// reembolso e chargeback viram refund. A Meta recebe o Purchase pela integração nativa da Kiwify.
// O site manda o client_id e o session_id do GA4 no parâmetro sck do checkout ("cid_sid").
import { createHmac, timingSafeEqual } from 'node:crypto';

const GA4 = 'G-CYZ3LZE0KW';
const EVENTS = { order_approved: 'purchase', order_refunded: 'refund', chargeback: 'refund' };
// Produtos da Kiwify -> item_id usado no site; qualquer outro produto é ignorado.
const ITEMS = {
  'e5e265a0-bf29-11f1-a201-45f9f5ba0c3c': 'padroes-dia1',
  '72bebaf0-bf2a-11f1-9580-e9065a3d87cc': 'padroes-dia2',
  'ab1de1f0-bf2a-11f1-9f96-6740834cdbc4': 'padroes-combo',
};

// Um webhook por produto na Kiwify, cada um com seu token: KIWIFY_TOKEN="tok1,tok2,tok3".
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const signed = (sig, body) => (process.env.KIWIFY_TOKEN || '').split(',').filter(Boolean)
  .some((t) => same(sig, createHmac('sha1', t).update(body).digest('hex')));

export function toGa4(o) {
  const name = EVENTS[o.webhook_event_type];
  const item_id = ITEMS[o.Product?.product_id];
  if (!name || !item_id) return null;
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
        items: [{ item_id, item_name: o.Product?.product_name, price: value, quantity: 1 }],
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
  if (!signed(sig, JSON.stringify(o)) && !signed(sig, raw)) return new Response('bad signature', { status: 401 });

  const hit = toGa4(o);
  console.log('kiwify', o.webhook_event_type, o.order_id, o.Product?.product_id, hit ? hit.events[0].name : 'ignored');
  if (!hit) return new Response('ignored');
  const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA4}&api_secret=${process.env.GA4_SECRET}`, {
    method: 'POST',
    body: JSON.stringify(hit),
  });
  return new Response(r.ok ? 'ok' : 'ga4 error', { status: r.ok ? 200 : 502 });
}
