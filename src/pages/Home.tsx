import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, LogIn } from "lucide-react";
import { ConnectButton } from "@mysten/dapp-kit";

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const ROOM = code.trim().toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-gradient-card border border-border/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-foreground">Sui Quiz</CardTitle>
            {/* Wallet belongs here (host/create & join screen) */}
            <ConnectButton />
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* HOST */}
            <div className="rounded-xl p-5 border border-border/50 bg-background/50 backdrop-blur-sm">
              <div className="text-sm text-muted-foreground mb-2">Host</div>
              <p className="text-foreground mb-4">
                Create a new room and let people join via QR code.
              </p>
              <Button
                onClick={() => navigate("/host")}
                className="w-full font-semibold hover:shadow-glow"
              >
                <Play className="h-4 w-4 mr-2" />
                Start a Room
              </Button>
            </div>

            {/* JOIN */}
            <div className="rounded-xl p-5 border border-border/50 bg-background/50 backdrop-blur-sm">
              <div className="text-sm text-muted-foreground mb-2">Join</div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. TEST01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ROOM && navigate(`/play/${ROOM}`)}
                  className="bg-background/50 border-border"
                />
                <Button
                  onClick={() => ROOM && navigate(`/play/${ROOM}`)}
                  disabled={!ROOM}
                  className="px-6 font-semibold"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Join
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Room code isn’t case sensitive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
