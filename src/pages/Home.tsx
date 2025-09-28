// src/pages/Home.tsx
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const nav = useNavigate();
  const account = useCurrentAccount();
  const [code, setCode] = useState("");

  const canUseApp = !!account; // cüzdan bağlı mı?

  return (
    <div className="min-h-screen bg-gradient-background p-6">
      <div className="max-w-3xl mx-auto">
        <Card className="bg-gradient-card border border-border/60">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Sui Quiz</CardTitle>
            <div className="mt-3 flex items-center justify-center">
              <ConnectButton />
            </div>
            {!canUseApp && (
              <p className="mt-2 text-xs text-muted-foreground">
                Please connect your wallet to create or join a room.
              </p>
            )}
          </CardHeader>

          <CardContent className="grid md:grid-cols-2 gap-4">
            {/* Create */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/40">
              <h3 className="font-semibold text-foreground mb-2">Create a Room</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start a new game and share the QR with players.
              </p>
              <Button
                disabled={!canUseApp}
                className="w-full"
                onClick={() => nav("/host")}
              >
                Create Room
              </Button>
              {!canUseApp && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Connect wallet first.
                </p>
              )}
            </div>

            {/* Join */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/40">
              <h3 className="font-semibold text-foreground mb-2">Join with Code</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. TEST01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="bg-background/50 border-border"
                  disabled={!canUseApp}
                />
                <Button
                  disabled={!canUseApp || !code.trim()}
                  onClick={() => nav(`/play/${code.trim()}`)}
                >
                  Join
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
