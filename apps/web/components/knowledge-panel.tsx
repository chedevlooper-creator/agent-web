"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  Trash2,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Loader2,
  Library,
  FileUp,
} from "lucide-react";

// ===== Types =====
interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  userId: string;
  filename: string;
  content: string;
  contentType: string;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

interface SearchResult {
  documentId: string;
  knowledgeBaseId: string;
  filename: string;
  snippet: string;
  score: number;
}

// ===== API Helpers =====
async function fetchBases(): Promise<KnowledgeBase[]> {
  const res = await fetch("/api/knowledge/bases");
  if (!res.ok) throw new Error("Failed to fetch knowledge bases");
  const data = await res.json();
  return data.bases ?? [];
}

async function createBase(name: string, description?: string): Promise<KnowledgeBase> {
  const res = await fetch("/api/knowledge/bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create knowledge base");
  const data = await res.json();
  return data.base;
}

async function deleteBase(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/bases?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete knowledge base");
}

async function fetchDocuments(baseId: string): Promise<KnowledgeDocument[]> {
  const res = await fetch(`/api/knowledge/documents?baseId=${encodeURIComponent(baseId)}`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  const data = await res.json();
  return data.documents ?? [];
}

async function addDocumentApi(
  baseId: string,
  filename: string,
  content: string
): Promise<KnowledgeDocument> {
  const res = await fetch("/api/knowledge/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseId, filename, content }),
  });
  if (!res.ok) throw new Error("Failed to add document");
  const data = await res.json();
  return data.document;
}

async function deleteDocumentApi(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/documents?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

async function searchKnowledgeApi(
  query: string,
  topK?: number,
  baseIds?: string[]
): Promise<SearchResult[]> {
  const res = await fetch("/api/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK, baseIds }),
  });
  if (!res.ok) throw new Error("Failed to search knowledge");
  const data = await res.json();
  return data.results ?? [];
}

// ===== Knowledge Panel Component =====
export function KnowledgePanel({
  expanded = true,
}: {
  expanded?: boolean;
}) {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAddBase, setShowAddBase] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");
  const [newBaseDesc, setNewBaseDesc] = useState("");
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocFilename, setNewDocFilename] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBaseIds, setExpandedBaseIds] = useState<Set<string>>(new Set());

  const loadBases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBases();
      setBases(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (baseId: string) => {
    setDocLoading(true);
    try {
      const data = await fetchDocuments(baseId);
      setDocuments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard load-on-mount; loader sets loading state synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBases();
  }, [loadBases]);

  useEffect(() => {
    if (selectedBaseId) {
      // Standard load-on-change; loader sets loading state synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDocuments(selectedBaseId);
    } else {
      setDocuments([]);
    }
  }, [selectedBaseId, loadDocuments]);

  // Search effect with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Intentional: clear results when the query is emptied.
      /* eslint-disable react-hooks/set-state-in-effect */
      setSearchResults([]);
      setSearching(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchKnowledgeApi(
          searchQuery.trim(),
          5,
          selectedBaseId ? [selectedBaseId] : undefined
        );
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedBaseId]);

  const handleCreateBase = async () => {
    if (!newBaseName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const base = await createBase(newBaseName.trim(), newBaseDesc.trim() || undefined);
      setBases((prev) => [base, ...prev]);
      setNewBaseName("");
      setNewBaseDesc("");
      setShowAddBase(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBase = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this knowledge base and all its documents?")) return;
    try {
      await deleteBase(id);
      setBases((prev) => prev.filter((b) => b.id !== id));
      if (selectedBaseId === id) {
        setSelectedBaseId(null);
        setDocuments([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleAddDocument = async () => {
    if (!selectedBaseId || !newDocFilename.trim() || !newDocContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const doc = await addDocumentApi(
        selectedBaseId,
        newDocFilename.trim(),
        newDocContent
      );
      setDocuments((prev) => [doc, ...prev]);
      setNewDocFilename("");
      setNewDocContent("");
      setShowAddDoc(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this document?")) return;
    try {
      await deleteDocumentApi(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const toggleBaseExpand = (id: string) => {
    setExpandedBaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedBaseId(id);
  };

  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <Library size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          KB
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search */}
      <div className="mx-2 mt-2 flex items-center gap-2 border border-[var(--border)] bg-[var(--overlay)] px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
        <Search size={12} className="shrink-0 text-[var(--muted-foreground)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search knowledge..."
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="flex h-4 w-4 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
            aria-label="Clear search"
          >
            <X size={10} />
          </button>
        )}
        {searching && (
          <Loader2 size={10} className="animate-spin text-[var(--muted-foreground)]" />
        )}
      </div>

      {/* Search Results */}
      {searchQuery.trim() && (
        <div className="mx-2 mt-1 max-h-[200px] overflow-y-auto border border-[var(--border)] bg-[var(--overlay)]">
          {searching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="px-2 py-3 text-center font-mono text-[10px] text-[var(--dim-foreground)]">
              No results
            </p>
          ) : (
            searchResults.map((r, i) => (
              <div
                key={`${r.documentId}-${i}`}
                className="border-b border-[var(--border)] px-2 py-1.5 last:border-b-0 hover:bg-[var(--muted)]/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-medium text-[var(--foreground)]">
                    {r.filename}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-[var(--primary)]">
                    {(r.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
                  {r.snippet}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
          Knowledge Bases {bases.length > 0 && `(${bases.length})`}
        </span>
        <button
          onClick={() => setShowAddBase(true)}
          className="flex h-5 w-5 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Create knowledge base"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mb-1 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
          <p className="font-mono text-[9px] text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {/* Create Base Form */}
      {showAddBase && (
        <div className="mx-2 mb-2 border border-[var(--border)] bg-[var(--overlay)] p-2 space-y-1.5">
          <input
            value={newBaseName}
            onChange={(e) => setNewBaseName(e.target.value)}
            placeholder="Knowledge base name"
            className="w-full bg-transparent border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none focus:border-[var(--primary)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateBase();
              if (e.key === "Escape") setShowAddBase(false);
            }}
            autoFocus
          />
          <input
            value={newBaseDesc}
            onChange={(e) => setNewBaseDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-transparent border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none focus:border-[var(--primary)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateBase();
              if (e.key === "Escape") setShowAddBase(false);
            }}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleCreateBase}
              disabled={saving || !newBaseName.trim()}
              className="flex-1 bg-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-dim)] transition-colors disabled:opacity-40 font-mono"
            >
              {saving ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowAddBase(false);
                setNewBaseName("");
                setNewBaseDesc("");
              }}
              className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors font-mono"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : bases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <BookOpen size={20} className="text-[var(--dim-foreground)]" />
            <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No knowledge bases yet
            </p>
            <button
              onClick={() => setShowAddBase(true)}
              className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)] transition-colors font-mono"
            >
              <Plus size={10} className="inline mr-1" />
              Create one
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {bases.map((base) => {
              const isExpanded = expandedBaseIds.has(base.id);
              return (
                <div key={base.id}>
                  {/* Base Header */}
                  <div className="group relative flex items-center">
                    <button
                      onClick={() => toggleBaseExpand(base.id)}
                      className="flex flex-1 items-center gap-2 border-l-2 border-transparent px-2 py-1.5 text-left transition-all hover:border-[var(--primary)] hover:bg-[var(--overlay)]"
                    >
                      {isExpanded ? (
                        <ChevronDown size={10} className="shrink-0 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronRight size={10} className="shrink-0 text-[var(--muted-foreground)]" />
                      )}
                      <Library size={12} className="shrink-0 text-[var(--primary)]" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-[var(--foreground)]">
                          {base.name}
                        </span>
                        {base.description && (
                          <span className="block truncate text-[9px] text-[var(--dim-foreground)]">
                            {base.description}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteBase(base.id)}
                      className="absolute right-1 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center text-[var(--muted-foreground)] opacity-0 transition-all hover:text-[var(--destructive)] group-hover:opacity-100"
                      aria-label={`Delete ${base.name}`}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Expanded: Show Documents */}
                  {isExpanded && selectedBaseId === base.id && (
                    <div className="ml-4 border-l border-[var(--border)] pl-2">
                      {/* Add Document Button */}
                      <button
                        onClick={() => setShowAddDoc(true)}
                        className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)] transition-colors font-mono"
                      >
                        <FileUp size={10} />
                        Add Document
                      </button>

                      {/* Add Document Form */}
                      {showAddDoc && (
                        <div className="mx-1 mb-2 border border-[var(--border)] bg-[var(--overlay)] p-2 space-y-1.5">
                          <input
                            value={newDocFilename}
                            onChange={(e) => setNewDocFilename(e.target.value)}
                            placeholder="Filename (e.g., notes.txt)"
                            className="w-full bg-transparent border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none focus:border-[var(--primary)]"
                            autoFocus
                          />
                          <textarea
                            value={newDocContent}
                            onChange={(e) => setNewDocContent(e.target.value)}
                            placeholder="Document content..."
                            rows={4}
                            className="w-full resize-none bg-transparent border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none focus:border-[var(--primary)] font-mono"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleAddDocument}
                              disabled={saving || !newDocFilename.trim() || !newDocContent.trim()}
                              className="flex-1 bg-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-dim)] transition-colors disabled:opacity-40 font-mono"
                            >
                              {saving ? "Adding..." : "Add"}
                            </button>
                            <button
                              onClick={() => {
                                setShowAddDoc(false);
                                setNewDocFilename("");
                                setNewDocContent("");
                              }}
                              className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors font-mono"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Documents List */}
                      {docLoading ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 size={10} className="animate-spin text-[var(--muted-foreground)]" />
                        </div>
                      ) : documents.length === 0 ? (
                        <p className="px-2 py-2 text-center font-mono text-[9px] text-[var(--dim-foreground)]">
                          No documents yet
                        </p>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="group/doc relative flex items-start gap-2 px-2 py-1.5 hover:bg-[var(--overlay)] transition-colors"
                          >
                            <FileText size={10} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[10px] font-medium text-[var(--foreground)]">
                                {doc.filename}
                              </span>
                              <span className="font-mono text-[8px] text-[var(--dim-foreground)]">
                                {doc.chunkCount} chunks &middot; {doc.content.length.toLocaleString()} chars
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="shrink-0 text-[var(--muted-foreground)] opacity-0 transition-all hover:text-[var(--destructive)] group-hover/doc:opacity-100"
                              aria-label={`Delete ${doc.filename}`}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
