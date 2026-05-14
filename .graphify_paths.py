import json
from pathlib import Path
from collections import defaultdict, deque

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes = {n['id']: n for n in data['nodes']}
adj = defaultdict(list)
for e in data['links']:
    s = e['source']; t = e['target']
    adj[s].append((t, e))
    adj[t].append((s, e))

def find_node(label, source_file_contains=None):
    label_l = label.lower()
    best = None
    for nid, n in nodes.items():
        if n.get('label','').lower() != label_l:
            continue
        if source_file_contains and source_file_contains not in (n.get('source_file') or ''):
            continue
        return nid
    return best

def shortest_path(a, b, max_depth=12):
    q = deque([a])
    prev = {a: None}
    while q:
        cur = q.popleft()
        if cur == b:
            break
        if len(prev) > 20000:
            break
        for nxt, e in adj[cur]:
            if nxt in prev:
                continue
            prev[nxt] = (cur, e)
            q.append(nxt)
    if b not in prev:
        return None
    path = []
    cur = b
    while cur is not None:
        path.append(cur)
        back = prev[cur]
        cur = back[0] if back else None
    return list(reversed(path))

def path_str(path):
    out = []
    for i, nid in enumerate(path):
        n = nodes[nid]
        out.append(f"{n.get('label',nid)}[c{n.get('community')}] ")
        if i < len(path)-1:
            nxt = path[i+1]
            e = next(e for nb,e in adj[nid] if nb==nxt)
            out.append(f"--{e.get('relation')}({e.get('confidence')})--> ")
    return ''.join(out)

run_id = 'chat_engine_runchatstream'
root_id = 'app_layout_rootlayout'
badreq_id = 'src_errors_badrequest'
post_chat_id = find_node('POST()', 'apps/web/app/api/chat/route.ts')
cron_check_id = 'lib_cron_checkandruncronjobs'

pairs = [
    ('runChatStream() -> RootLayout()', run_id, root_id),
    ('runChatStream() -> POST() /api/chat', run_id, post_chat_id),
    ('runChatStream() -> badRequest()', run_id, badreq_id),
    ('runChatStream() -> checkAndRunCronJobs()', run_id, cron_check_id),
]

for title, a, b in pairs:
    if not a or not b:
        print(title + ': MISSING NODE')
        continue
    p = shortest_path(a, b)
    print('\n' + title)
    if not p:
        print('  no path')
        continue
    print('  ' + path_str(p))
