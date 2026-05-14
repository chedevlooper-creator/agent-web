# Graphify Methodology

## Entity Extraction

### Regex / Heuristic Mode (default)
- Tokenize text into words matching `[a-zA-Z_][a-zA-Z0-9_]*`
- Filter out a stopword list and tokens shorter than 3 characters
- Treat remaining tokens as entities of kind `Concept`
- Co-occurrence edges are created when two entities appear within a 50-token window

### LLM Mode (`--llm`)
- Text is chunked into ~4000-character segments with 200-character overlap
- Each chunk is sent to an OpenAI chat model with a structured extraction prompt
- Expected output: JSON object with `entities` and `relations` arrays
- Entities should have `id` (snake_case), `label` (human-readable), and `kind`
- Relations should have `source`, `target`, and `label`

## Graph Construction

- Nodes: deduplicated by `id`; attributes include `label` and `kind`
- Edges: deduplicated by `(source, target, label)`; both endpoints must exist as nodes
- Graph type: undirected `networkx.Graph`

## Community Detection

- Algorithm: Louvain method (`python-louvain` package)
- Resolution parameter controls granularity (default 1.0)
  - < 1.0 → fewer, larger communities
  - > 1.0 → more, smaller communities
- Communities below `--min-community-size` are discarded after detection
- Orphan nodes (degree 0) are noted in the audit but may end up in singleton communities

## Audit Metrics

- **Node count**: Total unique entities
- **Edge count**: Total unique relations
- **Community count**: Number of communities after filtering
- **Orphan count**: Nodes with zero edges
- **Density**: `2 * edges / (nodes * (nodes - 1))` for undirected graph
- **Community coverage**: Fraction of nodes assigned to a community

## Output Formats

### graph.json
```json
{
  "nodes": [["id", {"label": "...", "kind": "..."}], ...],
  "edges": [["source", "target", {"label": "..."}], ...]
}
```

### communities.json
```json
{
  "0": ["node_a", "node_b", ...],
  "1": ["node_c", ...]
}
```

### audit.json
Flat object with metrics listed above plus `generated_at` ISO timestamp.

### report.html
Standalone HTML generated via Jinja2. Includes:
- Summary statistics cards
- Community tag clouds
- Full node table with community assignment and degree
- Raw audit JSON

## Customization

- Pass `--template path/to/template.html` to override the default report styling
- Edit `assets/report_template.html` in the skill directory to change the default look
- Adjust `--chunk-size` for very long documents
- Use `--resolution` to tune community granularity after initial results
