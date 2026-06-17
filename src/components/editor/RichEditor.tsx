"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface RichEditorProps {
  content: string;            // Markdown 字符串
  onChange: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichEditor({ content, onChange, placeholder, editable = true }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? "开始写..." }),
    ],
    content,
    editable,
    immediatelyRender: false,  // 解决 SSR 问题
    onUpdate: ({ editor }) => {
      // 简化：把 HTML 转回 Markdown（粗暴实现：保留 HTML）
      // v1.2 改进：用 turndown 库做 HTML→MD 转换
      // 暂时直接存 HTML 字符串
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">加载编辑器...</div>;
  }

  return (
    <div className="rounded-md border border-border bg-background">
      {editable && (
        <div className="flex flex-wrap gap-1 border-b border-border p-2">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
            <span className="line-through">S</span>
          </ToolbarButton>
          <div className="mx-1 w-px bg-border" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>
            H1
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
            H2
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
            H3
          </ToolbarButton>
          <div className="mx-1 w-px bg-border" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
            • 列表
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
            1. 列表
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
            引用
          </ToolbarButton>
          <div className="mx-1 w-px bg-border" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
            代码
          </ToolbarButton>
          <ToolbarButton onClick={() => {
            const url = prompt("输入 URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }} active={editor.isActive("link")}>
            链接
          </ToolbarButton>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus:outline-none [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5"
      />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs hover:bg-muted ${active ? "bg-muted font-semibold" : ""}`}
    >
      {children}
    </button>
  );
}
