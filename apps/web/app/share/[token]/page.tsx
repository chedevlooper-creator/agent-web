interface SharedMessage {
  role: string;
  content: string;
  model: string | null;
  timestamp: number;
}

interface SharedData {
  title: string;
  messages: SharedMessage[];
  sharedAt: number;
}

async function getSharedData(token: string): Promise<SharedData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/share?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SharedSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getSharedData(token);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Session Not Found</h1>
          <p className="mt-2 text-gray-400">
            This shared session does not exist or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold">{data.title}</h1>
          <p className="mt-1 text-xs text-gray-500">
            Shared session &middot; {data.messages.length} messages &middot;{" "}
            {new Date(data.sharedAt).toLocaleDateString()}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        {data.messages.map((msg: SharedMessage, i: number) => (
          <div
            key={i}
            className={`mb-6 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            <div
              className={`inline-block max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </p>
              {msg.model && (
                <p className="mt-1 text-[10px] opacity-50">{msg.model}</p>
              )}
            </div>
          </div>
        ))}
      </main>
      <footer className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-600">
        Powered by Agent Web
      </footer>
    </div>
  );
}
