import json
from pathlib import Path
from collections import defaultdict

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes = {n['id']: n for n in data['nodes']}
adj = defaultdict(list)
for e in data['links']:
    adj[e['source']].append((e['target'], e))
    adj[e['target']].append((e['source'], e))

cron_nodes = [nid for nid, n in nodes.items() if 'cron' in (n.get('source_file') or '').lower()]
print('Cron community nodes:')
for nid in cron_nodes:
    n = nodes[nid]
    print(f"- {n.get('label')} [{n.get('source_location')}] -> community {n.get('community')}")

# trace from checkAndRunCronJobs to runChatStream
start = 'lib_cron_checkandruncronjobs'
end = 'chat_engine_runchatstream'
print('\nPath from checkAndRunCronJobs() to runChatStream():')

# simple BFS
from collections import deque
q = deque([(start, [start])])
seen = {start}
found = None
while q and not found:
    cur, path = q.popleft()
    if cur == end:
        found = path
        break
    for nxt, e in adj[cur]:
        if nxt not in seen:
            seen.add(nxt)
            q.append((nxt, path + [nxt]))

if found:
    for i, nid in enumerate(found):
        n = nodes[nid]
        print(f"  {n.get('label')} [c{n.get('community')}, {n.get('source_file')} {n.get('source_location')}]")
        if i < len(found)-1:
            nxt = found[i+1]
            e = next(e for nb,e in adj[nid] if nb==nxt)
            print(f"    --{e.get('relation')} [{e.get('confidence')}]-->")
else:
    print('  no path found')
