import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsHelp } from "@/components/shortcuts-help";

// Mock zustand store
vi.mock("@/lib/store", () => ({
  useChatStore: vi.fn((selector) => {
    const state = { shortcutOverrides: {} };
    return selector ? selector(state) : state;
  }),
}));

// Ensure cleanup between tests
afterEach(() => cleanup());
afterAll(() => vi.restoreAllMocks());

// Mock requestAnimationFrame to execute immediately
vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
  cb(0);
  return 0;
});

// Mock cancelAnimationFrame (no-op)
vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

describe("ShortcutsHelp", () => {
  describe("open/close behavior", () => {
    it("does not render when open is false", () => {
      const { container } = render(
        <ShortcutsHelp open={false} onClose={() => {}} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the dialog when open is true", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const dialog = screen.getByRole("dialog", { name: "Klavye kısayolları" });
      expect(dialog).toBeInTheDocument();
    });

    it("calls onClose when the close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<ShortcutsHelp open={true} onClose={onClose} />);

      const dialog = screen.getByRole("dialog");
      const closeBtn = within(dialog).getByRole("button", { name: "Kapat" });
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const { container } = render(
        <ShortcutsHelp open={true} onClose={onClose} />,
      );

      // The backdrop is the outermost div (first child)
      const backdrop = container.firstChild as HTMLElement;
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when clicking the card content (not backdrop)", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<ShortcutsHelp open={true} onClose={onClose} />);

      // Click inside the card (the title)
      await user.click(screen.getByText("Klavye Kısayolları"));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("ARIA attributes", () => {
    it("has role='dialog', aria-modal='true', and aria-label on the dialog", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const dialog = screen.getByRole("dialog", { name: "Klavye kısayolları" });
      expect(dialog).toHaveAttribute("role", "dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Klavye kısayolları");
    });

    it("close button has aria-label='Kapat'", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const dialog = screen.getByRole("dialog");
      const closeBtn = within(dialog).getByRole("button", { name: "Kapat" });
      expect(closeBtn).toBeInTheDocument();
    });
  });

  describe("content rendering", () => {
    it("renders the title", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      expect(
        screen.getByText("Klavye Kısayolları"),
      ).toBeInTheDocument();
    });

    it("renders all shortcut descriptions from the config", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Kısayol yardımını aç/kapa")).toBeInTheDocument();
      expect(within(dialog).getByText("Context paneli aç/kapa")).toBeInTheDocument();
      expect(within(dialog).getByText("Ayarları aç/kapa")).toBeInTheDocument();
      expect(within(dialog).getByText("Önizlemeyi kapat")).toBeInTheDocument();
      expect(within(dialog).getByText("Dosya yükle")).toBeInTheDocument();
    });

    it("renders Kbd elements with key names from the config", () => {
      const { container } = render(
        <ShortcutsHelp open={true} onClose={() => {}} />,
      );
      const allKbd = container.querySelectorAll("kbd");
      const kbdTexts = Array.from(allKbd).map((kbd) => kbd.textContent);
      expect(kbdTexts).toContain("Escape");
      expect(kbdTexts).toContain("Ctrl+U");
      expect(kbdTexts).toContain("Delete");
      expect(kbdTexts).toContain("?");
      expect(kbdTexts).toContain("Ctrl+/");
      expect(kbdTexts).toContain("Ctrl+B");
      expect(kbdTexts).toContain("Ctrl+,");
    });

    it("renders the category headers", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Genel")).toBeInTheDocument();
      expect(within(dialog).getByText("Context Paneli")).toBeInTheDocument();
      expect(within(dialog).getByText("Ayarlar")).toBeInTheDocument();
    });

    it("renders the footer info text", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      expect(
        screen.getByText(
          "Kısayollar yalnızca metin girişi odakta değilken çalışır",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("focus management", () => {
    it("focuses the close button when the dialog opens", () => {
      render(<ShortcutsHelp open={true} onClose={() => {}} />);
      const closeBtn = screen.getByRole("button", { name: "Kapat" });
      expect(closeBtn).toHaveFocus();
    });

    it("does not render anything when dialog is closed", () => {
      const { container } = render(
        <ShortcutsHelp open={false} onClose={() => {}} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
