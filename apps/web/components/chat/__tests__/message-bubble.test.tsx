import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MessageBubble } from "../message-bubble";

afterEach(cleanup);

const userMsg = {
  id: "1",
  role: "user" as const,
  content: "Hello World",
  timestamp: Date.now(),
};

const assistantMsg = {
  id: "2",
  role: "assistant" as const,
  content: "Hi there!",
  model: "gpt-4o-mini",
  timestamp: Date.now(),
};

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble message={userMsg} index={0} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    render(<MessageBubble message={assistantMsg} index={0} />);
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("renders model label", () => {
    render(<MessageBubble message={assistantMsg} index={0} />);
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
  });

  it("renders error state", () => {
    const errorMsg = { ...assistantMsg, content: "Error: API timeout" };
    render(<MessageBubble message={errorMsg} index={0} />);
    expect(screen.getByText("Error: API timeout")).toBeInTheDocument();
  });
});
