# Clarion API

The conductor for the three Lazarus programs. Free for everyone.

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
→ { status: "alive", programs: ["sense","shape","prove"], version: "0.2.5" }
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
{ "path": "path/to/tests" }
→ { program: "prove", status: "proven", examples: N, failures: 0 }
```

## Free forever

No auth. No keys. No charge. Santa Claus model — the code is free, the services are separate.

## Live

https://atlas-api-withered-dew-6280.fly.dev/health
