"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// 轻量级 Sonner 风格通知组件
type ToastType = "default" | "success" | "error" | "warning" | "info"

interface SonnerToast {
  id: string
  title: string
  description?: string
  type?: ToastType
  duration?: number
}

interface SonnerContextType {
  toasts: SonnerToast[]
  toast: (props: Omit<SonnerToast, "id">) => void
  dismiss: (id: string) => void
}

const SonnerContext = React.createContext<SonnerContextType | undefined>(undefined)

export function SonnerProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<SonnerToast[]>([])

  const toast = React.useCallback((props: Omit<SonnerToast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = props.duration ?? 4000
    
    setToasts((prev) => [...prev, { ...props, id }])
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <SonnerContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster />
    </SonnerContext.Provider>
  )
}

export function useSonner() {
  const context = React.useContext(SonnerContext)
  if (!context) {
    throw new Error("useSonner must be used within SonnerProvider")
  }
  return context
}

function Toaster() {
  const { toasts, dismiss } = useSonner()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function Toast({
  title,
  description,
  type = "default",
  onDismiss,
}: SonnerToast & { onDismiss: () => void }) {
  const styles = {
    default: "border-border",
    success: "border-l-success bg-success/5",
    error: "border-l-destructive bg-destructive/5",
    warning: "border-l-warning bg-warning/5",
    info: "border-l-info bg-info/5",
  }

  const icons = {
    default: null,
    success: <span className="text-success">✓</span>,
    error: <span className="text-destructive">✕</span>,
    warning: <span className="text-warning">⚠</span>,
    info: <span className="text-info">ℹ</span>,
  }

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border border-l-4 bg-card p-4 shadow-lg",
        "animate-in slide-in-from-right-5 fade-in duration-300",
        styles[type]
      )}
    >
      {icons[type]}
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
