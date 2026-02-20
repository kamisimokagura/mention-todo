"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Layers, Check, X, RefreshCw, Link } from "lucide-react";
import { cn } from "@/lib/utils";

type TodoMessage = { message: { sourceChannel: string } };
type TodoMember = {
  id: string;
  todoId: string;
  todo: {
    id: string;
    title: string;
    status: string;
    priority: string;
    messages: TodoMessage[];
  };
};

type Bundle = {
  id: string;
  status: "SUGGESTED" | "CONFIRMED" | "REJECTED";
  similarityScore: number;
  autoLabel: string;
  createdAt: string;
  members: TodoMember[];
};

const statusColor: Record<Bundle["status"], string> = {
  SUGGESTED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
};

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBundles();
  }, []);

  async function fetchBundles() {
    setLoading(true);
    try {
      const res = await fetch("/api/bundles");
      const data = await res.json();
      setBundles(data.bundles ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function updateBundle(id: string, status: "CONFIRMED" | "REJECTED") {
    setActionLoading(id + status);
    try {
      await fetch(`/api/bundles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setBundles((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      });
      await fetchBundles();
    } finally {
      setAnalyzing(false);
    }
  }

  const byStatus = (status: Bundle["status"]) =>
    bundles.filter((b) => b.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="animate-spin mr-2 h-4 w-4" /> Loading bundles...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Bundles</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBundles}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="suggested">
        <TabsList>
          <TabsTrigger value="suggested">
            Suggested ({byStatus("SUGGESTED").length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({byStatus("CONFIRMED").length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({byStatus("REJECTED").length})
          </TabsTrigger>
        </TabsList>

        {(["SUGGESTED", "CONFIRMED", "REJECTED"] as const).map((status) => (
          <TabsContent key={status} value={status.toLowerCase()}>
            {byStatus(status).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
                <Link className="h-8 w-8 opacity-40" />
                <p>No {status.toLowerCase()} bundles.</p>
                {status === "SUGGESTED" && (
                  <Button onClick={runAnalysis} disabled={analyzing}>
                    {analyzing ? (
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <Layers className="h-4 w-4 mr-2" />
                    )}
                    Run Bundle Analysis
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 mt-4">
                {byStatus(status).map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    actionLoading={actionLoading}
                    onApprove={() => updateBundle(bundle.id, "CONFIRMED")}
                    onReject={() => updateBundle(bundle.id, "REJECTED")}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function BundleCard({
  bundle,
  actionLoading,
  onApprove,
  onReject,
}: {
  bundle: Bundle;
  actionLoading: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base font-semibold">
            {bundle.autoLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn("border text-xs", statusColor[bundle.status])}>
              {bundle.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {Math.round(bundle.similarityScore * 100)}% similar
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          {bundle.members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-sm">
              <Link className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{member.todo.title}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {member.todo.status}
              </Badge>
            </div>
          ))}
        </div>

        {bundle.status === "SUGGESTED" && (
          <>
            <Separator />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={actionLoading !== null}
                className="gap-1"
              >
                <Check className="h-4 w-4" /> Bundle these
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={actionLoading !== null}
                className="gap-1"
              >
                <X className="h-4 w-4" /> Not related
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
