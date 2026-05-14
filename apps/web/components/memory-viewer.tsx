"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Trash2, Edit2, Save } from "lucide-react";
import { toast } from "sonner";

export function MemoryViewer() {
  const { memoryLimit, userMdLimit } = useChatStore();
  const [activeTab, setActiveTab] = useState<"memory" | "user">("memory");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory?target=${activeTab}&limit=50`);
      if (res.ok) setEntries(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addEntry = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue, category: "fact", importance: 5, target: activeTab }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewKey(""); setNewValue("");
      await fetchEntries();
      toast.success("Memory entry added");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      await fetchEntries();
      toast.success("Entry deleted");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const searchSessions = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
      }
    } catch (e) {
      toast.error(`Search failed: ${(e as Error).message}`);
    }
  };

  const currentEntries = entries;
  const totalChars = currentEntries.reduce((sum, e) => sum + (e.key?.length ?? 0) + (e.value?.length ?? 0), 0);
  const limit = activeTab === "memory" ? memoryLimit : userMdLimit;
  const usagePercent = Math.round((totalChars / limit) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setActiveTab("memory"); setEntries([]); }}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "memory" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          MEMORY.md
        </button>
        <button
          onClick={() => { setActiveTab("user"); setEntries([]); }}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "user" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/50"}`}
        >
          USER.md
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Usage</span>
          <span>{totalChars}/{limit} chars ({usagePercent}%)</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Input placeholder="Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="text-xs" />
        <Textarea placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="text-xs" rows={3} />
        <Button size="sm" onClick={addEntry} className="w-full">
          <Plus size={12} className="mr-1" /> Add Entry
        </Button>
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-xs"
          onKeyDown={(e) => e.key === "Enter" && searchSessions()}
        />
        <Button size="sm" variant="ghost" onClick={searchSessions} className="h-8 w-8 p-0">
          <Search size={14} />
        </Button>
      </div>

      {searchResults.length > 0 && (
        <ScrollArea className="max-h-32">
          <div className="space-y-1">
            {searchResults.map((r, i) => (
              <div key={i} className="text-[10px] border rounded p-1.5 bg-muted/20">
                <div className="font-semibold truncate">{r.sessionTitle}</div>
                <div className="text-muted-foreground truncate">{r.messageContent?.slice(0, 100)}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Separator />

      <ScrollArea className="max-h-48">
        <div className="space-y-1">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          ) : currentEntries.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No entries</div>
          ) : (
            currentEntries.map((entry) => (
              <div key={entry.id} className="text-xs border rounded-lg p-2 bg-muted/20">
                <div className="flex justify-between items-start">
                  <span className="font-semibold truncate flex-1">{entry.key}</span>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      size="sm" variant="ghost" className="h-5 w-5 p-0"
                      onClick={() => { setEditingId(entry.id); setEditValue(entry.value); }}
                    >
                      <Edit2 size={10} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntry(entry.id)}>
                      <Trash2 size={10} />
                    </Button>
                  </div>
                </div>
                {editingId === entry.id ? (
                  <div className="mt-1 space-y-1">
                    <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-xs" rows={2} />
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch("/api/memory", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "replace", target: activeTab, oldText: entry.value, newContent: editValue }),
                          });
                          setEditingId(null);
                          await fetchEntries();
                          toast.success("Entry updated");
                        } catch (e) {
                          toast.error(`Error: ${(e as Error).message}`);
                        }
                      }}
                      className="text-xs"
                    >
                      <Save size={10} className="mr-1" /> Save
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground mt-0.5 truncate">{entry.value}</div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
