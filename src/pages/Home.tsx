// src/pages/Home.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, LogIn } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const ROOM = code.trim().toUpperCase();

  const startHost = () => navigate("/host");
  const joinRoom = () => {
    if (!ROOM) return;
    navigate(`/play/${ROOM}`);
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl bg-gradient-card border border-border/60">
        <CardHeader>
          <CardTitle className="text-center text-2xl text-foreground">Sui Quiz</CardTitle>
        </CardHeader>

        <CardContent>
          {/* İki aksiyon yan yana (mobilde alt alta) */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Host */}
            <div className="rounded-xl p-5 border border-border/50 bg-background/50">
              <div className="text-sm text-muted-foreground mb-2">Host</div>
              <p className="text-foreground mb-4">
                Yeni bir oda oluştur ve ekrandaki QR ile oyuncuları içeri al.
              </p>
              <Button onClick={startHost} className="w-full font-semibold">
                <Play className="h-4 w-4 mr-2" />
                Start a Room
              </Button>
            </div>

            {/* Join */}
            <div className="rounded-xl p-5 border border-border/50 bg-background/50">
              <div className="text-sm text-muted-foreground mb-2">Join</div>
              <label htmlFor="room" className="sr-only">Room code</label>
              <div className="flex gap-2">
                <Input
                  id="room"
                  placeholder="e.g. TEST01"
                  value={ROOM}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  className="bg-background/50 border-border"
                />
                <Button onClick={joinRoom} disabled={!ROOM} className="px-6 font-semibold">
                  <LogIn className="h-4 w-4 mr-2" />
                  Join
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Room kodu büyük/küçük harfe duyarlı değil.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
