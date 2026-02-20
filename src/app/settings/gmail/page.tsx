"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

function createOauthState() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function GmailSettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function connectGmail() {
    const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI || "http://localhost:3000/api/integrations/gmail/callback";

    if (!clientId) {
      setError("GMAIL_CLIENT_ID not configured. Set NEXT_PUBLIC_GMAIL_CLIENT_ID in .env");
      return;
    }

    const state = createOauthState();
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `gmail_oauth_state=${encodeURIComponent(state)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      access_type: "offline",
      prompt: "consent",
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
      } else {
        setError(data.error || "Sync failed");
      }
    } catch {
      setError("Network error");
    }
    setSyncing(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gmail Integration</h1>
        <p className="text-muted-foreground">Connect Gmail to import email mentions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail OAuth Connection
          </CardTitle>
          <CardDescription>
            Connect with read-only access to import inbox messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={connectGmail}>
              <Mail className="mr-2 h-4 w-4" />
              Connect Gmail
            </Button>
            <Button variant="outline" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {syncResult && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Synced {syncResult.synced} new messages (found {syncResult.total} total)</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Go to{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Google Cloud Console
              </a>
            </li>
            <li>Create OAuth 2.0 Client ID (Web application)</li>
            <li>Add redirect URI: <code className="rounded bg-muted px-1">http://localhost:3000/api/integrations/gmail/callback</code></li>
            <li>Enable Gmail API</li>
            <li>Set environment variables in <code className="rounded bg-muted px-1">.env</code></li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between rounded bg-muted p-2">
              <span>GMAIL_CLIENT_ID</span>
              <Badge variant="outline">Required</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span>GMAIL_CLIENT_SECRET</span>
              <Badge variant="outline">Required</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span>GMAIL_REDIRECT_URI</span>
              <Badge variant="secondary">Optional (default: localhost)</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
