"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Sparkline, DonutChart, EmptyState } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";

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
  1: { label: "紧急", color: "text-destructive", bg: "bg-destructive/15 border border-destructive/30" },
  2: { label: "高", color: "text-warning", bg: "bg-warning/15 border border-warning/30" },
  3: { label: "中", color: "text-info", bg: "bg-info/15 border border-info/30" },
  4: { label: "低", color: "text-muted-foreground", bg: "bg-muted border border-border" },
  5: { label: "很低", color: "text-muted-foreground", bg: "bg-muted border border-border" },
};

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "DONE" || status === "IGNORED") return false;
  return new Date(dueDate).getTime() < Date.now();
}

export default function TaskBoardPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const url = new URL("/api/tasks", window.location.origin);
    if (projectId) url.searchParams.set("projectId", projectId);
    const res = await fetch(url);
    const json = await res.json();
    setTasks(json.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

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

  // 过滤后的任务
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (priorityFilter !== null && t.priority !== priorityFilter) return false;
    if (searchQ && !t.title.toLowerCase().includes(searchQ.toLowerCase()) &&
        !(t.description ?? "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [tasks, priorityFilter, searchQ]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    COLUMNS.forEach(col => { grouped[col.status] = []; });
    filteredTasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => a.priority - b.priority);
    });
    return grouped;
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "DONE").length;
    const highPriority = tasks.filter(t => t.priority <= 2 && t.status !== "DONE" && t.status !== "IGNORED").length;
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status)).length;
    const inProgress = tasks.filter(t => t.status === "DOING").length;
    const todoCount = tasks.filter(t => t.status === "TODO").length;
    return {
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      highPriority,
      overdue,
      inProgress,
      todoCount,
    };
  }, [tasks]);

  // 状态分布饼图
  const statusBreakdown = useMemo(() => {
    const colors: Record<string, string> = {
      TODO: "hsl(38 92% 50%)",
      DOING: "hsl(217 91% 60%)",
      REVIEW: "hsl(33 38% 60%)",
      DONE: "hsl(142 71% 45%)",
      IGNORED: "hsl(220 9% 46%)",
    };
    return COLUMNS.map(col => ({
      label: col.label,
      value: tasks.filter(t => t.status === col.status).length,
      color: colors[col.status],
    })).filter(s => s.value > 0);
  }, [tasks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="page-header">
          <div className="page-header-left">
            <div className="eyebrow">// TASKS — Board</div>
            <h1 className="mt-2">任务看板</h1>
          </div>
          <div className="page-header-right"><ProjectSelector /></div>
        </header>
        <div className="grid grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// TASKS — Board</div>
          <h1 className="mt-2">任务看板</h1>
        </div>
        <div className="page-header-right"><ProjectSelector /></div>
      </header>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="eyebrow">total</div>
          <div className="metric-number mt-1">{stats.total}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">todo</div>
          <div className="metric-number mt-1 text-warning">{stats.todoCount}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">in_progress</div>
          <div className="metric-number mt-1 text-info">{stats.inProgress}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">high_priority</div>
          <div className={`metric-number mt-1 ${stats.highPriority > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.highPriority}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">overdue</div>
          <div className={`metric-number mt-1 ${stats.overdue > 0 ? "text-destructive" : "text-success"}`}>{stats.overdue}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{stats.completionRate}% completed</div>
        </div>
      </div>

      {/* 筛选条 + 状态饼图 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="eyebrow mb-3">filter</h3>
          <div className="flex gap-3 flex-wrap items-center">
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="搜索任务..."
              className="input-field flex-1 min-w-[200px]"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => setPriorityFilter(null)}
                className={`badge ${priorityFilter === null ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}
              >全部优先级</button>
              {[1, 2, 3, 4].map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                  className={`badge cursor-pointer ${priorityFilter === p
                    ? PRIORITY_CONFIG[p].bg + " " + PRIORITY_CONFIG[p].color
                    : "bg-muted text-muted-foreground border border-border"
                  }`}
                >P{p}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="eyebrow mb-3">status_distribution</h3>
          {statusBreakdown.length > 0 ? (
            <DonutChart
              segments={statusBreakdown}
              centerLabel="tasks"
              centerValue={stats.total}
              size={100}
              thickness={12}
            />
          ) : (
            <EmptyState icon="∅" description="暂无任务" />
          )}
        </div>
      </div>

      {/* Kanban 看板 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            <div className={`border-b-2 p-4 ${col.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="font-medium">{col.label}</span>
                </div>
                <span className="badge badge-muted font-mono">{tasksByStatus[col.status]?.length ?? 0}</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 380px)" }}>
              {tasksByStatus[col.status]?.map((task, index) => {
                const overdue = isOverdue(task.dueDate, task.status);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={() => setDraggingTask(null)}
                    className={`card p-4 cursor-grab active:cursor-grabbing transition-all hover:border-primary/30 group ${
                      draggingTask?.id === task.id ? "opacity-50 scale-95" : ""
                    } ${overdue ? "border-destructive/50 bg-destructive/5" : ""}`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* 优先级 + 来源 */}
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <span className={`badge text-[10px] font-mono ${PRIORITY_CONFIG[task.priority]?.bg} ${PRIORITY_CONFIG[task.priority]?.color}`}>
                        P{task.priority} {PRIORITY_CONFIG[task.priority]?.label}
                      </span>
                      {task.sourceType && (
                        <span className="badge bg-muted text-muted-foreground text-[10px] opacity-70">{task.sourceType}</span>
                      )}
                    </div>

                    <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* 底部: assignee + due date + url */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {task.assignee ? (
                          <div
                            className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-mono shrink-0"
                            title={task.assignee}
                          >
                            {getInitials(task.assignee)}
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] shrink-0" title="未分配">?</div>
                        )}
                        <span className="text-[10px] text-muted-foreground truncate">{task.project.name}</span>
                      </div>
                      {overdue && (
                        <span className="badge bg-destructive/20 text-destructive text-[10px] shrink-0">overdue</span>
                      )}
                      {!overdue && task.dueDate && (
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {(!tasksByStatus[col.status] || tasksByStatus[col.status].length === 0) && (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  {col.status === "TODO" ? "拖拽任务到这 ↓" : "无任务"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
