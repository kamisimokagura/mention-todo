"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Calendar, BarChart2, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type TodoStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
type TodoPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  deadline?: string;
  messages: { message: string }[];
  bundleMembers: { bundle: unknown }[];
}

interface Bundle { id: string; status: "SUGGESTED" | "CONFIRMED" | "REJECTED" }

const STATUS_CLS: Record<TodoStatus, string> = {
  OPEN: "bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ARCHIVED: "text-muted-foreground border border-border",
};

const PRIORITY_CLS: Record<TodoPriority, string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATS = [
  { key: "open" as const, label: "Open", cls: "text-foreground" },
  { key: "in_progress" as const, label: "In Progress", cls: "text-blue-600 dark:text-blue-400" },
  { key: "done" as const, label: "Done", cls: "text-green-600 dark:text-green-400" },
  { key: "urgent" as const, label: "Urgent", cls: "text-red-600 dark:text-red-400" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" as TodoPriority, deadline: "" });

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterStatus !== "ALL") p.set("status", filterStatus);
      if (filterPriority !== "ALL") p.set("priority", filterPriority);
      if (search) p.set("search", search);
      const res = await fetch(`/api/todos?${p}`);
      const data = await res.json();
      setTodos(data.todos ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, search]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);
  useEffect(() => {
    fetch("/api/bundles").then((r) => r.json()).then((d) => setBundles(d.bundles ?? [])).catch(() => {});
  }, []);

  const counts = {
    open: todos.filter((t) => t.status === "OPEN").length,
    in_progress: todos.filter((t) => t.status === "IN_PROGRESS").length,
    done: todos.filter((t) => t.status === "DONE").length,
    urgent: todos.filter((t) => t.priority === "URGENT").length,
  };

  const suggestedCount = bundles.filter((b) => b.status === "SUGGESTED").length;

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description || undefined, priority: form.priority, deadline: form.deadline || undefined }),
    });
    setForm({ title: "", description: "", priority: "MEDIUM", deadline: "" });
    setDialogOpen(false);
    fetchTodos();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/bundles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze" }) });
      const res = await fetch("/api/bundles");
      const data = await res.json();
      setBundles(data.bundles ?? []);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">TODO Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
            <span className="ml-1">Run Bundle Analysis</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /><span className="ml-1">Create TODO</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New TODO</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Title *</label>
                  <Input placeholder="TODO title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TodoPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Deadline</label>
                    <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!form.title.trim()}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bundle suggestion banner */}
      {suggestedCount > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="flex items-center gap-3 py-3">
            <Sparkles className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {suggestedCount} bundle suggestion{suggestedCount > 1 ? "s" : ""} available. Group related TODOs together.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <span className={cn("text-3xl font-bold", s.cls)}>{counts[s.key]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search TODOs..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {(["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"] as const).map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* TODO List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : todos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No TODOs found. Create one to get started.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <Card key={todo.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push(`/todos/${todo.id}`)}>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{todo.title}</p>
                  {todo.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{todo.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLS[todo.status])}>
                      {todo.status.replace("_", " ")}
                    </span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_CLS[todo.priority])}>
                      {todo.priority}
                    </span>
                    {todo.messages.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />{todo.messages.length}
                      </span>
                    )}
                    {todo.deadline && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{new Date(todo.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
