import { products, modifiers, ingredients, initialState, makeLine, cartTotal, addToCart, checkout, changeOrder, dailySummary, businessDate, money, readSaved } from './domain.mjs';

const key = 'afk-cafe-workflow-v1';
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date().toISOString();
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const clock = value => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const names = { cash: 'Cash', gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer', card: 'Card' };
const statusNames = { pending: 'Payment pending', paid: 'Paid', refunded: 'Refunded', queued: 'Queued', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
let state = initialState(), lastSaved = null, storageBlocked = false, cart = [], note = '', category = 'All items', search = '', currentOrder = null, summaryDay = businessDate(now()), attemptId = newId(), toastTimer, modalSubmit;
try { lastSaved = localStorage.getItem(key); state = readSaved(lastSaved); } catch (error) { storageBlocked = true; showStorageError(error.message); }

function icon(name) {
  const paths = { counter: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', orders: '<path d="M7 3h10l2 3v15H5V6zM8 10h8M8 14h8M8 18h5"/>', stock: '<path d="M3 7l9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11M7 5l10 5"/>', summary: '<path d="M4 3v18h17M8 17v-5M13 17V7M18 17v-8"/>', search: '<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/>' };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.counter}</svg>`;
}
function art(product) {
  const fill = product.color;
  const base = '<ellipse cx="90" cy="138" rx="48" ry="8" fill="#554329" opacity=".09"/>';
  let shape;
  if (product.art === 'iced') shape = `<path d="M104 13l-7 99" stroke="#6a624a" stroke-width="5"/><path d="M52 48h77l-9 79q-30 15-59 0z" fill="#f3e8d4" stroke="#c7b99f" stroke-width="1.5"/><path d="M54 58h73l-8 68q-28 13-56 0z" fill="${fill}"/><path d="M57 85q32-12 67 0l-5 41q-28 13-56 0z" fill="#f2e2c4" opacity=".32"/><ellipse cx="90" cy="49" rx="39" ry="10" fill="#f3eee0" stroke="#bcb39e"/><ellipse cx="90" cy="49" rx="32" ry="6" fill="${fill}"/><path d="M104 15l-3 36" stroke="#6a624a" stroke-width="5"/><g fill="#fff" opacity=".45"><rect x="65" y="62" width="16" height="12" rx="3" transform="rotate(-12 65 62)"/><rect x="94" y="67" width="17" height="13" rx="3" transform="rotate(15 94 67)"/><path d="M63 86l4 35" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g><path d="M77 104q12-8 26 0" fill="none" stroke="#fff" stroke-width="1.3" opacity=".55"/>`;
  else if (product.art === 'cup') shape = `<ellipse cx="88" cy="129" rx="52" ry="10" fill="#e3dcc9"/><path d="M124 69c37-7 31 40-4 35" fill="none" stroke="#f9f5e8" stroke-width="12"/><path d="M44 67h83v35c0 38-83 38-83 0z" fill="#faf5e7"/><ellipse cx="85" cy="67" rx="42" ry="12" fill="#d9c7ab"/><ellipse cx="85" cy="67" rx="36" ry="9" fill="${fill}"/><path d="M69 66c-4-11 18-8 16 3 0-13 22-15 17-4L85 74z" fill="#f4e8d0"/><path d="M64 40c-8-10 9-10 1-21M85 36c-8-10 9-10 1-21" fill="none" stroke="#c0b9a4" stroke-width="2" stroke-linecap="round"/>`;
  else if (product.art === 'croissant') shape = `<path d="M33 111C22 79 58 52 91 50c34 2 68 30 56 62l-20-18c-25 18-48 18-73 0z" fill="${fill}" stroke="#a46732" stroke-width="2"/><path d="M56 66l-5 31 20 12 4-53M83 52l-8 57 27 1-3-58M109 57l9 45 15-12-8-21" fill="#dcaa65" stroke="#b97c3c" stroke-width="2"/><path d="M34 100l13-15M132 84l13 17M62 70l-5 19M87 63l-3 28M114 75l4 17" stroke="#f0c383" stroke-width="3" stroke-linecap="round"/>`;
  else shape = `<ellipse cx="90" cy="94" rx="51" ry="43" fill="#92613c"/><ellipse cx="90" cy="88" rx="51" ry="43" fill="${fill}"/><g fill="#543a2a"><path d="M65 62l13 2-4 12-13-3zM101 59l12 6-5 11-12-4zM84 85l13-3 3 14-12 6zM54 94l11-3 7 14-10 4zM112 95l12-4 5 13-14 6zM84 113l11-3 5 10-12 5z"/></g><g fill="#d6ad75"><circle cx="88" cy="67" r="3"/><circle cx="75" cy="93" r="3"/><circle cx="114" cy="84" r="3"/><circle cx="102" cy="110" r="3"/></g>`;
  return `<svg viewBox="0 0 180 155" aria-hidden="true">${base}${shape}</svg>`;
}
function showStorageError(message) { const el = document.querySelector('#storage-warning'); el.hidden = false; el.textContent = `Demo storage: ${message} Your changes have not been saved.`; }
function persist(next) {
  try {
    if (storageBlocked) throw new Error('Saved demo data could not be read. Explicitly reset the demo before creating new records.');
    if (localStorage.getItem(key) !== lastSaved) throw new Error('Data changed in another tab. Reload before continuing.');
    const encoded = JSON.stringify(next);
    localStorage.setItem(key, encoded); lastSaved = encoded; state = next;
    document.querySelector('#storage-warning').hidden = true;
    return true;
  } catch (error) { showStorageError(error.message); return false; }
}
function toast(message) { const el = document.querySelector('#toast'); clearTimeout(toastTimer); el.textContent = message; el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), 4000); }
function badge(value) { return `<span class="badge ${escape(value)}">${escape(statusNames[value] || value)}</span>`; }
function number(order) { return `#${String(order.number).padStart(3, '0')}`; }
function pageHeader(eyebrow, title, subtitle, extra = '') { return `<div class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>${extra}</div>`; }
function route() { const page = location.hash.slice(1).split('/')[0]; return ['counter', 'orders', 'stock', 'summary'].includes(page) ? page : 'counter'; }
function renderNavigation() {
  const active = route();
  const pending = state.orders.filter(o => !['completed', 'cancelled'].includes(o.fulfillment)).length;
  document.querySelector('#navigation').innerHTML = [['counter','Counter'],['orders','Orders'],['stock','Inventory'],['summary','Daily summary']].map(([id,label]) => `<a class="nav-item ${active === id ? 'active' : ''}" href="#${id}" ${active === id ? 'aria-current="page"' : ''} aria-label="${label}" title="${label}">${icon(id)}<span class="nav-label">${label}</span>${id === 'orders' && pending ? `<span class="nav-count">${pending}</span>` : ''}</a>`).join('');
}
function render() {
  renderNavigation();
  if (route() === 'counter') renderCounter();
  if (route() === 'orders') renderOrders();
  if (route() === 'stock') renderStock();
  if (route() === 'summary') renderSummary();
}
function renderCounter() {
  main.innerHTML = pageHeader('A GOOD DAY STARTS HERE', 'At the counter', 'Good coffee. Clear orders. A little less to keep in your head.', '<span class="day-badge">Made for café days</span>') + `<div class="counter-layout"><section aria-label="Café menu"><div class="menu-toolbar"><div class="search-wrap">${icon('search')}<input id="search" type="search" placeholder="Find your next order…" aria-label="Search menu" value="${escape(search)}"></div><span class="product-count">${products.length} menu items</span></div><div class="categories" aria-label="Menu categories">${['All items','Coffee','Non-coffee','Pastries'].map(c => `<button class="category ${c === category ? 'selected' : ''}" data-category="${c}" aria-pressed="${c === category}">${c}</button>`).join('')}</div><div class="product-grid" id="products"></div><p class="menu-caption">A sample menu for your first walkthrough. Sizes and simple add-ons belong to the same base product.</p></section><aside class="cart" id="cart" aria-label="Current order"></aside></div><button class="primary mobile-order" id="mobile-order" data-view-order hidden></button>`;
  renderProducts(); renderCart();
  document.querySelector('#search').addEventListener('input', event => { search = event.target.value; renderProducts(); });
}
function renderProducts() {
  const list = products.filter(p => (category === 'All items' || p.category === category) && `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  document.querySelector('#products').innerHTML = list.map(p => `<button class="product" data-product="${p.id}" aria-label="Add ${p.name}, from ${money(p.sizes[0].price)}"><div class="product-art ${p.id}">${art(p)}${p.id === 'latte' ? '<span class="product-tag">HOUSE FAVOURITE</span>' : ''}</div><div class="product-info"><span class="product-name">${p.name}</span><span class="product-sub">${p.category} · ${p.sizes.length > 1 ? p.sizes.length + ' sizes' : p.sizes[0].label}</span><span class="product-price">${money(p.sizes[0].price)}<span class="plus" aria-hidden="true">+</span></span></div></button>`).join('') || '<div class="empty-state"><p>No menu items found. Try another search.</p></div>';
}
function renderCart() {
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);
  document.querySelector('#cart').innerHTML = `<div class="cart-heading"><div><h2>Current order</h2><small>Counter order · ${count} ${count === 1 ? 'item' : 'items'}</small></div><button class="text-button" data-clear ${!cart.length ? 'disabled' : ''}>Clear</button></div><div class="cart-items">${cart.length ? cart.map(l => `<div class="cart-line"><div class="cart-line-top"><span>${escape(l.name)}</span><span>${money(l.unitPrice * l.quantity)}</span></div><div class="cart-line-detail">${escape(l.size)}${l.modifierNames.length ? ' · ' + l.modifierNames.map(escape).join(', ') : ''}</div><div class="cart-line-bottom"><div class="quantity"><button data-qty="-1" data-key="${l.key}" aria-label="Decrease ${escape(l.name)} quantity">−</button><span aria-label="Quantity">${l.quantity}</span><button data-qty="1" data-key="${l.key}" aria-label="Increase ${escape(l.name)} quantity" ${l.quantity === 99 ? 'disabled' : ''}>+</button></div><button class="text-button" data-remove="${l.key}" aria-label="Remove ${escape(l.name)}">Remove</button></div></div>`).join('') : '<div class="cart-empty"><div class="empty-art" aria-hidden="true">♧</div><strong>A fresh start.</strong>Choose something from the menu<br>to put your first order together.</div>'}</div><div class="cart-bottom"><label class="field-label" for="order-note">Order note <span class="muted">(optional)</span></label><textarea id="order-note" class="cart-note" maxlength="250" placeholder="Less ice, takeaway, a name for pickup…">${escape(note)}</textarea><div class="total-row"><span>Items subtotal</span><span>${money(cartTotal(cart))}</span></div><div class="total-row grand"><span>Total</span><span>${money(cartTotal(cart))}</span></div><button class="primary full-width" data-checkout ${!cart.length ? 'disabled' : ''}>Continue to payment <span aria-hidden="true">→</span></button><p class="cart-footnote">Sample totals · tax and discounts are not modeled.</p></div>`;
  const mobileOrder = document.querySelector('#mobile-order');
  mobileOrder.hidden = !count;
  mobileOrder.textContent = `View order (${count}) · ${money(cartTotal(cart))}`;
  document.querySelector('#order-note').addEventListener('input', event => { note = event.target.value; attemptId = newId(); });
}
function openDialog(content, submit) {
  modalSubmit = submit; dialog.innerHTML = content; dialog.showModal();
}
function closeDialog() { dialog.close(); modalSubmit = null; }
const dialogHeading = title => `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button type="button" class="close-dialog" data-close aria-label="Close dialog">×</button></div>`;
function customize(id) {
  const product = products.find(p => p.id === id);
  openDialog(`<form id="customize"><div class="dialog-body"><div class="dialog-art">${art(product)}</div>${dialogHeading(product.name)}<p class="dialog-subtitle">${product.description}</p><fieldset class="form-field"><legend>Choose a size</legend><div class="choice-grid">${product.sizes.map((s,i) => `<label class="choice"><input type="radio" name="size" value="${s.id}" ${i === 0 ? 'checked' : ''}><span>${s.label}<small>${money(s.price)}</small></span></label>`).join('')}</div></fieldset>${product.modifiers.length ? `<fieldset class="form-field"><legend>Make it yours</legend>${product.modifiers.map(id => `<label class="addon"><input type="checkbox" name="addon" value="${id}">${modifiers[id].name}<span class="price">+${money(modifiers[id].price)}</span></label>`).join('')}</fieldset>` : ''}<div class="form-field"><label for="quantity">Quantity</label><input id="quantity" type="number" name="quantity" min="1" max="99" step="1" value="1" required></div><div class="form-error" role="alert" id="modal-error"></div></div><div class="dialog-footer"><span class="dialog-total" id="custom-total">${money(product.sizes[0].price)}</span><button class="primary" type="submit">Add to order <span aria-hidden="true">+</span></button></div></form>`, event => {
    const data = new FormData(event.target);
    cart = addToCart(cart, makeLine(id, data.get('size'), data.getAll('addon'), Number(data.get('quantity'))));
    attemptId = newId(); closeDialog(); renderCart(); toast(`${product.name} added to the order`);
  });
  dialog.querySelector('form').addEventListener('input', event => {
    const data = new FormData(event.currentTarget);
    try { dialog.querySelector('#custom-total').textContent = money(cartTotal([makeLine(id, data.get('size'), data.getAll('addon'), Number(data.get('quantity')))])); } catch { dialog.querySelector('#custom-total').textContent = 'Check quantity'; }
  });
}
function paymentDialog() {
  openDialog(`<form id="payment"><div class="dialog-body">${dialogHeading('A good order, all set.')}<p class="dialog-subtitle">Record a sample payment for this counter order.</p><fieldset class="form-field"><legend>Payment method</legend><div class="choice-grid">${Object.entries(names).map(([id,label],i) => `<label class="choice"><input type="radio" name="method" value="${id}" ${i === 0 ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><div id="payment-fields"></div><div class="form-error" role="alert" id="modal-error"></div></div><div class="dialog-footer"><span class="dialog-total"><small>Order total</small>${money(cartTotal(cart))}</span><button class="primary" id="payment-submit" type="submit">Record sample sale</button></div></form>`, event => {
    const data = new FormData(event.target);
    const tenderText = String(data.get('tender') || '0');
    if (!/^\d+(\.\d{1,2})?$/.test(tenderText)) throw new Error('Enter a valid cash amount with at most two decimal places.');
    const next = checkout(state, { id: attemptId, lines: cart, method: data.get('method'), tender: Math.round(Number(tenderText) * 100), note, createdAt: now() });
    if (!persist(next)) throw new Error('Could not save this order. Your cart is still here; check the storage message.');
    const order = state.orders.find(o => o.id === attemptId); currentOrder = order.id;
    cart = []; note = ''; attemptId = newId(); closeDialog(); location.hash = '#orders'; render();
    toast(order.payment === 'paid' ? `Sample order ${number(order)} saved · change ${money(order.change)}` : `Order ${number(order)} is awaiting sample payment confirmation`);
  });
  const updateFields = () => {
    const method = dialog.querySelector('input[name=method]:checked').value;
    dialog.querySelector('#payment-fields').innerHTML = method === 'cash' ? `<div class="form-field"><label for="tender">Cash received (₱)</label><input id="tender" name="tender" type="number" min="${cartTotal(cart)/100}" step="0.01" placeholder="${cartTotal(cart)/100}" required inputmode="decimal"><div class="change-line"><span>Change</span><strong id="change">₱0</strong></div></div><p class="payment-help">This records sample cash only. No money is collected.</p>` : '<p class="payment-help">Save as <strong>payment pending</strong>. In the real service, payment needs independent confirmation before preparation. The prototype can only simulate confirmation; it is not connected to a bank or gateway.</p>';
    dialog.querySelector('#payment-submit').textContent = method === 'cash' ? 'Record sample sale' : 'Save pending order';
    dialog.querySelector('#tender')?.addEventListener('input', e => { const diff = Math.round(Number(e.target.value) * 100) - cartTotal(cart); dialog.querySelector('#change').textContent = diff >= 0 ? money(diff) : `${money(-diff)} short`; });
  };
  updateFields(); dialog.querySelectorAll('input[name=method]').forEach(input => input.addEventListener('change', updateFields));
}
function renderOrders() {
  const order = state.orders.find(o => o.id === currentOrder);
  if (order) { renderOrderDetail(order); return; }
  main.innerHTML = pageHeader('EVERY CUP HAS A STORY', 'Your orders', 'Keep the handoff clear, from the counter to the customer.') + (state.orders.length ? `<div class="order-list">${state.orders.map(o => `<button class="order-row" data-order="${o.id}"><div><span class="order-id">Order ${number(o)}</span><small>${escape(businessDate(o.createdAt))} · ${clock(o.createdAt)} · ${names[o.method]}</small></div><div class="order-status">${badge(o.payment)}${badge(o.fulfillment)}</div><span class="order-total">${money(o.total)}</span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>` : '<section class="panel empty-state"><h2>Your first order starts at the counter.</h2><p>Try a sample sale and follow it through<br>payment, preparation and pickup.</p><a class="primary" href="#counter">Take an order →</a></section>');
}
function renderOrderDetail(order) {
  const actions = [];
  if (order.payment === 'pending' && order.fulfillment !== 'cancelled') actions.push(['confirm','Confirm sample payment','primary'],['cancel','Cancel order','secondary']);
  if (order.payment === 'paid') {
    if (order.fulfillment === 'queued') actions.push(['prepare','Start preparation','primary']);
    if (order.fulfillment === 'preparing') actions.push(['ready','Mark ready','primary']);
    if (order.fulfillment === 'ready') actions.push(['complete','Mark collected','primary']);
    actions.push(['refund','Record full refund','danger']);
  }
  main.innerHTML = pageHeader('ORDER DETAIL', `Order ${number(order)}`, `${escape(businessDate(order.createdAt))} · ${clock(order.createdAt)} · Main branch`, '<button class="secondary" data-back-orders>← All orders</button>') + `<div class="two-panels"><section class="panel"><div class="detail-meta">${badge(order.payment)}${badge(order.fulfillment)}</div>${order.lines.map(l => `<div class="detail-line"><div><strong>${l.quantity} × ${escape(l.name)}</strong><small>${escape(l.size)}${l.modifierNames.length ? ' · ' + l.modifierNames.map(escape).join(', ') : ''}</small></div><span>${money(l.unitPrice*l.quantity)}</span></div>`).join('')}${order.note ? `<p class="detail-note">${escape(order.note)}</p>` : ''}<div class="total-row grand"><span>Order total</span><span>${money(order.total)}</span></div><div class="detail-actions">${actions.map(([action,label,style]) => `<button class="${style}" data-action="${action}" data-id="${order.id}">${label}</button>`).join('')}</div></section><section class="panel"><h2>A clear record.</h2><dl class="detail-list"><div><dt>Payment method</dt><dd>${names[order.method]}</dd></div><div><dt>Payment status</dt><dd>${statusNames[order.payment]}</dd></div>${order.method === 'cash' ? `<div><dt>Cash received</dt><dd>${money(order.tender)}</dd></div><div><dt>Change given</dt><dd>${money(order.change)}</dd></div>` : ''}<div><dt>Ingredient usage</dt><dd>${order.consumed ? 'Recorded at preparation' : 'Not consumed'}</dd></div><div><dt>Order channel</dt><dd>Counter</dd></div></dl>${order.refundedAt ? `<p class="detail-note"><strong>Full refund: ${money(order.total)}</strong><br>${escape(order.refundReason)}<br><span class="muted">${businessDate(order.refundedAt)} · ${clock(order.refundedAt)}</span></p>` : ''}<p class="summary-note">${order.payment === 'pending' && order.fulfillment !== 'cancelled' ? 'Confirm payment before starting preparation. An order submission alone does not mean the payment succeeded.' : order.payment === 'refunded' ? 'The financial refund is recorded separately. Ingredients used for a prepared drink stay consumed.' : order.consumed ? 'Ingredients were deducted once when preparation started. Completing or refunding the order will not deduct them again.' : 'Ingredients have not been deducted yet. The proposed flow records usage when preparation starts.'}</p><p class="small muted">Sample transaction only. This is not a fiscal invoice or proof of a real payment. No customer document has been sent.</p></section></div>`;
}
function orderAction(id, action) {
  if (action === 'refund' || action === 'confirm' || action === 'cancel') {
    const order = state.orders.find(o => o.id === id);
    const title = action === 'refund' ? 'Record a full refund' : action === 'confirm' ? 'Confirm sample payment' : 'Cancel this order?';
    const help = action === 'refund' ? `Record ${money(order.total)} as refunded. ${order.consumed ? 'Already consumed ingredients will stay deducted.' : 'No ingredients have been consumed.'} No real money is returned.` : action === 'confirm' ? 'This only marks the sample order paid. For real orders, staff must independently confirm the payment in the approved merchant channel.' : 'This unpaid order will stop here. No payment or ingredient movement will be recorded.';
    openDialog(`<form><div class="dialog-body">${dialogHeading(title)}<p class="dialog-subtitle">${help}</p>${action === 'refund' ? '<div class="form-field"><label for="refund-reason">Reason for refund</label><textarea id="refund-reason" name="reason" minlength="3" maxlength="250" required placeholder="What happened with this order?"></textarea></div>' : ''}<div class="form-error" id="modal-error" role="alert"></div></div><div class="dialog-footer"><button class="secondary" type="button" data-close>Go back</button><button class="${action === 'refund' ? 'danger' : 'primary'}" type="submit">${action === 'refund' ? 'Record sample refund' : action === 'confirm' ? 'Mark sample paid' : 'Cancel order'}</button></div></form>`, event => {
      const next = changeOrder(state,id,action,now(),new FormData(event.target).get('reason') || '');
      if (!persist(next)) throw new Error('Could not save this change. Check the storage message.');
      closeDialog(); render(); toast(action === 'refund' ? 'Sample refund recorded. Ingredient usage preserved.' : 'Sample order updated');
    });
    return;
  }
  try { const next = changeOrder(state,id,action,now()); if (persist(next)) { render(); toast(action === 'prepare' ? 'Preparation started. Ingredient usage recorded once.' : 'Order updated'); } } catch (error) { toast(error.message); }
}
function renderStock() {
  main.innerHTML = pageHeader('KNOW WHAT’S ON YOUR SHELVES', 'Simple stock, clear picture.', 'Sample opening stock, with recipe usage from prepared orders.') + `<div class="two-panels"><section class="panel"><h2>Ingredients & stock</h2><div class="table-wrap"><table><thead><tr><th>Item</th><th>On hand</th><th>Status</th></tr></thead><tbody>${Object.entries(ingredients).map(([id,i]) => `<tr><td>${i.name}<div class="stock-bar ${state.stock[id] <= i.low ? 'low' : ''}"><span style="width:${Math.max(0,Math.min(100,state.stock[id]/i.initial*100))}%"></span></div></td><td>${new Intl.NumberFormat('en-PH').format(state.stock[id])} <span class="muted">${i.unit}</span></td><td><span class="badge ${state.stock[id] <= i.low ? 'pending' : 'paid'}">${state.stock[id] <= i.low ? 'Running low' : 'In stock'}</span></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h2>Recent ingredient usage</h2>${state.movements.length ? state.movements.slice(0,12).map(m => `<div class="movement"><div>${ingredients[m.item].name}<small>Order ${number(state.orders.find(o => o.id === m.orderId))} · ${clock(m.at)}</small></div><strong>${m.quantity} ${ingredients[m.item].unit}</strong></div>`).join('') : '<p class="small muted">No movements yet. Prepare a sample order to see its ingredient usage here.</p>'}<p class="summary-note">The prototype records consumption at preparation. Receiving, count adjustments and recipe editing are specified for the production build.</p></section></div>`;
}
function renderSummary() {
  const summary = dailySummary(state, summaryDay);
  main.innerHTML = pageHeader('A MOMENT TO TAKE STOCK', 'Your day, at a glance.', 'Sample payments and refunds, grouped by Philippine business date.', `<div class="day-picker"><label for="summary-day">Business date</label><input id="summary-day" type="date" value="${summaryDay}"></div>`) + `<div class="stats"><div class="stat accent"><span class="stat-label">PAYMENTS LESS REFUNDS</span><span class="stat-value">${money(summary.net)}</span><small>Recorded net receipts, not profit</small></div><div class="stat"><span class="stat-label">PAYMENTS RECORDED</span><span class="stat-value">${money(summary.gross)}</span><small>${summary.paidOrders} paid ${summary.paidOrders === 1 ? 'order' : 'orders'}</small></div><div class="stat"><span class="stat-label">REFUNDS RECORDED</span><span class="stat-value">${money(summary.refunds)}</span><small>Refund events on this date</small></div><div class="stat"><span class="stat-label">ORDERS COMPLETED</span><span class="stat-value">${summary.completed}</span><small>Collected on this date</small></div></div><div class="two-panels"><section class="panel"><h2>Payment breakdown</h2><table><thead><tr><th>Method</th><th>Payments</th><th>Refunds</th></tr></thead><tbody>${Object.entries(summary.methods).map(([method,values]) => `<tr><td>${names[method]}</td><td>${money(values.paid)}</td><td>${money(values.refunded)}</td></tr>`).join('')}</tbody></table></section><section class="panel"><h2>A simpler close.</h2><p class="small muted">Pending payments stay out of these totals. A later refund appears on its own date, without changing the original payment date.</p><p class="summary-note">Your basic daily view keeps the essentials close. Trends, product performance and branch comparisons are planned paid capabilities.</p><p class="small muted">Sample totals exclude taxes, discounts and expenses. They are not an accounting or tax report.</p><a class="view-link" href="#orders">Review the orders →</a></section></div>`;
  document.querySelector('#summary-day').addEventListener('change', event => { if(event.target.value) { summaryDay = event.target.value; renderSummary(); } });
}

main.addEventListener('click', event => {
  const target = event.target.closest('button'); if (!target) return;
  if (target.dataset.category) { category = target.dataset.category; document.querySelectorAll('[data-category]').forEach(b => { b.classList.toggle('selected',b.dataset.category === category); b.setAttribute('aria-pressed', b.dataset.category === category); }); renderProducts(); }
  if (target.dataset.product) customize(target.dataset.product);
  if (target.hasAttribute('data-clear')) { cart = []; note = ''; attemptId = newId(); renderCart(); }
  if (target.dataset.qty) { const line = cart.find(l => l.key === target.dataset.key); if (line) { line.quantity += Number(target.dataset.qty); cart = cart.filter(l => l.quantity > 0); attemptId = newId(); renderCart(); } }
  if (target.dataset.remove) { cart = cart.filter(l => l.key !== target.dataset.remove); attemptId = newId(); renderCart(); }
  if (target.hasAttribute('data-checkout')) paymentDialog();
  if (target.hasAttribute('data-view-order')) { document.querySelector('#cart').scrollIntoView({block:'start'}); document.querySelector('[data-checkout]').focus({preventScroll:true}); }
  if (target.dataset.order) { currentOrder = target.dataset.order; renderOrders(); }
  if (target.hasAttribute('data-back-orders')) { currentOrder = null; renderOrders(); }
  if (target.dataset.action) orderAction(target.dataset.id, target.dataset.action);
});
dialog.addEventListener('click', event => { if (event.target.closest('[data-close]')) closeDialog(); });
dialog.addEventListener('submit', event => { event.preventDefault(); try { modalSubmit?.(event); } catch (error) { const box = dialog.querySelector('#modal-error'); if (box) { box.textContent = error.message; box.setAttribute('tabindex','-1'); box.focus(); } } });
dialog.addEventListener('close', () => { modalSubmit = null; });
document.querySelector('#reset').addEventListener('click', () => {
  openDialog(`<form><div class="dialog-body">${dialogHeading('A fresh start?')}<p class="dialog-subtitle">Delete this browser's sample orders and restore the starting menu and ingredient stock. This only affects the demo.</p><div class="form-error" id="modal-error" role="alert"></div></div><div class="dialog-footer"><button class="secondary" type="button" data-close>Keep my samples</button><button class="danger" type="submit">Reset demo data</button></div></form>`, () => {
    const fresh = initialState();
    try { const raw = JSON.stringify(fresh); localStorage.setItem(key,raw); lastSaved = raw; state = fresh; storageBlocked = false; } catch { throw new Error('Browser storage is unavailable. The demo could not be reset.'); }
    cart = []; note = ''; currentOrder = null; attemptId = newId(); document.querySelector('#storage-warning').hidden = true;
    closeDialog(); render(); toast('Demo reset. Ready for another café day.');
  });
});
window.addEventListener('hashchange', () => { if(route() !== 'orders') currentOrder = null; render(); });
window.addEventListener('storage', event => { if(event.key === key || event.key === null) { showStorageError('The demo changed in another tab. Reload before continuing.'); } });
document.querySelector('#date').textContent = new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date());
render();
