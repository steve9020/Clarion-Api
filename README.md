# Clarion Net API

The conductor for the three Lazarus programs. Free for everyone.

## Live Demo

See it working: https://muse.ai/s/clarion-net-live-demo-sxt6pdvvxucaq

Interactive walkthrough of Sense, Shape, Prove — plus the resident Pass, Heal, Hold gate.

## Programs

| Endpoint | Program | Language | Does what |
|----------|---------|----------|-----------|
| `POST /sense` | clarion-snmp | Python | Senses the network (DNS, ports, SNMP) |
| `POST /shape` | clarion-builder | Ruby | Shapes code to XML |
| `POST /prove` | clarion-given | Ruby | Proves it with tests |

## Run it

```bash
docker compose up
```

That's it. The API is live on port 3000.

Or deploy to Fly.io:
```bash
fly deploy --remote-only
```

## Test it

```bash
npm test
```

## API

### Health
```
GET /health
→ { status: "alive", programs: ["sense","shape","prove"], version: "0.3.0" }
```

### Sense
```
POST /sense
{ "target": "192.168.1.1", "community": "public" }
→ { program: "sense", target: "...", sensed: { resolved_ip, open_tcp_ports }, status: "sensed_basic" }
```

### Shape
```
POST /shape
{ "spec": "what to build" }
→ XML
```

### Prove
```
POST /prove
{ "given": { "x": 21 },
  "when": { "op": "mul", "args": [{ "var": "x" }, 2] },
  "then": { "op": "eq", "args": [{ "var": "result" }, 42] } }
→ { program: "prove", status: "proven", result: 42 }
```
Data in, verdict out — expression objects, never code.

## Free forever

No auth. No keys. No charge. Santa Claus model — the code is free, the services are separate.

## Live

https://clarion-net-api.fly.dev/health
