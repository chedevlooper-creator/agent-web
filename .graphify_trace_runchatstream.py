import json
from pathlib import Path
from collections import defaultdict

p = Path('graphify-out/graph.json')
data = json.loads(p.read_text(encoding='utf-8'))

nodes = {n['id']: n for n in data['nodes']}

run_id = 'engine_runChatStream'

adj = defaultdict(list)
for e in data['links']:
    s = e['source']; t = e['target']
    adj[s].append((t, e))
    adj[t].append((s, e))

def fmt_node(nid):
    n = nodes.get(nid, {})
    return f"{n.get('label', nid)} (community {n.get('community')}, {n.get('source_file')})"

print('runChatStream node:')
print(' ', fmt_node(run_id))
print('\nDirect neighbors:')
for nbr, e in sorted(adj[run_id], key=lambda x: (x[1].get('relation',''), nodes.get(x[0],{}).get('label',''))):
    rel = e.get('relation')
    conf = e.get('confidence')
    score = e.get('confidence_score')
    print(f"- {rel} [{conf} {score}]: {fmt_node(nbr)}")

# show 2-hop bridges into other communities
print('\n2-hop cross-community bridges:')
seen = set()
for nbr, e1 in adj[run_id]:
    for nbr2, e2 in adj[nbr]:
        if nbr2 == run_id:
            continue
        c2 = nodes.get(nbr2, {}).get('community')
        if c2 is None:
            continue
        if c2 == nodes[run_id].get('community'):
            continue
        key = (nbr, nbr2)
        if key in seen:
            continue
        seen.add(key)
        print(f"- via {nodes.get(nbr,{}).get('label',nbr)} -> {nodes.get(nbr2,{}).get('label',nbr2)} (community {c2})")
