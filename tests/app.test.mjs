import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the browser controller without making requests to a live project.
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  .replace("import { supabase } from './supabase-client.js';", '');
function harness(configured = true) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) {
      const classes = new Set();
      elements.set(selector, {
        textContent: '', innerHTML: '', value: '', files: [], dataset: {}, handlers: {},
        classList: { add: x => classes.add(x), remove: x => classes.delete(x),
          contains: x => classes.has(x), toggle(x, force) { if (force) classes.add(x); else classes.delete(x); } },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        setAttribute() {}, getAttribute() { return 'true'; }, querySelectorAll() { return []; }, reset() {}, focus() {}
      });
    }
    return elements.get(selector);
  };
  const calls = [];
  let rows = [];
  let authCallback;
  let removed = 0;
  const intervals = new Set();
  const supabase = {
    auth: {
      onAuthStateChange(cb) { authCallback = cb; },
      async signUp(args) { calls.push(['signup', args]); return { data: { session: null }, error: null }; },
      async signInWithPassword(args) { calls.push(['signin', args]); return { error: null }; },
      async resend(args) { calls.push(['resend', args]); return { error: null }; },
      async signOut() { authCallback('SIGNED_OUT', null); return { error: null }; }
    },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    removeChannel() { removed++; },
    from(table) {
      assert.equal(table, 'listings');
      return {
        select() { return { async eq() { return { data: rows, error: null }; } }; },
        insert(input) { calls.push(['insert', input]); return { async select() {
          return { data: input.map((row, i) => ({ ...row, id: `new-${i}` })), error: null };
        } }; }
      };
    }
  };
  const context = vm.createContext({
    supabase: configured ? supabase : null, console, URL, Date,
    window: { location: { href: 'http://localhost:3000/' }, alert() {}, confirm: () => true },
    document: { querySelector: element, querySelectorAll: () => [] },
    setTimeout: callback => callback(),
    setInterval: callback => { intervals.add(callback); return callback; }, clearInterval: id => intervals.delete(id),
    FormData: class { get(key) { return { foodType: 'Apples', category: 'Fruit', notes: '', stockLevel: 'high' }[key]; } }
  });
  vm.runInContext(source, context);
  return { element, calls, context, intervals, get removed() { return removed; },
    setRows(value) { rows = value; }, auth(user) { authCallback('SIGNED_IN', user ? { user } : null); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const missing = harness(false);
assert.match(missing.element('#authStatus').textContent, /not connected/);
const app = harness();
app.element('#email').value = 'student@calpoly.edu';
app.element('#password').value = 'test-password';
await app.element('#createAccount').handlers.click();
assert.equal(app.calls[0][0], 'signup');
assert.equal(app.calls[0][1].options.emailRedirectTo, 'http://localhost:3000/');
assert.equal(app.element('#verificationPanel').classList.contains('hidden'), false);
await app.element('#resendVerification').handlers.click();
assert.equal(app.calls[1][1].email, 'student@calpoly.edu');
app.auth({ email: 'student@calpoly.edu', email_confirmed_at: '2026-01-01' });
await tick();
assert.equal(app.element('#top').classList.contains('hidden'), false);
assert.equal(app.element('[data-role="staff"]').classList.contains('hidden'), true);
assert.equal(app.intervals.size, 1);
app.auth({ email: 'outsider@example.com', email_confirmed_at: '2026-01-01' });
assert.equal(app.element('#top').classList.contains('hidden'), true);
assert.equal(app.intervals.size, 0);
app.auth({ email: 'pantry-staff@calpoly.edu', email_confirmed_at: null });
assert.equal(app.element('#top').classList.contains('hidden'), true);
app.auth({ email: 'pantry-staff@calpoly.edu', email_confirmed_at: '2026-01-01' });
await tick();
await app.element('#listingForm').handlers.submit({ preventDefault() {} });
assert.equal(app.calls.at(-1)[0], 'insert');
assert.equal(app.calls.at(-1)[1][0].foodType, 'Apples');
assert.match(app.element('#listingFeed').innerHTML, /Apples/);
app.auth(null);
await tick();
assert.equal(app.element('#listingFeed').innerHTML, '');
assert.equal(app.intervals.size, 0);
assert.ok(app.removed >= 2);
console.log('Passed: configuration, signup/resend, access UI, inventory insert, and subscription cleanup.');

const rejected = harness();
rejected.auth({ email: 'pantry-staff@calpoly.edu', email_confirmed_at: '2026-01-01' });
await tick();
vm.runInContext("insertListings = async () => { throw { code: '42501', message: 'new row violates row-level security policy' }; };", rejected.context);
await rejected.element('#listingForm').handlers.submit({ preventDefault() {} });
assert.match(rejected.element('#formStatus').textContent, /Run the updated supabase\/schema.sql/);
assert.match(rejected.element('#formStatus').textContent, /pantry-staff@calpoly.edu/);
vm.runInContext("insertListings = async () => { throw { code: 'PGRST204', message: 'Column missing from schema cache' }; };", rejected.context);
await rejected.element('#listingForm').handlers.submit({ preventDefault() {} });
assert.match(rejected.element('#formStatus').textContent, /Column missing from schema cache \(PGRST204\)/);
console.log('Passed: denied saves provide setup guidance; other failures preserve the backend error.');

app.auth({ email: 'vlebed@calpoly.edu', email_confirmed_at: '2026-01-01' });
await tick();
assert.equal(app.element('#top').classList.contains('hidden'), false);
assert.equal(app.element('[data-role="staff"]').classList.contains('hidden'), true);
assert.equal(app.element('#listingForm').classList.contains('hidden'), true);
console.log('Passed: former administrator retains browsing access without staff controls.');

const persistent = harness();
persistent.setRows([
  { id: 'old', foodType: 'Rice from last month', category: 'Grains', quantity: 5, stockDate: '2020-01-01' },
  { id: 'empty', foodType: 'Out of stock beans', category: 'Canned food', quantity: 0, stockDate: '2020-01-01' }
]);
persistent.auth({ email: 'pantry-staff@calpoly.edu', email_confirmed_at: '2026-01-01' });
await tick();
assert.match(persistent.element('#listingFeed').innerHTML, /Rice from last month/);
assert.match(persistent.element('#staffInventory').innerHTML, /Rice from last month/);
assert.doesNotMatch(persistent.element('#listingFeed').innerHTML, /Out of stock beans/);
assert.match(persistent.element('#staffInventory').innerHTML, /Out of stock beans/);
persistent.setRows([]);
await vm.runInContext('refreshListings()', persistent.context);
assert.equal(persistent.element('#listingFeed').innerHTML, '');
console.log('Passed: older inventory remains visible, zero stock stays hidden from students, and removed rows disappear.');
