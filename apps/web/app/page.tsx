"use client"

import dynamic from "next/dynamic"

const ChatInterface = dynamic(
  () => import("@/components/chat/chat-interface").then((m) => m.ChatInterface),
  { ssr: false }
)

const SettingsPanel = dynamic(
  () => import("@/components/settings-panel").then((m) => m.SettingsPanel),
  { ssr: false }
)

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10">
        <SettingsPanel />
      </div>
      <ChatInterface />
    </main>
  )
}
