# Clarion Net API — Documentation

Base URL: `https://atlas-api-withered-dew-6280.fly.dev`

No authentication required. No rate limits. Free forever.

## Endpoints

### GET /health

Check if the API is alive.

**Response:**
```json
{
  "status": "alive",
  "programs": ["sense", "shape", "prove"],
  "version": "0.2.0"
}
```

**Example:**
```bash
curl https://atlas-api-withered-dew-6280.fly.dev/health
```

---

### POST /sense

Sense a network target. Returns DNS resolution, open TCP ports, and SNMP data if available.

**Request:**
```json
{
  "target": "192.168.1.1",
  "community": "public"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| target | string | Yes | Hostname or IP address to sense |
| community | string | No | SNMP community string (default: "public") |

**Response:**
```json
{
  "program": "sense",
  "target": "192.168.1.1",
  "community": "public",
  "sensed": {
    "resolved_ip": "192.168.1.1",
    "open_tcp_ports": [22, 80, 443],
    "note": "SNMP library unavailable; basic network sensing only"
  },
  "status": "sensed_basic"
}
```

**Example:**
```bash
curl -X POST https://atlas-api-withered-dew-6280.fly.dev/sense \
  -H "Content-Type: application/json" \
  -d '{"target":"8.8.8.8"}'
```

**JavaScript:**
```javascript
const res = await fetch('https://atlas-api-withered-dew-6280.fly.dev/sense', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ target: '8.8.8.8' })
});
const data = await res.json();
console.log(data.sensed.open_tcp_ports);
```

---

### POST /shape

Shape a JSON object into structured XML.

**Request:**
```json
{
  "spec": {
    "name": "example",
    "value": 123,
    "nested": {
      "key": "value"
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| spec | object | Yes | JSON object to convert to XML |

**Response:**
```json
{
  "program": "shape",
  "status": "shaped",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<clarion>\n  <name>example</name>\n  <value>123</value>\n  <nested>\n    <key>value</key>\n  </nested>\n</clarion>\n"
}
```

**Example:**
```bash
curl -X POST https://atlas-api-withered-dew-6280.fly.dev/shape \
  -H "Content-Type: application/json" \
  -d '{"spec":{"name":"test","value":123}}'
```

**JavaScript:**
```javascript
const res = await fetch('https://atlas-api-withered-dew-6280.fly.dev/shape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ spec: { name: 'test', value: 123 } })
});
const data = await res.json();
console.log(data.xml);
```

---

### POST /prove

Run a Given/When/Then test using RSpec.

**Request:**
```json
{
  "given": {
    "x": "21"
  },
  "when": "x * 2",
  "then": "result == 42"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| given | object | No | Map of variable names to Ruby expressions |
| when | string | Yes | Ruby expression to evaluate |
| then | string | Yes | Ruby expression that must be true (can use `result`) |

**Response:**
```json
{
  "program": "prove",
  "status": "proven",
  "examples": 1,
  "failures": 0,
  "given": { "x": "21" },
  "when": "x * 2",
  "then": "result == 42"
}
```

**Example:**
```bash
curl -X POST https://atlas-api-withered-dew-6280.fly.dev/prove \
  -H "Content-Type: application/json" \
  -d '{"given":{"x":"21"},"when":"x * 2","then":"result == 42"}'
```

**JavaScript:**
```javascript
const res = await fetch('https://atlas-api-withered-dew-6280.fly.dev/prove', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    given: { x: '21' },
    when: 'x * 2',
    then: 'result == 42'
  })
});
const data = await res.json();
console.log(data.status); // "proven"
```

---

### POST /conduct

Run the full pipeline: sense → shape → prove. One call.

**Request:**
```json
{
  "target": "192.168.1.1",
  "community": "public"
}
```

**Response:**
```json
{
  "target": "192.168.1.1",
  "steps": [
    { "program": "sense", "status": "ok", "output": {...} },
    { "program": "shape", "status": "ok", "output": {...} },
    { "program": "prove", "status": "proven", "output": {...} }
  ],
  "status": "complete"
}
```

**Example:**
```bash
curl -X POST https://atlas-api-withered-dew-6280.fly.dev/conduct \
  -H "Content-Type: application/json" \
  -d '{"target":"8.8.8.8"}'
```

---

## Errors

All errors return JSON with an `error` field.

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing required field |
| 502 | Script error — the program failed |
| 500 | Server error |

**Example error:**
```json
{
  "program": "sense",
  "target": "192.168.1.1",
  "error": "target required (hostname or IP)"
}
```

## License

Apache 2.0 — free for commercial and non-commercial use.
