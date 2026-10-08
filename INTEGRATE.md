# Integrate in 60 Seconds

Copy, paste, run. That's it.

## JavaScript (Node.js / Browser)

```javascript
// One line: sense a network target
fetch('https://atlas-api-withered-dew-6280.fly.dev/sense',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'8.8.8.8'})}).then(r=>r.json()).then(d=>console.log(d.sensed.open_tcp_ports))
```

## Python

```python
# One line: sense a network target
import requests; print(requests.post('https://atlas-api-withered-dew-6280.fly.dev/sense', json={'target':'8.8.8.8'}).json()['sensed']['open_tcp_ports'])
```

## cURL

```bash
# One line: sense a network target
curl -s -X POST https://atlas-api-withered-dew-6280.fly.dev/sense -H "Content-Type: application/json" -d '{"target":"8.8.8.8"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['sensed']['open_tcp_ports'])"
```

## What you get

```json
{
  "program": "sense",
  "target": "8.8.8.8",
  "sensed": {
    "resolved_ip": "8.8.8.8",
    "open_tcp_ports": [53, 443],
    "note": "SNMP library unavailable; basic network sensing only"
  },
  "status": "sensed_basic"
}
```

## Next steps

- **Shape** your data to XML: `POST /shape` with `{"spec": {...}}`
- **Prove** it works: `POST /prove` with `{"when": "...", "then": "..."}`
- Full docs: [DOCS.md](DOCS.md)
