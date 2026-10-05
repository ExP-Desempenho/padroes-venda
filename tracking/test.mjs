// node test.mjs — confere assinatura, mapeamento Kiwify->GA4 e o filtro do relay CAPI (fetch mockado).
import assert from 'node:assert';
import { createHmac } from 'node:crypto';
process.env.KIWIFY_TOKEN = 'tok'; process.env.GA4_SECRET = 's'; process.env.META_TOKEN = 'm';
const { POST: kiwify, toGa4 } = await import('./api/kiwify.js');
const { POST: capi } = await import('./api/e.js');
const sent = []; globalThis.fetch = async (url, init) => (sent.push({ url, body: JSON.parse(init.body) }), new Response('{}'));

const order = { order_id: 'o1', webhook_event_type: 'order_approved', payment_method: 'pix',
  Product: { product_id: 'p1', product_name: 'Dia 1' }, Commissions: { charge_amount: 1499 },
  TrackingParameters: { sck: '123.456_789' } };
const body = JSON.stringify(order), sig = createHmac('sha1', 'tok').update(body).digest('hex');
const hook = (b, s) => kiwify(new Request(`https://x/api/kiwify?signature=${s}`, { method: 'POST', body: b }));

assert.equal((await hook(body, 'nope')).status, 401);
assert.equal((await hook(body, sig)).status, 200);
const ga = sent.pop();
assert.match(ga.url, /measurement_id=G-CYZ3LZE0KW&api_secret=s/);
assert.deepEqual([ga.body.client_id, ga.body.events[0].name, ga.body.events[0].params.value, ga.body.events[0].params.session_id], ['123.456', 'purchase', 14.99, '789']);
assert.equal(toGa4({ ...order, webhook_event_type: 'pix_created' }), null);
assert.equal(toGa4({ ...order, webhook_event_type: 'order_refunded' }).events[0].name, 'refund');
assert.equal(toGa4({ ...order, TrackingParameters: {} }).client_id, 'kiwify.o1');

const ev = (origin, e) => capi(new Request('https://x/api/e', { method: 'POST', headers: { origin, 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'UA' }, body: JSON.stringify(e) }));
const ok = { event_name: 'PageView', event_id: 'id1', external_id: 'x', fbp: 'fb.1.1.1' };
assert.equal((await ev('https://evil.com', ok)).status, 403);
assert.equal((await ev('https://padroes.aviradaenem.com.br', { ...ok, event_name: 'Purchase' })).status, 400);
assert.equal((await ev('https://padroes.aviradaenem.com.br', ok)).status, 204);
const m = sent.pop().body.data[0];
assert.deepEqual([m.event_id, m.user_data.client_ip_address, m.user_data.client_user_agent, m.user_data.external_id[0].length], ['id1', '1.2.3.4', 'UA', 64]);
console.log('ok');
