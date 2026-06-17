"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Comment {
  id: string;
  authorId: string;
  content: string;
  mentions: string[];
  createdAt: string;
}

export function CommentSection({
  targetType,
  targetId,
}: {
  targetType: "Task" | "ContentDraft" | "PageAudit" | "GeoRun" | "Project" | "Optimization";
  targetId: string;
}) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  async function load() {
    const res = await fetch(
      `/api/comments?targetType=${targetType}&targetId=${targetId}`,
    );
    const json = await res.json();
    setComments(json.data ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, content, mentions }),
    });
    setPosting(false);
    if (res.ok) {
      setContent("");
      setMentions([]);
      void load();
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">评论（{comments.length}）</h3>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="写下你的评论...（用 @userId 提及他人）"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-between">
          <input
            type="text"
            value={mentions.join(",")}
            onChange={(e) => setMentions(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="提及 userId（逗号分隔）"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={posting || !content.trim()}
            className="ml-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {posting ? "发送中..." : "发送"}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无评论</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.authorId === session?.user?.id ? "我" : c.authorId.slice(0, 8)}</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                {c.mentions.length > 0 && (
                  <span className="text-blue-600">@ {c.mentions.length} 人</span>
                )}
              </div>
              <div className="mt-1 text-sm">{c.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
