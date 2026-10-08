/*
 * couple.js — API GATE: the LIBRARY deployment shape (2026-10-07)
 *
 * "Create a new API, and it's supposed to couple with theirs." (his words)
 * Like SSL for security, Clarion Net is for quality — infrastructure, not a
 * replacement. This module is the coupling: an in-process library the
 * customer's code imports. Same check as the sidecar, zero network hops.
 *
 * Usage:
 *   const { couple } = require('./couple.js');
 *   const getUsers = couple(
 *     (id) => fetch('https://api.example.com/users/' + id).then((r) => r.json()),
 *     { baseline: require('./baseline.json') }   // from diagnose.js --save-baseline
 *   );
 *   const { verdict, data, findings } = await getUsers(7);
 *
 * The wrapper calls the customer's function exactly as before (same args,
 * same `this`; sync stays sync, async stays async) and runs the returned
 * response through the shared verdict engine — gate.js checkResponse, which
 * runs the four checks.js analyzers (schema drift, content scan, injection
 * check, timing anomaly). One verdict implementation, two deployment
 * shapes; the sidecar and the library can never disagree.
 *
 * Envelope (returned for PASS, HEALED, and HOLD-with-onHold:'return'):
 *   { verdict: 'PASS'|'HEALED'|'HOLD', data, findings, digest,
 *     originalDigest, ms, checkedAt, counts, heals?, schemaNote?,
 *     holdReason? }
 *   PASS   — data is the response, untouched.
 *   HEALED — onHeal 'auto' (default): data is the healed value (poisoned
 *            fields redacted, the rest clean). onHeal 'flag': data is the
 *            original value and findings + heals describe what would change
 *            — the customer decides.
 *   HOLD   — onHold 'throw' (default): throws; the error carries
 *            code 'APIGATE_HOLD' plus holdReason, findings, digest.
 *            onHold 'return': returns the envelope with data: null —
 *            poisoned or unchecked data is never handed back.
 *
 * Options: { onHeal: 'auto'|'flag', onHold: 'throw'|'return', baseline, name }
 *   baseline — { schema, timings } as produced by diagnose.js
 *              --save-baseline. Absent ⇒ drift/timing report "recorded",
 *              never a pass on their silence (same rule as the sidecar).
 *   name     — label for the call in the decision log (default null).
 *
 * Rehabilitation, not blocking: a poisoned field is redacted and the rest
 * passes through; a hold ships with the reason, the evidence, and the fix.
 * A full HOLD happens only when nothing safe can be salvaged.
 *
 * Fail posture (his rule, fail-closed on trust):
 *   - Any analyzer that cannot run → HOLD. An unrun check is never a pass,
 *     never a heal.
 *   - If the customer's function itself throws (network down, timeout),
 *     the throw propagates untouched — availability is separate from trust.
 *     The gate never manufactures a verdict for a call that never returned.
 *   - Decisions are logged digests-only (decisions.log, same directory):
 *     verdict, counts, per-analyzer ran flags — never bodies. A logging
 *     failure never breaks the customer's call.
 */
'use strict';

const G = require('./gate.js');

function normalizeOptions(o) {
  o = o || {};
  const onHeal = o.onHeal === undefined ? 'auto' : o.onHeal;
  const onHold = o.onHold === undefined ? 'throw' : o.onHold;
  if (onHeal !== 'auto' && onHeal !== 'flag') {
    throw new TypeError("couple: onHeal must be 'auto' or 'flag', got " + JSON.stringify(o.onHeal));
  }
  if (onHold !== 'throw' && onHold !== 'return') {
    throw new TypeError("couple: onHold must be 'throw' or 'return', got " + JSON.stringify(o.onHold));
  }
  return {
    onHeal,
    onHold,
    baseline: o.baseline === undefined ? null : o.baseline,
    name: o.name === undefined ? null : o.name,
  };
}

function holdError(result) {
  const err = new Error('api-gate HOLD: ' + (result.holdReason || 'response held'));
  err.code = 'APIGATE_HOLD';
  err.holdReason = result.holdReason || null;
  err.findings = result.findings || [];
  err.digest = result.digest || null;
  err.schemaNote = result.schemaNote || null;
  return err;
}

// The healed body is a JSON string from the verdict engine. Hand the
// customer back the same value type their function returned: a string stays
// a string, anything else is parsed back to a value.
function healedValue(result, original) {
  if (typeof original === 'string') return result.healedBody;
  return JSON.parse(result.healedBody);
}

function toEnvelope(result, original, ms, opts) {
  const envelope = {
    verdict: result.verdict,
    data: undefined,
    findings: result.findings || [],
    digest: result.digest,
    originalDigest: result.originalDigest,
    ms,
    checkedAt: result.checkedAt,
    counts: result.counts,
  };
  if (result.verdict === 'PASS') {
    envelope.data = original;
  } else if (result.verdict === 'HEALED') {
    envelope.heals = result.heals || [];
    envelope.schemaNote = result.schemaNote || null;
    envelope.data = opts.onHeal === 'auto' ? healedValue(result, original) : original;
  } else {
    // HOLD
    envelope.holdReason = result.holdReason || null;
    envelope.schemaNote = result.schemaNote || null;
    if (opts.onHold === 'throw') {
      throw holdError(result);
    }
    envelope.data = null;
  }
  return envelope;
}

function finish(value, ms, opts) {
  const body = typeof value === 'string' ? value : JSON.stringify(value === undefined ? '' : value);
  const captured = { url: opts.name, method: null, status: null, ms, body };
  const result = G.checkResponse(captured, opts.baseline);
  // Digests only, never bodies — and a logging failure never breaks the
  // customer's call.
  try {
    G.logDecision(result);
  } catch (_) { /* log is audit, not the verdict */ }
  return toEnvelope(result, value, ms, opts);
}

/*
 * couple(apiFn, options) → wrapped function.
 *
 * Wraps any API-call function. The wrapper forwards args and `this`
 * untouched, measures the call, and runs the response through the gate.
 * Sync functions stay sync (envelope returned directly); async functions
 * (or any thenable) stay async (Promise of the envelope). A HOLD throws
 * by default (onHold: 'throw'); pass onHold: 'return' to receive the
 * envelope instead. If apiFn itself throws, the throw propagates as-is —
 * the gate checks responses, not availability.
 */
function couple(apiFn, options) {
  if (typeof apiFn !== 'function') {
    throw new TypeError('couple(apiFn, options): apiFn must be a function');
  }
  const opts = normalizeOptions(options);
  function wrapped(...args) {
    const t0 = Date.now();
    const out = apiFn.apply(this, args); // throws propagate: availability ≠ trust
    const elapsed = () => Date.now() - t0;
    if (out && typeof out.then === 'function') {
      return out.then(
        (v) => finish(v, elapsed(), opts),
        (e) => { throw e; }
      );
    }
    return finish(out, elapsed(), opts);
  }
  return wrapped;
}

module.exports = { couple };
