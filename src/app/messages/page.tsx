"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, MessageSquare, Plus, Link } from "lucide-react";
import { cn } from "@/lib/utils";

type LinkedTodo = { id: string; linkType: string; todo: { id: string; title: string; status: string } };
type Message = {
  id: string; sourceChannel: "GMAIL" | "DISCORD" | "SLACK" | "MANUAL";
  externalId: string; senderName: string; senderEmail: string;
  subject: string; body: string; sourceUrl: string;
  receivedAt: string; createdAt: string; todos: LinkedTodo[];
};

const BADGE_STYLES: Record<string, string> = {
  DISCORD: "bg-indigo-100 text-indigo-700",
  GMAIL: "bg-red-100 text-red-700",
  SLACK: "bg-purple-100 text-purple-700",
  MANUAL: "bg-gray-100 text-gray-700",
};
const BADGE_LABELS: Record<string, string> = { DISCORD: "Discord", GMAIL: "Gmail", SLACK: "Slack", MANUAL: "Manual" };

type TabKey = "all" | "discord" | "gmail" | "unlinked";
const TAB_PARAMS: Record<TabKey, Record<string, string>> = {
  all: {}, discord: { channel: "DISCORD" }, gmail: { channel: "GMAIL" }, unlinked: { linked: "false" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMessages = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(TAB_PARAMS[tab]);
      const res = await fetch(`/api/messages?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMessages(activeTab); }, [activeTab, fetchMessages]);

  function openDialog(msg: Message) {
    setSelected(msg);
    setTodoTitle(msg.subject || msg.body.slice(0, 80));
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setSelected(null); setTodoTitle(""); }

  async function handleCreate() {
    if (!selected || !todoTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: todoTitle.trim(), messageId: selected.id, linkType: "MANUAL" }),
      });
      if (res.ok) { closeDialog(); fetchMessages(activeTab); }
    } finally { setSubmitting(false); }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="discord"><MessageSquare className="w-3.5 h-3.5 mr-1" />Discord</TabsTrigger>
          <TabsTrigger value="gmail"><Mail className="w-3.5 h-3.5 mr-1" />Gmail</TabsTrigger>
          <TabsTrigger value="unlinked"><Link className="w-3.5 h-3.5 mr-1" />Unlinked</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{loading ? "Loading..." : `${messages.length} messages`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sender</TableHead>
                <TableHead>Subject / Preview</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>TODOs</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">No messages found.</TableCell>
                </TableRow>
              )}
              {messages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell className="font-medium">
                    <div>{msg.senderName}</div>
                    {msg.senderEmail && <div className="text-xs text-muted-foreground">{msg.senderEmail}</div>}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {msg.subject && <div className="font-medium text-sm truncate">{msg.subject}</div>}
                    <div className="text-xs text-muted-foreground truncate">{msg.body}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", BADGE_STYLES[msg.sourceChannel])}>
                      {BADGE_LABELS[msg.sourceChannel]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(msg.receivedAt || msg.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{msg.todos.length}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openDialog(msg)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Create TODO
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create TODO from Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="TODO title" />
            </div>
            {selected?.body && (
              <div>
                <label className="text-sm font-medium mb-1 block">Message Preview</label>
                <Textarea value={selected.body} readOnly rows={4} className="text-xs text-muted-foreground resize-none" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !todoTitle.trim()}>
              <Plus className="w-4 h-4 mr-1" />{submitting ? "Creating..." : "Create TODO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
