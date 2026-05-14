#!/usr/bin/env python3
"""
Graphify: Transform input into a knowledge graph with community detection.
Outputs: graph.json, communities.json, report.html, audit.json
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

# Optional deps with graceful fallback
try:
    import networkx as nx
except ImportError:  # pragma: no cover
    nx = None

try:
    import community as community_louvain
except ImportError:  # pragma: no cover
    community_louvain = None

try:
    import jinja2
except ImportError:  # pragma: no cover
    jinja2 = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


def log(msg: str):
    print(f"[graphify] {msg}", file=sys.stderr)


def read_text_files(input_path: str):
    p = Path(input_path)
    files = []
    if p.is_file():
        files = [p]
    elif p.is_dir():
        files = sorted(
            f for f in p.rglob("*")
            if f.is_file() and f.suffix.lower() in {".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".yaml", ".yml", ".rst"}
        )
    texts = []
    for f in files:
        try:
            texts.append({"path": str(f.relative_to(p) if p.is_dir() else f.name), "text": f.read_text(encoding="utf-8")})
        except Exception as e:
            log(f"Skipping {f}: {e}")
    return texts


def chunk_text(text: str, max_chars: int = 4000, overlap: int = 200):
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        start = end - overlap if end < len(text) else end
    return chunks


def extract_entities_regex(text: str):
    """Simple heuristic extraction: identifiers and capitalized phrases."""
    # CamelCase / snake_case identifiers
    ids = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", text))
    # Filter out common stopwords
    stop = {"the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "who", "boy", "did", "she", "use", "her", "way", "many", "oil", "sit", "set", "run", "eat", "far", "sea", "eye", "ago", "off", "too", "any", "say", "man", "try", "ask", "end", "why", "let", "put", "say", "she", "try", "way", "own", "say", "too", "old", "tell", "very", "when", "much", "would", "there", "their", "what", "said", "have", "each", "which", "will", "about", "could", "other", "after", "first", "never", "these", "think", "where", "being", "every", "great", "might", "shall", "still", "those", "while", "this", "that", "with", "from", "they", "know", "want", "been", "good", "much", "some", "time", "than", "them", "well", "were", "over", "such", "take", "into", "just", "long", "year", "work", "life", "even", "more", "here", "look", "down", "most", "only", "come", "make", "like", "back", "also", "came", "come", "could", "does", "done", "draw", "drink", "drive", "drop", "each", "ease", "east", "edge", "else", "ever", "face", "fact", "fair", "fall", "farm", "fast", "fear", "feed", "feel", "feet", "fell", "felt", "fill", "find", "fine", "fire", "fish", "five", "flat", "flow", "food", "foot", "form", "four", "free", "from", "full", "gain", "game", "gave", "give", "glad", "goes", "gold", "gone", "grew", "grow", "half", "hand", "hang", "hard", "harm", "hate", "have", "head", "hear", "heat", "held", "hell", "help", "here", "hero", "high", "hill", "hire", "hold", "hole", "holy", "home", "hope", "host", "hour", "huge", "hung", "hunt", "hurt", "idea", "inch", "into", "iron", "item", "join", "jump", "just", "keep", "kept", "kill", "kind", "king", "knew", "know", "lack", "lady", "laid", "lake", "land", "last", "late", "lead", "left", "less", "life", "lift", "like", "line", "link", "list", "live", "load", "lock", "long", "look", "lord", "lose", "loss", "lost", "love", "made", "mail", "main", "make", "male", "many", "mark", "mass", "mean", "meet", "menu", "mile", "milk", "mill", "mind", "mine", "miss", "mode", "mood", "moon", "more", "most", "move", "much", "must", "name", "near", "neck", "need", "news", "next", "nice", "nine", "none", "nose", "note", "noun", "okay", "once", "only", "onto", "open", "oral", "over", "pace", "pack", "page", "pain", "pair", "pale", "palm", "park", "part", "pass", "past", "path", "peak", "pick", "pile", "pink", "pipe", "plan", "play", "plot", "plug", "plus", "poem", "poet", "pole", "poll", "pool", "poor", "port", "post", "pour", "pray", "pull", "pure", "push", "quit", "race", "rail", "rain", "rank", "rare", "rate", "read", "real", "rear", "rely", "rent", "rest", "rice", "rich", "ride", "ring", "rise", "risk", "road", "rock", "role", "roll", "roof", "room", "root", "rope", "rose", "rule", "rush", "safe", "sake", "sale", "salt", "same", "sand", "save", "seat", "seed", "seek", "seem", "seen", "self", "sell", "send", "sent", "ship", "shoe", "shop", "shot", "show", "shut", "sick", "side", "sign", "silk", "sing", "sink", "site", "size", "skin", "slip", "slow", "snow", "soft", "soil", "sold", "sole", "some", "song", "soon", "sort", "soul", "soup", "span", "spin", "spot", "star", "stay", "stem", "step", "stop", "such", "suit", "sure", "swim", "tail", "take", "tale", "talk", "tall", "tank", "tape", "task", "team", "tear", "tell", "tend", "term", "test", "text", "than", "that", "them", "then", "thin", "this", "thus", "till", "time", "tiny", "told", "toll", "tone", "took", "tool", "tour", "town", "tree", "trip", "true", "tube", "tune", "turn", "twin", "type", "unit", "upon", "used", "user", "vary", "vast", "very", "view", "vote", "wage", "wait", "wake", "walk", "wall", "want", "ward", "warm", "wash", "wave", "ways", "weak", "wear", "week", "well", "went", "were", "west", "what", "when", "whom", "wide", "wife", "wild", "will", "wind", "wine", "wing", "wire", "wise", "wish", "with", "wood", "wool", "word", "work", "yard", "year", "zero", "zone"}
    ids = {w for w in ids if len(w) > 2 and w.lower() not in stop}
    return [{"id": w, "label": w, "kind": "Concept"} for w in ids]


def extract_relations_cooccurrence(text: str, entities, window: int = 50):
    """Create edges between entities that appear near each other."""
    words = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", text)
    entity_ids = {e["id"] for e in entities}
    edges = []
    for i, w1 in enumerate(words):
        if w1 not in entity_ids:
            continue
        for j in range(i + 1, min(i + window, len(words))):
            w2 = words[j]
            if w2 in entity_ids and w1 != w2:
                edges.append({"source": w1, "target": w2, "label": "co_occurs"})
    return edges


def extract_with_llm(chunk: str, model: str = "gpt-4o-mini"):
    if OpenAI is None:
        raise RuntimeError("openai package is required for LLM extraction")
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    system = (
        "Extract entities and relationships from the text. "
        "Output a JSON object with keys 'entities' and 'relations'. "
        "Entities: list of {id, label, kind}. Relations: list of {source, target, label}. "
        "Use concise IDs (lowercase snake_case). Keep only salient concepts, people, organizations, and code symbols."
    )
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": chunk},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = resp.choices[0].message.content
    data = json.loads(content)
    return data.get("entities", []), data.get("relations", [])


def build_graph(entities, relations):
    if nx is None:
        raise RuntimeError("networkx is required")
    g = nx.Graph()
    for e in entities:
        g.add_node(e["id"], label=e.get("label", e["id"]), kind=e.get("kind", "Concept"))
    for r in relations:
        if r["source"] in g and r["target"] in g:
            g.add_edge(r["source"], r["target"], label=r.get("label", "relates_to"))
    return g


def detect_communities(g, resolution: float = 1.0):
    if community_louvain is None:
        raise RuntimeError("python-louvain is required")
    partition = community_louvain.best_partition(g, resolution=resolution)
    communities = defaultdict(list)
    for node, comm_id in partition.items():
        communities[comm_id].append(node)
    return dict(communities), partition


def compute_audit(g, communities, partition):
    orphan_nodes = [n for n in g.nodes() if g.degree(n) == 0]
    density = nx.density(g) if nx is not None else 0
    coverage = len(partition) / max(len(g.nodes()), 1)
    return {
        "node_count": g.number_of_nodes(),
        "edge_count": g.number_of_edges(),
        "community_count": len(communities),
        "orphan_nodes": orphan_nodes,
        "orphan_count": len(orphan_nodes),
        "density": density,
        "community_coverage": coverage,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def render_report(output_dir: Path, graph_data, communities, partition, audit, template_path: str = None):
    if jinja2 is None:
        raise RuntimeError("jinja2 is required")

    if template_path:
        env = jinja2.Environment(loader=jinja2.FileSystemLoader(Path(template_path).parent))
        template = env.get_template(Path(template_path).name)
    else:
        # Try loading bundled asset template
        script_dir = Path(__file__).resolve().parent
        asset_template = script_dir.parent / "assets" / "report_template.html"
        if asset_template.exists():
            env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(asset_template.parent)))
            template = env.get_template(asset_template.name)
        else:
            template = jinja2.Template(_REPORT_TEMPLATE)

    # Build node list with community and degree
    nodes = []
    for n, attr in graph_data.get("nodes", []):
        deg = sum(1 for e in graph_data.get("edges", []) if e[0] == n or e[1] == n)
        nodes.append({"id": n, **attr, "community": partition.get(n, -1), "degree": deg})

    html = template.render(
        nodes=nodes,
        edges=graph_data.get("edges", []),
        communities=communities,
        audit=audit,
        generated=audit["generated_at"],
    )
    (output_dir / "report.html").write_text(html, encoding="utf-8")


_REPORT_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Graphify Report</title>
<style>
:root{--bg:#0b0c10;--fg:#c5c6c7;--surface:#1f2833;--accent:#66fcf1;--muted:#45a29e;}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:2rem;}
h1,h2{color:var(--accent);}
table{border-collapse:collapse;width:100%;margin-top:1rem;}
th,td{border:1px solid #333;padding:.5rem;text-align:left;}
th{background:var(--surface);}
tr:nth-child(even){background:#161b22;}
.community{margin-bottom:1.5rem;padding:1rem;background:var(--surface);border-radius:.5rem;}
.community h3{margin:.2rem 0;color:var(--muted);}
.tag{display:inline-block;background:#222;padding:.2rem .5rem;border-radius:.25rem;margin:.15rem;font-size:.85rem;}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin:1rem 0;}
.stat{background:var(--surface);padding:1rem;border-radius:.5rem;text-align:center;}
.stat strong{display:block;font-size:1.5rem;color:var(--accent);}
</style>
</head>
<body>
<h1>Graphify Report</h1>
<p>Generated: {{ generated }}</p>
<div class="stats">
  <div class="stat"><strong>{{ audit.node_count }}</strong>Nodes</div>
  <div class="stat"><strong>{{ audit.edge_count }}</strong>Edges</div>
  <div class="stat"><strong>{{ audit.community_count }}</strong>Communities</div>
  <div class="stat"><strong>{{ audit.orphan_count }}</strong>Orphans</div>
  <div class="stat"><strong>{{ "%.4f"|format(audit.density) }}</strong>Density</div>
</div>
<h2>Communities</h2>
{% for cid, members in communities.items() %}
<div class="community">
  <h3>Community {{ cid }} ({{ members|length }} nodes)</h3>
  <div>{% for m in members %}<span class="tag">{{ m }}</span>{% endfor %}</div>
</div>
{% endfor %}
<h2>Audit</h2>
<pre>{{ audit | tojson(indent=2) }}</pre>
<h2>Nodes</h2>
<table>
<tr><th>ID</th><th>Label</th><th>Kind</th><th>Community</th><th>Degree</th></tr>
{% for n in nodes %}
<tr><td>{{ n.id }}</td><td>{{ n.label }}</td><td>{{ n.kind }}</td><td>{{ n.community }}</td><td>{{ n.degree }}</td></tr>
{% endfor %}
</table>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Graphify: input → knowledge graph → communities → report")
    parser.add_argument("input", help="Input file or directory")
    parser.add_argument("--output", "-o", default="./graphify-output", help="Output directory")
    parser.add_argument("--llm", action="store_true", help="Use OpenAI LLM for extraction")
    parser.add_argument("--openai-model", default="gpt-4o-mini", help="OpenAI model for extraction")
    parser.add_argument("--resolution", type=float, default=1.0, help="Louvain resolution")
    parser.add_argument("--min-community-size", type=int, default=3, help="Drop communities smaller than N")
    parser.add_argument("--template", help="Path to custom Jinja2 HTML template")
    parser.add_argument("--chunk-size", type=int, default=4000, help="Text chunk size")
    args = parser.parse_args()

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    log("Reading input...")
    files = read_text_files(args.input)
    if not files:
        log("No readable text files found.")
        sys.exit(1)

    all_entities = []
    all_relations = []

    for f in files:
        text = f["text"]
        chunks = chunk_text(text, max_chars=args.chunk_size)
        for i, chunk in enumerate(chunks):
            if args.llm:
                try:
                    ents, rels = extract_with_llm(chunk, model=args.openai_model)
                    all_entities.extend(ents)
                    all_relations.extend(rels)
                except Exception as e:
                    log(f"LLM extraction failed for chunk {i} in {f['path']}: {e}")
            else:
                ents = extract_entities_regex(chunk)
                rels = extract_relations_cooccurrence(chunk, ents)
                all_entities.extend(ents)
                all_relations.extend(rels)

    # Deduplicate entities by id
    entity_map = {e["id"]: e for e in all_entities}
    entities = list(entity_map.values())

    # Deduplicate relations
    seen = set()
    relations = []
    for r in all_relations:
        key = (r["source"], r["target"], r.get("label", ""))
        if key not in seen:
            seen.add(key)
            relations.append(r)

    log(f"Extracted {len(entities)} entities and {len(relations)} relations")

    log("Building graph...")
    g = build_graph(entities, relations)

    log("Detecting communities...")
    communities, partition = detect_communities(g, resolution=args.resolution)

    # Filter small communities
    communities = {cid: members for cid, members in communities.items() if len(members) >= args.min_community_size}
    # Remove orphan partition entries for dropped communities
    kept_nodes = {n for members in communities.values() for n in members}
    partition = {n: c for n, c in partition.items() if n in kept_nodes}

    log(f"Found {len(communities)} communities after filtering")

    audit = compute_audit(g, communities, partition)
    log(f"Audit: {audit['node_count']} nodes, {audit['edge_count']} edges, {audit['orphan_count']} orphans")

    # Export graph JSON
    graph_data = {
        "nodes": [(n, dict(g.nodes[n])) for n in g.nodes()],
        "edges": [(u, v, dict(g.edges[u, v])) for u, v in g.edges()],
    }
    (out / "graph.json").write_text(json.dumps(graph_data, indent=2), encoding="utf-8")
    (out / "communities.json").write_text(json.dumps(communities, indent=2), encoding="utf-8")
    (out / "audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")

    log("Rendering report...")
    render_report(out, graph_data, communities, partition, audit, template_path=args.template)

    log(f"Done. Output in {out.resolve()}")


if __name__ == "__main__":
    main()
