import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { QUIZZES, type Quiz, type Question } from "@/data/quizzes";
import { ArrowLeft, Play, Plus, Timer, Trophy } from "lucide-react";

type Mode = "pick" | "create";

export default function HostDashboard() {
  const navigate = useNavigate();

  const [roomCode] = useState(() =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  // ---- Tabs
  const [mode, setMode] = useState<Mode>("pick");

  // ---- Pick a Quiz
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedQuiz: Quiz | null = useMemo(
    () => QUIZZES.find((q) => q.id === selectedId) || null,
    [selectedId]
  );
  const [durationOverride, setDurationOverride] = useState<number>(20);

  // ---- Create Your Own
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{
    text: string;
    options: string[];
    correctIndex: number;
    points: number;
    durationSec: number;
  }>({
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    points: 100,
    durationSec: 20,
  });

  const addQuestion = () => {
    const ready =
      currentQuestion.text.trim() &&
      currentQuestion.options.every((o) => o.trim());
    if (!ready) return;

    const newQ: Question = {
      id: Date.now().toString(),
      text: currentQuestion.text.trim(),
      options: [...currentQuestion.options],
      correctIndex: currentQuestion.correctIndex,
      points: currentQuestion.points,
      durationSec: currentQuestion.durationSec,
    };
    setQuestions((prev) => [...prev, newQ]);
    setCurrentQuestion({
      text: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      points: 100,
      durationSec: 20,
    });
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const canStart =
    (mode === "pick" && !!selectedQuiz) ||
    (mode === "create" && questions.length > 0);

  const startRoom = () => {
    let qs: Question[] = [];
    if (mode === "pick" && selectedQuiz) {
      const sec = Math.max(5, Number(durationOverride) || 20);
      qs = selectedQuiz.questions.map(q => ({ ...q, durationSec: sec }));
    }
    if (mode === "create") qs = questions;

    if (qs.length === 0) return;
    navigate(`/room/${roomCode}`, { state: { questions: qs } });
  };

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate("/")}
              className="bg-card/50 border border-border hover:bg-card flex items-center gap-2"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Host Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Room Code:{" "}
                <span className="font-mono text-primary font-semibold">
                  {roomCode}
                </span>
              </p>
            </div>
          </div>

          <Button
            onClick={startRoom}
            disabled={!canStart}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300 font-semibold flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Room
          </Button>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setMode("pick")}
            className={`px-4 py-2 text-sm ${
              mode === "pick" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            Pick a Quiz
          </button>
          <button
            onClick={() => setMode("create")}
            className={`px-4 py-2 text-sm border-l border-border ${
              mode === "create" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            Create your own quiz
          </button>
        </div>

        {/* Content */}
        {mode === "pick" ? (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              {QUIZZES.map((q) => {
                const selected = selectedId === q.id;
                return (
                  <Card
                    key={q.id}
                    className={`cursor-pointer border ${
                      selected ? "border-primary ring-2 ring-primary/40" : "border-border/50"
                    }`}
                    onClick={() => setSelectedId(q.id)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{q.title}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            selected ? "bg-primary text-primary-foreground" : "bg-muted/30"
                          }`}
                        >
                          {selected ? "Selected" : "Pick"}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {q.description && (
                        <p className="text-sm text-muted-foreground">{q.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {q.questions.length} questions • answers pre-set
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Per-question duration override */}
            <div className="max-w-sm">
              <label className="text-sm font-medium block mt-4 mb-1">
                Per-question duration (seconds)
              </label>
              <input
                type="number"
                min={5}
                value={durationOverride}
                onChange={(e) => setDurationOverride(Math.max(5, Number(e.target.value)))}
                className="w-full h-10 rounded-md bg-background/50 border border-border px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will override durations of the selected quiz.
              </p>
            </div>
          </>
        ) : (
          <CreateView
            currentQuestion={currentQuestion}
            setCurrentQuestion={setCurrentQuestion}
            questions={questions}
            addQuestion={addQuestion}
            removeQuestion={removeQuestion}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Create View (custom builder) ---------- */
function CreateView({
  currentQuestion,
  setCurrentQuestion,
  questions,
  addQuestion,
  removeQuestion,
}: {
  currentQuestion: {
    text: string;
    options: string[];
    correctIndex: number;
    points: number;
    durationSec: number;
  };
  setCurrentQuestion: (q: typeof currentQuestion) => void;
  questions: Question[];
  addQuestion: () => void;
  removeQuestion: (id: string) => void;
}) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Builder */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Question
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Question
              </label>
              <Textarea
                placeholder="Enter your question…"
                value={currentQuestion.text}
                onChange={(e) =>
                  setCurrentQuestion({ ...currentQuestion, text: e.target.value })
                }
                className="bg-background/50 border-border min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {currentQuestion.options.map((o, i) => (
                <div key={i}>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Option {i + 1}
                    {i === currentQuestion.correctIndex && (
                      <Badge className="ml-2 bg-success/20 text-success">Correct</Badge>
                    )}
                  </label>
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={o}
                    onChange={(e) => {
                      const opts = [...currentQuestion.options];
                      opts[i] = e.target.value;
                      setCurrentQuestion({ ...currentQuestion, options: opts });
                    }}
                    onClick={() =>
                      setCurrentQuestion({ ...currentQuestion, correctIndex: i })
                    }
                    className={`bg-background/50 border-border ${
                      i === currentQuestion.correctIndex ? "border-success/50" : ""
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Points
                </label>
                <select
                  value={currentQuestion.points}
                  onChange={(e) =>
                    setCurrentQuestion({
                      ...currentQuestion,
                      points: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-10 rounded-md bg-background/50 border border-border px-3 text-sm"
                >
                  <option value={50}>50 Points</option>
                  <option value={100}>100 Points</option>
                  <option value={200}>200 Points</option>
                  <option value={500}>500 Points</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Duration
                </label>
                <select
                  value={currentQuestion.durationSec}
                  onChange={(e) =>
                    setCurrentQuestion({
                      ...currentQuestion,
                      durationSec: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-10 rounded-md bg-background/50 border border-border px-3 text-sm"
                >
                  <option value={10}>10 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>
            </div>

            <Button
              onClick={addQuestion}
              className="w-full bg-gradient-secondary hover:shadow-glow transition-all duration-300"
              disabled={
                !currentQuestion.text.trim() ||
                !currentQuestion.options.every((o) => o.trim())
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </CardContent>
        </Card>

        {/* Questions list */}
        {questions.length > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Quiz Questions ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 bg-background/30 rounded-lg border border-border/30"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-primary">
                            Q{idx + 1}
                          </span>
                          <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border">
                            <Timer className="h-3 w-3" />
                            {q.durationSec}s
                          </span>
                          <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border">
                            <Trophy className="h-3 w-3" />
                            {q.points} pts
                          </span>
                        </div>
                        <p className="font-medium text-foreground mb-2">{q.text}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {q.options.map((opt, oi) => (
                            <span
                              key={oi}
                              className={`p-2 rounded ${
                                oi === q.correctIndex
                                  ? "bg-success/20 text-success border border-success/30"
                                  : "bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={() => removeQuestion(q.id)}
                        className="border border-destructive text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips panel */}
      <div>
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Click an option to mark it as the correct answer.</p>
            <p>• Add multiple questions, then “Start Room”.</p>
            <p>• You can switch back to “Pick a Quiz” anytime.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
