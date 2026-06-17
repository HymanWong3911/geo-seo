"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { QuickAction } from "@/components/ui/QuickAction";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "DOING" | "REVIEW" | "DONE" | "IGNORED";
  sourceType: string;
  sourceId: string | null;
  url: string | null;
  priority: number;
  assignee: string | null;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string; domain: string };
}

const COLUMNS: { status: Task["status"]; label: string; color: string; icon: string; accent: string }[] = [
  { status: "TODO", label: "待办", color: "border-warning/50", icon: "📋", accent: "text-warning" },
  { status: "DOING", label: "进行中", color: "border-info/50", icon: "⚡", accent: "text-info" },
  { status: "REVIEW", label: "待审核", color: "border-primary/50", icon: "👀", accent: "text-primary" },
  { status: "DONE", label: "已完成", color: "border-success/50", icon: "✅", accent: "text-success" },
  { status: "IGNORED", label: "已忽略", color: "border-muted/50", icon: "🚫", accent: "text-muted-foreground" },
];

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "紧急", color: "text-destructive", bg: "bg-destructive/10" },
  2: { label: "高", color: "text-warning", bg: "bg-warning/10" },
  3: { label: "中", color: "text-info", bg: "bg-info/10" },
  4: { label: "低", color: "text-muted-foreground", bg: "bg-muted" },
  5: { label: "很低", color: "text-muted-foreground", bg: "bg-muted" },
};

export default function TaskBoardPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const url = new URL("/api/tasks", window.location.origin);
    if (projectId) url.searchParams.set("projectId", projectId);
    const res = await fetch(url);
    const json = await res.json();
    setTasks(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]);

  async function updateTaskStatus(taskId: string, newStatus: Task["status"]) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    }
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggingTask(task);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: Task["status"]) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, newStatus: Task["status"]) {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggingTask && draggingTask.status !== newStatus) {
      void updateTaskStatus(draggingTask.id, newStatus);
    }
    setDraggingTask(null);
  }

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    COLUMNS.forEach(col => { grouped[col.status] = []; });
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => a.priority - b.priority);
    });
    return grouped;
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "DONE").length;
    const highPriority = tasks.filter(t => t.priority <= 2 && t.status !== "DONE" && t.status !== "IGNORED").length;
    return { total, completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0, highPriority };
  }, [tasks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <header className="page-header">
          <div className="page-header-left">
            <div className="eyebrow">// TASKS — Board</div>
            <h1 className="mt-2">任务看板</h1>
          </div>
          <div className="page-header-right"><ProjectSelector /></div>
        </header>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* 页头 */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// TASKS — Board</div>
          <h1 className="mt-2">任务看板</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          <a href="/tasks" className="btn-ghost">← 列表视图</a>
        </div>
      </header>

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-px bg-border mb-6">
        <div className="cell">
          <div className="eyebrow">total</div>
          <div className="metric-number-sm mt-1">{stats.total}</div>
        </div>
        <div className="cell">
          <div className="eyebrow">completed</div>
          <div className="metric-number-sm mt-1 text-success">{stats.completed}</div>
        </div>
        <div className="cell">
          <div className="eyebrow">completion_rate</div>
          <div className="metric-number-sm mt-1">{stats.completionRate}%</div>
        </div>
        <div className="cell">
          <div className="eyebrow">high_priority</div>
          <div className="metric-number-sm mt-1 text-destructive">{stats.highPriority}</div>
        </div>
      </div>

      {/* Kanban 看板 */}
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map(col => (
          <div
            key={col.status}
            className={`flex flex-col rounded-lg border-2 transition-all ${
              dragOverColumn === col.status 
                ? `${col.color} bg-card ring-2 ring-primary/20` 
                : "border-border bg-card/50"
            }`}
            onDragOver={e => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.status)}
          >
            {/* 列头 */}
            <div className={`border-b-2 p-4 ${col.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="font-medium">{col.label}</span>
                </div>
                <span className="badge badge-muted">{tasksByStatus[col.status]?.length ?? 0}</span>
              </div>
            </div>
            
            {/* 任务卡片 */}
            <div className="flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 320px)" }}>
              {tasksByStatus[col.status]?.map((task, index) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task)}
                  onDragEnd={() => setDraggingTask(null)}
                  className={`card p-4 cursor-grab active:cursor-grabbing transition-all hover:border-primary/30 group ${
                    draggingTask?.id === task.id ? "opacity-50 scale-95" : ""
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* 优先级和来源 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`badge text-[10px] ${PRIORITY_CONFIG[task.priority]?.bg} ${PRIORITY_CONFIG[task.priority]?.color}`}>
                      P{task.priority} {PRIORITY_CONFIG[task.priority]?.label}
                    </span>
                    {task.sourceType && (
                      <span className="badge badge-muted text-[10px] opacity-60">{task.sourceType}</span>
                    )}
                  </div>
                  
                  {/* 标题 */}
                  <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {task.title}
                  </h4>
                  
                  {/* 描述 */}
                  {task.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  {/* 底部信息 */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                      {task.project.name}
                    </span>
                    {task.url && (
                      <a 
                        href={task.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        link ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
              
              {(!tasksByStatus[col.status] || tasksByStatus[col.status].length === 0) && (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  {col.status === "TODO" ? "拖拽任务到这 ↓" : "无任务"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 拖拽提示 */}
      {draggingTask && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-primary/30 rounded-lg px-6 py-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-primary">↔</span>
            <span className="text-sm">
              拖拽 <strong className="text-primary">{draggingTask.title.slice(0, 20)}...</strong> 到目标列
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
