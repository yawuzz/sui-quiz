// src/pages/Home.tsx
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const nav = useNavigate();
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen p-6 bg-gradient-background">
      <div className="max-w-xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Sui Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => nav("/host")}>
              Host a Room
            </Button>

            <div className="flex gap-2">
              <Input
                placeholder="Enter room code (e.g. TEST01)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <Button
                disabled={!code.trim()}
                onClick={() => nav(`/play/${code.trim()}`)}
              >
                Join
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
