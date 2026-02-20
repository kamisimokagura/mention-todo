"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Link as LinkIcon, Calendar, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TodoStatus, TodoPriority, SourceChannel, LinkType } from "@/types";

type Message = {
  id: string;
  sourceChannel: SourceChannel;
  senderName: string;
  body: string;
  sourceUrl: string | null;
  receivedAt: string;
};

type TodoMessage = {
  id: string;
  linkType: LinkType;
  message: Message;
};

type BundleTodo = { id: string; title: string };
type BundleMember = { todo: BundleTodo };
type Bundle = { id: string; status: string; autoLabel: string | null; members: BundleMember[] };
type BundleLink = { bundle: Bundle };

type Todo = {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  deadline: string | null;
  messages: TodoMessage[];
  bundleMembers: BundleLink[];
};

type AvailableMessage = { id: string; senderName: string; body: string; sourceChannel: SourceChannel };

const CHANNEL_COLOR: Record<string, string> = {
  DISCORD: "bg-indigo-100 text-indigo-800",
  GMAIL: "bg-red-100 text-red-800",
  SLACK: "bg-yellow-100 text-yellow-800",
  MANUAL: "bg-gray-100 text-gray-800",
};

const LINK_TYPE_COLOR: Record<string, string> = {
  AUTO: "bg-blue-100 text-blue-800",
  MANUAL: "bg-green-100 text-green-800",
  SUGGESTED: "bg-orange-100 text-orange-800",
};

function isSafeExternalUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function TodoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [availableMessages, setAvailableMessages] = useState<AvailableMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState("");

  const fetchTodo = useCallback(async () => {
    const res = await fetch(`/api/todos/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    setTodo(await res.json()); setLoading(false);
  }, [id, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTodo(); }, [fetchTodo]);

  const patch = useCallback(async (fields: Partial<Pick<Todo, "title" | "description" | "status" | "priority" | "deadline">>) => {
    if (!todo) return;
    setSaving(true);
    const res = await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    if (res.ok) setTodo(await res.json());
    setSaving(false);
  }, [id, todo]);

  const openLinkDialog = async () => {
    const res = await fetch("/api/messages?limit=50");
    if (res.ok) {
      const data = await res.json();
      setAvailableMessages(data.messages ?? data);
    }
    setLinkDialogOpen(true);
  };

  const linkMessage = async () => {
    if (!selectedMessageId) return;
    await fetch(`/api/todos/${id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: selectedMessageId, linkType: "MANUAL" }),
    });
    setLinkDialogOpen(false);
    setSelectedMessageId("");
    fetchTodo();
  };

  const deleteTodo = async () => {
    if (!confirm("このTODOを削除しますか？")) return;
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">読み込み中...</div>;
  if (!todo) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> ダッシュボード
          </Button>
        </Link>
        <Button variant="destructive" size="sm" onClick={deleteTodo}>
          <Trash2 className="mr-2 h-4 w-4" /> 削除
        </Button>
      </div>

      {/* Todo Details */}
      <Card>
        <CardHeader>
          <CardTitle>TODO 詳細</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">タイトル</label>
            <Input
              defaultValue={todo.title}
              onBlur={(e) => { if (e.target.value !== todo.title) patch({ title: e.target.value }); }}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">説明</label>
            <Textarea
              defaultValue={todo.description ?? ""}
              onBlur={(e) => { if (e.target.value !== (todo.description ?? "")) patch({ description: e.target.value }); }}
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ステータス</label>
              <Select value={todo.status} onValueChange={(v) => patch({ status: v as TodoStatus })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TodoStatus).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">優先度</label>
              <Select value={todo.priority} onValueChange={(v) => patch({ priority: v as TodoPriority })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TodoPriority).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> 期限
              </label>
              <Input
                type="date"
                defaultValue={todo.deadline ? todo.deadline.slice(0, 10) : ""}
                onBlur={(e) => patch({ deadline: e.target.value || null })}
                className="mt-1"
              />
            </div>
          </div>
          {saving && <p className="text-xs text-muted-foreground">保存中...</p>}
        </CardContent>
      </Card>

      {/* Source Messages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ソースメッセージ</CardTitle>
          <Button size="sm" variant="outline" onClick={openLinkDialog}>
            <LinkIcon className="mr-2 h-4 w-4" /> メッセージをリンク
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {todo.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">リンクされたメッセージはありません</p>
          ) : (
            todo.messages.map((tm) => (
              <div key={tm.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={CHANNEL_COLOR[tm.message.sourceChannel]}>
                    {tm.message.sourceChannel}
                  </Badge>
                  <span className="text-sm font-medium">{tm.message.senderName}</span>
                  <Badge className={LINK_TYPE_COLOR[tm.linkType]}>{tm.linkType}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{tm.message.body}</p>
                {isSafeExternalUrl(tm.message.sourceUrl) && (
                  <a href={tm.message.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      <ExternalLink className="mr-1 h-3 w-3" /> 元のメッセージを見る
                    </Button>
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Related Bundles */}
      {todo.bundleMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>関連バンドル</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todo.bundleMembers.map(({ bundle }) => (
              <div key={bundle.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{bundle.status}</Badge>
                  {bundle.autoLabel && <span className="text-sm font-medium">{bundle.autoLabel}</span>}
                </div>
                <Separator />
                <div className="space-y-1">
                  {bundle.members.map(({ todo: bt }) => (
                    <div key={bt.id} className="flex items-center gap-2">
                      <span className={`text-xs w-2 h-2 rounded-full ${bt.id === id ? "bg-blue-500" : "bg-gray-300"}`} />
                      <Link href={`/todos/${bt.id}`} className="text-sm hover:underline">
                        {bt.title}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Link Message Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メッセージをリンク</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableMessages.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMessageId(m.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedMessageId === m.id ? "border-blue-500 bg-blue-50" : "hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={CHANNEL_COLOR[m.sourceChannel]}>{m.sourceChannel}</Badge>
                  <span className="text-sm font-medium">{m.senderName}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.body}</p>
              </div>
            ))}
            {availableMessages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">メッセージがありません</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>キャンセル</Button>
            <Button onClick={linkMessage} disabled={!selectedMessageId}>リンクする</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
