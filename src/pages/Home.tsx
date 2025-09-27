// src/pages/Home.tsx
export default function Home() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Sui Quiz</h1>
        <p className="text-sm text-gray-500">Host a room or join with a code.</p>
        <div className="flex gap-3 justify-center">
          <a href="/host" className="px-4 py-2 rounded border">Host</a>
          <a href="/play/TEST01" className="px-4 py-2 rounded border">Join (TEST01)</a>
        </div>
      </div>
    </div>
  );
}
