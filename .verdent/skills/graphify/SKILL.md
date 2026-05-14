---
name: graphify
description: "This skill should be used when converting code, documents, papers, or images into a structured knowledge graph with clustered communities. It produces HTML reports, JSON graph data, and audit summaries. Trigger keywords: knowledge graph, graph analysis, community detection, entity extraction, graph visualization, network analysis, document graph, code graph, graphify."
---

# Graphify

## Overview

Transform unstructured or structured input into a navigable knowledge graph.
The pipeline extracts entities and relationships, builds a NetworkX graph, detects communities via the Louvain method, and renders an interactive HTML report alongside raw JSON exports.

## When to Use

- Mapping relationships in a codebase (modules, functions, imports)
- Analyzing academic papers or technical documentation
- Building topic clusters from a corpus of text
- Visualizing concept networks from image descriptions or OCR text
- Auditing graph coverage and quality

## Pipeline

```
Input (file / dir / text)
  → Extract (entities + relations)
  → Build Graph (NetworkX)
  → Detect Communities (Louvain)
  → Export JSON (graph + communities)
  → Render HTML Report (Jinja2 template)
```

## Workflow

### 1. Prepare Input

Collect the source material into a single directory or text file.
Supported inputs:
- `.txt`, `.md`, `.py`, `.js`, `.ts`, `.json` (text extracted directly)
- `.pdf` (extract text first; use `pdf` skill or `PyMuPDF`)
- `.png`, `.jpg` (extract descriptions first; use `pdf` skill OCR or vision LLM)

### 2. Run Extraction & Graph Build

```bash
python scripts/graphify.py ./my-input-dir --output ./graphify-out
```

Options:
- `--llm` — Use OpenAI API for high-quality entity/relation extraction (requires `OPENAI_API_KEY`)
- `--openai-model` — Model to use for extraction (default: `gpt-4o-mini`)
- `--min-community-size` — Filter communities smaller than N (default: 3)

### 3. Review Outputs

Output directory contains:
- `graph.json` — Nodes and edges with attributes
- `communities.json` — Community assignments and summaries
- `report.html` — Standalone interactive report (open in browser)
- `audit.json` — Coverage stats, orphan nodes, density metrics

### 4. Iteration

If communities are too granular or too coarse, adjust:
- `--resolution` parameter (Louvain resolution, default 1.0). Higher = more communities.
- Pre-filter input to focus on a specific domain or file subset.

## Dependencies

Required:
```bash
pip install networkx python-louvain jinja2
```

Optional (for LLM extraction):
```bash
pip install openai
```

## LLM Extraction Prompt

When `--llm` is used, each text chunk is sent with the following system prompt:

```
Extract entities and relationships from the text.
Output JSON lines:
{"type": "entity", "id": "unique-id", "label": "Entity Name", "kind": "Concept|Person|Organization|Code|Other"}
{"type": "relation", "source": "id", "target": "id", "label": "relates_to"}
```

## Report Template

The HTML report is generated from `assets/report_template.html` via Jinja2.
To customize styling or add interactive filters, edit the template directly.

## Anti-Patterns

- Do not feed raw binary files (images/PDFs) directly into `graphify.py` without prior text extraction.
- Do not run on massive corpora (>10k docs) without chunking first; the script processes all files in memory.
- Avoid relying solely on regex extraction for highly technical or ambiguous domains; use `--llm` instead.
