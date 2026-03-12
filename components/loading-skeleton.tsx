"use client"

import { cn } from "@/lib/utils"

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-secondary animate-pulse",
        className
      )}
    />
  )
}

export function LoadingView() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar skeleton */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Shimmer className="size-9 rounded-lg shrink-0" />
          <Shimmer className="flex-1 h-12 rounded-2xl" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Scanning animation */}
        <div className="flex flex-col items-center justify-center py-8 mb-8">
          <div className="relative mb-6">
            <div className="size-20 rounded-2xl border-2 border-accent/20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-x-0 h-px bg-accent/60 animate-scan" />
              </div>
              <svg
                className="size-8 text-accent/40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="8" x2="7" y2="8.01" />
                <line x1="11" y1="8" x2="11" y2="8.01" />
                <line x1="7" y1="12" x2="7" y2="12.01" />
                <line x1="15" y1="12" x2="17" y2="12.01" />
                <line x1="7" y1="16" x2="7" y2="16.01" />
                <line x1="11" y1="16" x2="11" y2="16.01" />
                <line x1="15" y1="8" x2="17" y2="8.01" />
                <line x1="11" y1="12" x2="11" y2="12.01" />
                <line x1="15" y1="16" x2="17" y2="16.01" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-sm text-muted-foreground">Запрос к серверам</p>
          </div>
          <p className="text-xs text-muted-foreground/50">Получение данных из Честного Знака и Интегратора</p>
        </div>

        {/* Code details skeleton */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2">
            <Shimmer className="h-6 w-20 rounded-md" />
            <Shimmer className="h-6 w-24 rounded-md" />
          </div>
          <Shimmer className="h-5 w-3/4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-card">
                <Shimmer className="size-4 rounded shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-4 w-full max-w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="space-y-6">
          <Shimmer className="h-11 w-72 rounded-xl" />

          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shimmer className="size-2 rounded-full" />
              <Shimmer className="h-4 w-40" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
                  <Shimmer className="size-4 rounded shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Shimmer className="h-2.5 w-16" />
                    <Shimmer className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline skeleton */}
            <div className="space-y-0 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 py-3">
                  <Shimmer className="size-[23px] rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 pb-3 border-b border-border/50">
                    <div className="flex justify-between">
                      <Shimmer className="h-4 w-48" />
                      <Shimmer className="h-3 w-20" />
                    </div>
                    <Shimmer className="h-3 w-32" />
                    <Shimmer className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
