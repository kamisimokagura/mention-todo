"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, AlertCircle } from "lucide-react";

export default function DiscordSettingsPage() {
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testing, setTesting] = useState(false);

  async function testWebhook() {
    setTesting(true);
    setTestResult(null);
    if (!webhookSecret.trim()) {
      setTestResult("error");
      setTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/integrations/discord/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({
          messageId: "test_" + Date.now(),
          content: "Test message from settings page",
          authorName: "Settings Test",
          channelId: "test-channel",
          channelName: "test",
          guildName: "Test Guild",
          guildId: "test-guild",
          timestamp: new Date().toISOString(),
        }),
      });
      setTestResult(res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    }
    setTesting(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discord Integration</h1>
        <p className="text-muted-foreground">Connect a Discord bot to capture mentions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discord Bot Setup
          </CardTitle>
          <CardDescription>
            The Discord bot runs as a separate process and forwards mentions via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-2 font-medium">Setup Steps:</h3>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Create a Discord application at{" "}
                <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Discord Developer Portal
                </a>
              </li>
              <li>Create a Bot and copy the token</li>
              <li>Set <code className="rounded bg-muted px-1">DISCORD_BOT_TOKEN</code> in <code className="rounded bg-muted px-1">.env</code></li>
              <li>Set <code className="rounded bg-muted px-1">DISCORD_WEBHOOK_SECRET</code> (shared secret for auth)</li>
              <li>Invite the bot to your server with Message Content Intent</li>
              <li>Run <code className="rounded bg-muted px-1">cd discord-bot && npm install && node index.js</code></li>
            </ol>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook Secret (for testing)</label>
            <Input
              type="password"
              placeholder="Enter webhook secret to test"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={testWebhook} disabled={testing}>
              {testing ? "Testing..." : "Send Test Message"}
            </Button>
            {testResult === "success" && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" /> Connected
              </Badge>
            )}
            {testResult === "error" && (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 h-3 w-3" /> Failed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between rounded bg-muted p-2">
              <span>DISCORD_BOT_TOKEN</span>
              <Badge variant="outline">Required for bot</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span>DISCORD_WEBHOOK_SECRET</span>
              <Badge variant="outline">Required</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span>DISCORD_WATCHED_CHANNEL_IDS</span>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span>NEXT_APP_URL</span>
              <Badge variant="outline">Required for bot</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
