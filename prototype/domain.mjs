// Prototype business rules. No network, payment processing or SaaS authorization.
export const ingredients = {
  coffee: { name: 'House espresso beans', unit: 'g', initial: 1200, low: 250 },
  milk: { name: 'Fresh milk', unit: 'mL', initial: 6000, low: 1500 },
  matcha: { name: 'Ceremonial matcha', unit: 'g', initial: 250, low: 50 },
  chocolate: { name: 'Chocolate sauce', unit: 'mL', initial: 500, low: 100 },
  vanilla: { name: 'Vanilla syrup', unit: 'mL', initial: 500, low: 100 },
  croissant: { name: 'Butter croissants', unit: 'pcs', initial: 12, low: 5 },
  cookie: { name: 'Chocolate cookies', unit: 'pcs', initial: 18, low: 5 },
  tea: { name: 'Earl Grey sachets', unit: 'pcs', initial: 40, low: 10 },
};
export const modifiers = {
  shot: { name: 'Extra espresso shot', price: 2500, recipe: { coffee: 9 } },
  vanilla: { name: 'Vanilla syrup', price: 2000, recipe: { vanilla: 15 } },
};
export const products = [
  { id: 'latte', name: 'Iced latte', category: 'Coffee', description: 'Espresso, fresh milk, a little pause.', art: 'iced', color: '#d6b69b', sizes: [{ id: 'regular', label: '12 oz', price: 12000, recipe: { coffee: 18, milk: 180 } }, { id: 'large', label: '16 oz', price: 14500, recipe: { coffee: 18, milk: 260 } }], modifiers: ['shot', 'vanilla'] },
  { id: 'americano', name: 'Iced americano', category: 'Coffee', description: 'Our house blend, clean and bold.', art: 'iced', color: '#6c412b', sizes: [{ id: 'regular', label: '12 oz', price: 9500, recipe: { coffee: 18 } }, { id: 'large', label: '16 oz', price: 11500, recipe: { coffee: 27 } }], modifiers: ['shot'] },
  { id: 'matcha', name: 'Matcha latte', category: 'Non-coffee', description: 'Earthy matcha meets creamy milk.', art: 'iced', color: '#809462', sizes: [{ id: 'regular', label: '12 oz', price: 14500, recipe: { matcha: 3, milk: 180 } }, { id: 'large', label: '16 oz', price: 17000, recipe: { matcha: 4, milk: 260 } }], modifiers: ['vanilla'] },
  { id: 'flatwhite', name: 'Flat white', category: 'Coffee', description: 'Velvety milk. A rich double shot.', art: 'cup', color: '#b28159', sizes: [{ id: 'regular', label: '8 oz', price: 11500, recipe: { coffee: 18, milk: 120 } }], modifiers: ['shot'] },
  { id: 'mocha', name: 'Iced mocha', category: 'Coffee', description: 'Espresso with a chocolate finish.', art: 'iced', color: '#997051', sizes: [{ id: 'regular', label: '12 oz', price: 14000, recipe: { coffee: 18, milk: 160, chocolate: 25 } }, { id: 'large', label: '16 oz', price: 16500, recipe: { coffee: 18, milk: 240, chocolate: 35 } }], modifiers: ['shot'] },
  { id: 'croissant', name: 'Butter croissant', category: 'Pastries', description: 'Golden layers, baked for slow mornings.', art: 'croissant', color: '#c58942', sizes: [{ id: 'regular', label: 'One piece', price: 8500, recipe: { croissant: 1 } }], modifiers: [] },
  { id: 'cookie', name: 'Chocolate cookie', category: 'Pastries', description: 'Soft centre. Generous chocolate chunks.', art: 'cookie', color: '#bb864c', sizes: [{ id: 'regular', label: 'One piece', price: 6500, recipe: { cookie: 1 } }], modifiers: [] },
  { id: 'tea', name: 'Earl Grey', category: 'Non-coffee', description: 'A bright, fragrant afternoon favourite.', art: 'cup', color: '#9b7652', sizes: [{ id: 'regular', label: '8 oz', price: 8500, recipe: { tea: 1 } }], modifiers: [] },
];

export const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: value % 100 === 0 ? 0 : 2 }).format(value / 100);
export const businessDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function initialState() { return { version: 1, revision: 0, orders: [], stock: Object.fromEntries(Object.entries(ingredients).map(([id, i]) => [id, i.initial])), movements: [] }; }
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function quantity(value) { requireValue(Number.isInteger(value) && value >= 1 && value <= 99, 'Quantity must be a whole number from 1 to 99.'); }
function validTime(value) { requireValue(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'A valid transaction time is required.'); }

export function makeLine(productId, sizeId, modifierIds = [], qty = 1) {
  quantity(qty);
  const product = products.find(p => p.id === productId);
  requireValue(product, 'Choose an available product.');
  const size = product.sizes.find(s => s.id === sizeId);
  requireValue(size, 'Choose an available size.');
  requireValue(Array.isArray(modifierIds) && new Set(modifierIds).size === modifierIds.length, 'Choose each add-on once.');
  requireValue(modifierIds.every(id => product.modifiers.includes(id)), 'This add-on is unavailable for that product.');
  const selected = [...modifierIds].sort();
  const recipe = { ...size.recipe };
  for (const id of selected) for (const [ingredient, amount] of Object.entries(modifiers[id].recipe)) recipe[ingredient] = (recipe[ingredient] || 0) + amount;
  return { key: [productId, sizeId, ...selected].join(':'), productId, name: product.name, sizeId, size: size.label, modifierIds: selected, modifierNames: selected.map(id => modifiers[id].name), quantity: qty, unitPrice: size.price + selected.reduce((sum, id) => sum + modifiers[id].price, 0), recipe };
}
export const cartTotal = lines => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
export function addToCart(lines, line) {
  const next = structuredClone(lines);
  const existing = next.find(l => l.key === line.key);
  if (existing) { quantity(existing.quantity + line.quantity); existing.quantity += line.quantity; }
  else next.push(structuredClone(line));
  return next;
}

export function checkout(state, request) {
  const { id, method, tender = 0, note = '', createdAt } = request;
  requireValue(typeof id === 'string' && id.length > 0 && id.length <= 100, 'A checkout ID is required.');
  requireValue(['cash', 'gcash', 'maya', 'bank', 'card'].includes(method), 'Choose a payment method.');
  requireValue(typeof note === 'string' && note.trim().length <= 250, 'Keep the order note within 250 characters.');
  requireValue(Array.isArray(request.lines) && request.lines.length > 0, 'Add an item before checkout.');
  const lines = request.lines.map(l => makeLine(l.productId, l.sizeId, l.modifierIds, l.quantity));
  const total = cartTotal(lines);
  requireValue(Number.isSafeInteger(total) && total > 0, 'Invalid order total.');
  requireValue(Number.isSafeInteger(tender) && tender >= 0, 'Enter a valid received amount.');
  const signature = JSON.stringify({ lines, method, tender: method === 'cash' ? tender : 0, note: note.trim() });
  const existing = state.orders.find(o => o.id === id);
  if (existing) { requireValue(existing.signature === signature, 'This checkout ID was already used for another cart.'); return state; }
  validTime(createdAt);
  requireValue(method !== 'cash' || tender >= total, 'Cash received is less than the total.');
  const next = structuredClone(state);
  next.orders.unshift({ id, number: next.orders.length + 1, signature, lines, total, method, tender: method === 'cash' ? tender : 0, change: method === 'cash' ? tender - total : 0, note: note.trim(), createdAt, paidAt: method === 'cash' ? createdAt : null, refundedAt: null, refundReason: '', payment: method === 'cash' ? 'paid' : 'pending', fulfillment: 'queued', consumed: false });
  next.revision++;
  return next;
}

export function changeOrder(state, id, action, at, reason = '') {
  validTime(at);
  const next = structuredClone(state);
  const order = next.orders.find(o => o.id === id);
  requireValue(order, 'Order not found.');
  requireValue(Date.parse(at) >= Date.parse(order.createdAt), 'An action cannot happen before the order was created.');
  if (action === 'confirm') {
    if (order.payment === 'paid') return state;
    requireValue(order.payment === 'pending' && order.fulfillment !== 'cancelled', 'This order cannot be confirmed.');
    order.payment = 'paid'; order.paidAt = at;
  } else if (action === 'prepare') {
    requireValue(order.payment === 'paid' && order.fulfillment !== 'cancelled', 'Confirm payment before preparing this order.');
    if (order.consumed) return state;
    requireValue(order.fulfillment === 'queued', 'Only queued orders can begin preparation.');
    const usage = {};
    for (const line of order.lines) for (const [item, qty] of Object.entries(line.recipe)) usage[item] = (usage[item] || 0) + qty * line.quantity;
    for (const [item, qty] of Object.entries(usage)) requireValue(next.stock[item] >= qty, `Not enough ${ingredients[item].name.toLowerCase()} to prepare this order.`);
    for (const [item, qty] of Object.entries(usage)) { next.stock[item] -= qty; next.movements.unshift({ orderId: id, item, quantity: -qty, at, reason: 'Preparation' }); }
    order.consumed = true; order.fulfillment = 'preparing'; order.preparedAt = at;
  } else if (action === 'ready') {
    if (order.fulfillment === 'ready' && order.payment === 'paid') return state;
    requireValue(order.payment === 'paid' && order.fulfillment === 'preparing', 'Prepare the order before marking it ready.');
    order.fulfillment = 'ready';
  } else if (action === 'complete') {
    if (order.fulfillment === 'completed' && order.payment === 'paid') return state;
    requireValue(order.payment === 'paid' && order.fulfillment === 'ready', 'Only a paid, ready order can be completed.');
    order.fulfillment = 'completed'; order.completedAt = at;
  } else if (action === 'cancel') {
    if (order.fulfillment === 'cancelled' && order.payment === 'pending') return state;
    requireValue(order.payment === 'pending' && order.fulfillment === 'queued', 'A paid order needs a refund, not cancellation.');
    order.fulfillment = 'cancelled'; order.cancelledAt = at;
  } else if (action === 'refund') {
    if (order.payment === 'refunded') return state;
    requireValue(order.payment === 'paid', 'Only a paid order can be refunded.');
    requireValue(typeof reason === 'string' && reason.trim().length >= 3 && reason.trim().length <= 250, 'Enter a refund reason (3–250 characters).');
    requireValue(Date.parse(at) >= Date.parse(order.paidAt), 'A refund cannot precede payment.');
    order.payment = 'refunded'; order.refundedAt = at; order.refundReason = reason.trim();
    if (order.fulfillment !== 'completed') order.fulfillment = 'cancelled';
    // Do not restore consumed ingredients from a prepared drink.
  } else throw new Error('Unknown order action.');
  next.revision++;
  return next;
}

export function dailySummary(state, day) {
  const paid = state.orders.filter(o => o.paidAt && businessDate(o.paidAt) === day);
  const refunded = state.orders.filter(o => o.refundedAt && businessDate(o.refundedAt) === day);
  const gross = paid.reduce((sum, o) => sum + o.total, 0);
  const refunds = refunded.reduce((sum, o) => sum + o.total, 0);
  const methods = Object.fromEntries(['cash', 'gcash', 'maya', 'bank', 'card'].map(method => [method, { paid: paid.filter(o => o.method === method).reduce((sum, o) => sum + o.total, 0), refunded: refunded.filter(o => o.method === method).reduce((sum, o) => sum + o.total, 0) }]));
  return { gross, refunds, net: gross - refunds, paidOrders: paid.length, completed: state.orders.filter(o => o.completedAt && businessDate(o.completedAt) === day).length, methods };
}

export function readSaved(raw) {
  if (!raw) return initialState();
  const state = JSON.parse(raw);
  requireValue(state?.version === 1 && Number.isInteger(state.revision) && Array.isArray(state.orders) && Array.isArray(state.movements) && state.stock && Object.keys(ingredients).every(id => Number.isFinite(state.stock[id])), 'Saved demo data is incompatible. Reset the demo to start again.');
  for (const order of state.orders) requireValue(typeof order.id === 'string' && Number.isInteger(order.total) && Array.isArray(order.lines) && order.lines.every(l => typeof l.name === 'string' && Array.isArray(l.modifierNames) && Number.isInteger(l.quantity)) && ['cash','gcash','maya','bank','card'].includes(order.method) && ['pending','paid','refunded'].includes(order.payment) && ['queued','preparing','ready','completed','cancelled'].includes(order.fulfillment) && Number.isFinite(Date.parse(order.createdAt)), 'Saved demo data is incompatible. Reset the demo to start again.');
  return state;
}
