"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Download, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function SkillBrowser() {
  const { skills, setSkills } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillContent, setNewSkillContent] = useState("");

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills-new");
      if (res.ok) setSkills(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setSkills]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const categories = ["all", ...new Set(skills.map((s) => s.category ?? "general"))];

  const filtered = skills.filter((s) => {
    if (filterCategory !== "all" && (s.category ?? "general") !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    }
    return true;
  });

  const createSkill = async () => {
    if (!newSkillName.trim() || !newSkillDesc.trim() || !newSkillContent.trim()) return;
    try {
      const res = await fetch("/api/skills-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSkillName,
          description: newSkillDesc,
          content: newSkillContent,
          category: "general",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewSkillName(""); setNewSkillDesc(""); setNewSkillContent("");
      await fetchSkills();
      toast.success("Skill created");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-xs"
        />
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <Search size={14} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
              filterCategory === cat
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <ScrollArea className="max-h-48">
        <div className="space-y-1">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No skills found</div>
          ) : (
            filtered.map((skill) => (
              <div
                key={skill.id}
                className="border rounded-lg bg-muted/20 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-muted/40 transition-colors"
                >
                  {expandedId === skill.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <BookOpen size={12} className="text-muted-foreground" />
                  <span className="font-medium flex-1 text-left truncate">{skill.name}</span>
                  {skill.version && (
                    <Badge variant="secondary" className="text-[9px] h-4">{skill.version}</Badge>
                  )}
                  {skill.trustLevel && (
                    <Badge variant="outline" className="text-[9px] h-4">{skill.trustLevel}</Badge>
                  )}
                </button>

                {expandedId === skill.id && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    <p className="text-[11px] text-muted-foreground">{skill.description}</p>
                    {skill.content && (
                      <div className="text-[11px] prose prose-sm dark:prose-invert max-w-none max-h-48 overflow-auto">
                        <ReactMarkdown>{skill.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Create New Skill</div>
        <Input placeholder="Name" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} className="text-xs" />
        <Input placeholder="Description" value={newSkillDesc} onChange={(e) => setNewSkillDesc(e.target.value)} className="text-xs" />
        <textarea
          className="w-full text-xs border rounded-lg p-2 font-mono bg-muted resize-none"
          rows={4}
          value={newSkillContent}
          onChange={(e) => setNewSkillContent(e.target.value)}
          placeholder="SKILL.md content..."
        />
        <Button size="sm" onClick={createSkill} className="w-full">
          <Plus size={12} className="mr-1" /> Create Skill
        </Button>
      </div>
    </div>
  );
}
