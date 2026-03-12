"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="size-9 rounded-lg border border-border bg-secondary/50" />
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative flex items-center justify-center size-9 rounded-lg border transition-all duration-300",
        "border-border bg-secondary/50 hover:bg-secondary hover:border-border/80"
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={cn(
          "size-4 absolute transition-all duration-300",
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100 text-foreground"
        )}
      />
      <Moon
        className={cn(
          "size-4 absolute transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100 text-foreground"
            : "-rotate-90 scale-0 opacity-0"
        )}
      />
    </button>
  )
}
