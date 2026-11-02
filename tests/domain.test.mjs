import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, makeLine, cartTotal, addToCart, checkout, changeOrder, dailySummary, businessDate, readSaved } from '../prototype/domain.mjs';

const time = '2026-11-02T06:00:00.000Z';
const line = () => makeLine('latte', 'large', ['shot'], 2);
const request = overrides => ({ id: 'order-1', lines: [line()], method: 'cash', tender: 50000, createdAt: time, ...overrides });

test('size, modifiers, quantity and cash change use integer centavos', () => {
  assert.equal(cartTotal([line()]), 34000);
  const state = checkout(initialState(), request());
  assert.equal(state.orders[0].change, 16000);
  assert.equal(state.orders[0].payment, 'paid');
  assert.equal(state.stock.coffee, 1200);
});
test('reject invalid options, quantities and cash without modifying state', () => {
  for (const qty of [0, -1, 1.5, 100, NaN]) assert.throws(() => makeLine('latte', 'regular', [], qty));
  assert.throws(() => makeLine('cookie', 'regular', ['shot']));
  assert.throws(() => makeLine('latte', 'regular', ['shot', 'shot']));
  assert.throws(() => makeLine('latte', 'missing'));
  const state = initialState();
  assert.throws(() => checkout(state, request({ tender: 33999 })), /less than/);
  assert.throws(() => checkout(state, request({ tender: 34000.5 })));
  assert.throws(() => checkout(state, request({ lines: [] })));
  assert.equal(state.orders.length, 0);
});
test('cart combines identical configurations, preserves different sizes', () => {
  let cart = addToCart([], line());
  cart = addToCart(cart, line());
  cart = addToCart(cart, makeLine('latte', 'regular'));
  assert.equal(cart.length, 2); assert.equal(cart[0].quantity, 4);
});
test('duplicate checkout is idempotent; changed payload with same key fails', () => {
  const input = request();
  const state = checkout(initialState(), input);
  assert.strictEqual(checkout(state, input), state);
  assert.throws(() => checkout(state, request({ note: 'Changed' })), /already used/);
});
test('checkout recomputes prices and recipes from selected catalogue options', () => {
  const tampered = line(); tampered.unitPrice = 1; tampered.recipe = {};
  const state = checkout(initialState(), request({ lines: [tampered] }));
  assert.equal(state.orders[0].total, 34000);
  assert.equal(state.orders[0].lines[0].recipe.coffee, 27);
});
test('electronic payment stays pending; cannot prepare before confirmation', () => {
  let state = checkout(initialState(), request({ method: 'gcash', tender: 0 }));
  assert.equal(state.orders[0].payment, 'pending');
  assert.throws(() => changeOrder(state, 'order-1', 'prepare', time), /Confirm payment/);
  assert.equal(dailySummary(state, '2026-11-02').gross, 0);
  state = changeOrder(state, 'order-1', 'confirm', time);
  assert.strictEqual(changeOrder(state, 'order-1', 'confirm', time), state);
  assert.equal(dailySummary(state, '2026-11-02').methods.gcash.paid, 34000);
});
test('prepare consumes frozen ingredient quantities exactly once', () => {
  const input = request();
  let state = checkout(initialState(), input);
  input.lines[0].recipe.milk = 9999;
  state = changeOrder(state, 'order-1', 'prepare', time);
  assert.equal(state.stock.milk, 5480); assert.equal(state.stock.coffee, 1146);
  assert.equal(state.movements.length, 2);
  assert.strictEqual(changeOrder(state, 'order-1', 'prepare', time), state);
});
test('stock shortage aborts the entire preparation action', () => {
  const seed = initialState(); seed.stock.milk = 1;
  const state = checkout(seed, request());
  assert.throws(() => changeOrder(state, 'order-1', 'prepare', time), /Not enough/);
  assert.equal(state.stock.coffee, 1200); assert.equal(state.movements.length, 0);
  assert.equal(state.orders[0].fulfillment, 'queued');
});
test('cancel pending order leaves money and ingredients unchanged', () => {
  let state = checkout(initialState(), request({ method: 'maya' }));
  state = changeOrder(state, 'order-1', 'cancel', time);
  assert.equal(state.orders[0].fulfillment, 'cancelled');
  assert.equal(dailySummary(state, '2026-11-02').gross, 0);
  assert.deepEqual(state.stock, initialState().stock);
  assert.throws(() => changeOrder(state, 'order-1', 'confirm', time));
});
test('paid order requires refund rather than cancel, with an explicit reason', () => {
  const state = checkout(initialState(), request());
  assert.throws(() => changeOrder(state, 'order-1', 'cancel', time), /refund/);
  assert.throws(() => changeOrder(state, 'order-1', 'refund', time, ''));
  const next = changeOrder(state, 'order-1', 'refund', time, 'Customer changed their mind');
  assert.deepEqual(next.stock, initialState().stock);
  assert.equal(next.orders[0].payment, 'refunded');
});
test('prepared refund never restores ingredients; repeated refund has one effect', () => {
  let state = checkout(initialState(), request());
  state = changeOrder(state, 'order-1', 'prepare', time);
  state = changeOrder(state, 'order-1', 'refund', time, 'Wrong drink prepared');
  assert.equal(state.stock.coffee, 1146);
  assert.equal(state.orders[0].fulfillment, 'cancelled');
  assert.strictEqual(changeOrder(state, 'order-1', 'refund', time, 'Duplicate'), state);
  assert.throws(() => changeOrder(state, 'order-1', 'ready', time));
  assert.deepEqual({ gross: dailySummary(state, '2026-11-02').gross, net: dailySummary(state, '2026-11-02').net }, { gross: 34000, net: 0 });
});
test('fulfillment requires valid transitions and leaves payment distinct', () => {
  let state = checkout(initialState(), request());
  assert.throws(() => changeOrder(state, 'order-1', 'complete', time));
  for (const action of ['prepare','ready','complete']) state = changeOrder(state, 'order-1', action, time);
  assert.equal(state.orders[0].fulfillment, 'completed');
  assert.equal(state.orders[0].payment, 'paid');
  assert.equal(dailySummary(state, '2026-11-02').completed, 1);
});
test('Manila day boundary and next-day refund use their own event dates', () => {
  assert.equal(businessDate('2026-11-01T16:00:00Z'), '2026-11-02');
  assert.equal(businessDate('2026-11-01T15:59:59Z'), '2026-11-01');
  let state = checkout(initialState(), request());
  state = changeOrder(state, 'order-1', 'refund', '2026-11-02T16:01:00Z', 'Next day correction');
  assert.equal(dailySummary(state, '2026-11-02').net, 34000);
  assert.equal(dailySummary(state, '2026-11-03').refunds, 34000);
  assert.equal(dailySummary(state, '2026-11-03').net, -34000);
});
test('storage reload preserves sample state and rejects incompatible data', () => {
  const state = checkout(initialState(), request());
  assert.deepEqual(readSaved(JSON.stringify(state)), state);
  assert.deepEqual(readSaved(null), initialState());
  assert.throws(() => readSaved('{'));
  assert.throws(() => readSaved(JSON.stringify({ version: 99 })));
});
