# Clarion Net — Couple

The coupling library. Wrap any API call and Clarion Net checks the response
before your code touches it.

## The idea

Your API does what it does. Clarion Net couples with it — like SSL couples
with the web. Not a replacement. Infrastructure.

```js
const { couple } = require('./couple.js');

const getUsers = couple(
  (id) => fetch('https://api.example.com/users/' + id).then((r) => r.json())
);

const { verdict, data, findings } = await getUsers(7);
// verdict: 'PASS' | 'HEALED' | 'HOLD'
```

## What happens

Every response runs through four checks: schema drift, content scan,
injection check, timing anomaly.

- **PASS** — the response is clean. `data` is your response, untouched.
- **HEALED** — something was wrong and got fixed. A poisoned field is
  redacted, the rest passes through. Your app keeps working.
- **HOLD** — nothing safe could be salvaged. Throws by default (catch it),
  or returns `{ verdict: 'HOLD', data: null }` with `onHold: 'return'`.
  The hold ships with the reason, the evidence, and what would fix it.

## Options

```js
couple(apiFn, {
  onHeal: 'auto',   // 'auto' (default): hand back the healed value
                    // 'flag': hand back the original, list what would change
  onHold: 'throw',  // 'throw' (default): throw with code 'APIGATE_HOLD'
                    // 'return': return the envelope with data: null
  baseline,         // { schema, timings } from diagnose.js --save-baseline
  name,             // label for this call in the decision log
});
```

## The rules

- Your function runs exactly as before. Same args, same `this`.
  Sync stays sync, async stays async.
- If your function throws (network down, timeout), the throw passes
  through untouched. The gate never invents a verdict for a call that
  never returned.
- Decisions are logged as digests, never bodies. Your data stays yours.
- Zero dependencies. Node builtins only.

## Fail posture

Fail-closed on trust, fail-open on availability. A check that can't run
is a HOLD, never a pass. A gate that's down doesn't block your business —
but nothing unchecked is ever marked clean.
