// Atlas API — the conductor.
// Three programs, one API. Free for everyone (Santa Claus model).
//
// SENSE  -> clarion-snmp    (Python/pysnmp — feels the network via SNMP)
// SHAPE  -> clarion-builder (Ruby/builder  — shapes structured XML)
// PROVE  -> clarion-given   (Ruby/rspec-given — proves with Given/When/Then)
// CONDUCT -> Atlas orchestrates all three: sense -> shape -> prove

const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json());

const PORT = process.env.ATLAS_API_PORT || 3000;
const SCRIPTS = path.join(__dirname, '..', 'scripts');

// --- TRUTH FILTER — Steve's order 2026-10-08 ~11:05 EDT ---
// The three programs sit below Atlas. Nothing flows up to Atlas unless its
// truth is established. Fail closed: strip it, name what was stripped.
function truthFilter(program, result) {
  if (!result || typeof result !== 'object' || result.error) return result;
  const stripped = [];
  if (program === 'sense' && result.sensed) {
    // Ports probed against an unresolved target are not true readings.
    if (result.sensed.dns_error && 'open_tcp_ports' in result.sensed) {
      delete result.sensed.open_tcp_ports;
      stripped.push('open_tcp_ports (DNS failed: target unresolved, readings not true)');
    }
  }
  if (stripped.length) result.truth_filtered = stripped;
  return result;
}

// TRUTH OVER VERDICT — Steve's order 2026-10-08 ~11:21 EDT.
// The optimization is continuity, truth, integrity — not speed. The verdict
// is not the end point; the consequences are. When the truth filter stripped
// anything or a step ran degraded, that overrides a clean verdict. The
// pipeline reports what holds, not just what passed.
function truthAssessment(pipeline) {
  const stripped = [];
  let degraded = false;
  for (const step of pipeline.steps) {
    const out = step.output || {};
    if (Array.isArray(out.truth_filtered)) {
      for (const f of out.truth_filtered) stripped.push(step.program + ': ' + f);
    }
    if (step.program === 'sense' && out.status === 'sensed_basic') degraded = true;
  }
  const clean = stripped.length === 0 && !degraded;
  return {
    holds: clean,
    stripped: stripped,
    degraded: degraded,
    consequence: clean
      ? 'Chain intact — verdicts stand on verified outputs.'
      : 'Outputs filtered or degraded upstream — verdicts below do not stand alone.'
  };
}

// --- Health ---
app.get('/health', (req, res) => {
  res.json({ status: 'alive', programs: ['sense', 'shape', 'prove'], version: '0.2.0' });
});

// --- SENSE: query an SNMP agent for system info ---
app.post('/sense', async (req, res) => {
  const { target, community = 'public' } = req.body || {};
  if (!target) return res.status(400).json({ error: 'target required (hostname or IP)' });
  try {
    const script = path.join(SCRIPTS, 'sense_snmp.py');
    const { stdout } = await execFileAsync('python3', [script, target, community], { timeout: 30000 });
    const result = JSON.parse(stdout);
    if (result.error) return res.status(502).json({ program: 'sense', target, error: result.error });
    res.json({ program: 'sense', ...truthFilter('sense', result) });
  } catch (e) {
    res.status(500).json({ program: 'sense', target, error: e.message });
  }
});

// --- SHAPE: generate structured XML from a JSON spec ---
app.post('/shape', async (req, res) => {
  const { spec } = req.body || {};
  if (!spec) return res.status(400).json({ error: 'spec required (JSON object to shape into XML)' });
  try {
    const script = path.join(SCRIPTS, 'shape_builder.rb');
    const specJson = typeof spec === 'string' ? spec : JSON.stringify(spec);
    const { stdout } = await execFileAsync('ruby', [script, specJson], { timeout: 30000 });
    const result = JSON.parse(stdout);
    if (result.error) return res.status(502).json({ program: 'shape', error: result.error });
    res.json(truthFilter('shape', result));
  } catch (e) {
    res.status(500).json({ program: 'shape', error: e.message });
  }
});

// --- PROVE: run a Given/When/Then test ---
app.post('/prove', async (req, res) => {
  const { given, when: whenExpr, then: thenExpr } = req.body || {};
  if (!whenExpr || !thenExpr) {
    return res.status(400).json({ error: 'when and then required (ruby expressions); given optional (map of var->ruby_expr)' });
  }
  try {
    const script = path.join(SCRIPTS, 'prove_given.rb');
    const specJson = JSON.stringify({ given: given || {}, when: whenExpr, then: thenExpr });
    const { stdout } = await execFileAsync('ruby', [script, specJson], { timeout: 60000 });
    const result = JSON.parse(stdout);
    if (result.error) return res.status(502).json({ program: 'prove', error: result.error });
    res.json(truthFilter('prove', result));
  } catch (e) {
    res.status(500).json({ program: 'prove', error: e.message });
  }
});

// --- CONDUCT: Atlas orchestrates all three ---
// Sense the target, shape the findings, prove the shape. One call.
app.post('/conduct', async (req, res) => {
  const { target, community = 'public' } = req.body || {};
  if (!target) return res.status(400).json({ error: 'target required (hostname or IP)' });

  const pipeline = { target, steps: [] };

  try {
    // Step 1: SENSE — query the target via SNMP
    const senseScript = path.join(SCRIPTS, 'sense_snmp.py');
    const senseOut = await execFileAsync('python3', [senseScript, target, community], { timeout: 30000 });
    const senseResult = JSON.parse(senseOut.stdout);
    pipeline.steps.push({ program: 'sense', status: senseResult.error ? 'error' : 'ok', output: truthFilter('sense', senseResult) });
    if (senseResult.error) throw new Error(`sense failed: ${senseResult.error}`);

    // Step 2: SHAPE — shape the sensed data into XML
    const shapeScript = path.join(SCRIPTS, 'shape_builder.rb');
    const shapeOut = await execFileAsync('ruby', [shapeScript, JSON.stringify(senseResult)], { timeout: 30000 });
    const shapeResult = JSON.parse(shapeOut.stdout);
    pipeline.steps.push({ program: 'shape', status: shapeResult.error ? 'error' : 'ok', output: truthFilter('shape', shapeResult) });
    if (shapeResult.error) throw new Error(`shape failed: ${shapeResult.error}`);

    // Step 3: PROVE — verify the pipeline produced real output
    const proveScript = path.join(SCRIPTS, 'prove_given.rb');
    const proveSpec = JSON.stringify({
      given: { xml: JSON.stringify(shapeResult.xml || '').slice(0, 200) },
      when: 'xml.length',
      then: 'result > 0'
    });
    const proveOut = await execFileAsync('ruby', [proveScript, proveSpec], { timeout: 60000 });
    const proveResult = JSON.parse(proveOut.stdout);
    pipeline.steps.push({ program: 'prove', status: proveResult.status || 'error', output: truthFilter('prove', proveResult) });

    pipeline.status = 'complete';
    pipeline.truth = truthAssessment(pipeline);
    res.json(pipeline);
  } catch (e) {
    pipeline.status = 'failed';
    pipeline.error = e.message;
    res.status(500).json(pipeline);
  }
});

app.listen(PORT, () => {
  console.log(`Atlas API listening on :${PORT} — free for everyone.`);
});
