import json
from pathlib import Path
from collections import defaultdict

p = Path('graphify-out/graph.json')
data = json.loads(p.read_text(encoding='utf-8'))

nodes = {n['id']: n for n in data['nodes']}
adj = defaultdict(list)
for e in data['links']:
    s = e['source']; t = e['target']
    adj[s].append((t, e))
    adj[t].append((s, e))

run_id = 'chat_engine_runchatstream'

print('Node:', nodes[run_id]['label'], 'community', nodes[run_id]['community'], 'file', nodes[run_id]['source_file'], nodes[run_id]['source_location'])
print('\nDirect neighbors:')
for nbr, e in sorted(adj[run_id], key=lambda x: (x[1].get('relation',''), nodes.get(x[0],{}).get('label',''))):
    rel = e.get('relation'); conf = e.get('confidence'); score = e.get('confidence_score')
    n = nodes.get(nbr, {})
    print(f"- {rel} [{conf} {score}]: {n.get('label',nbr)} (community {n.get('community')}, {n.get('source_file')})")
