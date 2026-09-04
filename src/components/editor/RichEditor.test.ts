import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const configuredStarterKit = { name: "starterKitWithoutLink" };
  const configuredLink = { name: "explicitLink" };
  const configuredPlaceholder = { name: "explicitPlaceholder" };

  return {
    configureStarterKit: vi.fn(() => configuredStarterKit),
    configureLink: vi.fn(() => configuredLink),
    configurePlaceholder: vi.fn(() => configuredPlaceholder),
    configuredStarterKit,
    configuredLink,
    configuredPlaceholder,
  };
});

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(),
  EditorContent: () => null,
}));
vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: mocks.configureStarterKit },
}));
vi.mock("@tiptap/extension-link", () => ({
  default: { configure: mocks.configureLink },
}));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: mocks.configurePlaceholder },
}));

import { createRichEditorOptions } from "./RichEditor";

describe("RichEditor Tiptap v3 compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables StarterKit Link while preserving explicit Link and Placeholder with transaction rerenders", () => {
    const options = createRichEditorOptions({
      content: "",
      onChange: vi.fn(),
      placeholder: "写点什么",
    });

    expect(mocks.configureStarterKit).toHaveBeenCalledWith({ link: false });
    expect(mocks.configureLink).toHaveBeenCalledWith({ openOnClick: false });
    expect(mocks.configurePlaceholder).toHaveBeenCalledWith({ placeholder: "写点什么" });
    expect(options).toEqual(expect.objectContaining({
      extensions: [
        mocks.configuredStarterKit,
        mocks.configuredLink,
        mocks.configuredPlaceholder,
      ],
      shouldRerenderOnTransaction: true,
    }));
  });

  it("uses one installed ProseMirror graph for headless blockquote and split commands", () => {
    const rootRequire = createRequire(import.meta.url);
    const reactRequire = createRequire(rootRequire.resolve("@tiptap/react"));
    const { Editor } = reactRequire("@tiptap/core") as { Editor: any };
    const ActualStarterKit = rootRequire("@tiptap/starter-kit").default as {
      configure: (options: { link: false }) => unknown;
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const blockquoteEditor = new Editor({
        element: null,
        immediatelyRender: false,
        extensions: [ActualStarterKit.configure({ link: false })],
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "alpha" }] }] },
      });
      expect(blockquoteEditor.commands.toggleBlockquote()).toBe(true);
      expect(blockquoteEditor.getJSON().content?.[0]?.type).toBe("blockquote");
      blockquoteEditor.destroy();

      const splitEditor = new Editor({
        element: null,
        immediatelyRender: false,
        extensions: [ActualStarterKit.configure({ link: false })],
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "beta" }] }] },
      });
      expect(splitEditor.commands.setTextSelection(3)).toBe(true);
      expect(splitEditor.commands.splitBlock()).toBe(true);
      expect(splitEditor.getJSON()).toEqual({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "be" }] },
          { type: "paragraph", content: [{ type: "text", text: "ta" }] },
        ],
      });
      splitEditor.destroy();

      const diagnostics = [...warnSpy.mock.calls, ...errorSpy.mock.calls].flat().map(String).join(" ");
      expect(diagnostics).not.toMatch(/Duplicate extension names|prosemirror.*(loaded more than once|duplicate)|(loaded more than once|duplicate).*prosemirror/i);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
