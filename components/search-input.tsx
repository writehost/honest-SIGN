"use client"

import { useState, useRef, useEffect } from "react"
import { Search, ArrowRight, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  onSearch: (query: string) => void
  isCompact?: boolean
  isLoading?: boolean
}

export function SearchInput({ onSearch, isCompact = false, isLoading = false }: SearchInputProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isCompact) {
      inputRef.current?.focus()
    }
  }, [isCompact])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", isCompact ? "max-w-2xl" : "max-w-3xl mx-auto")}>
      <div
        className={cn(
          "relative flex items-center rounded-2xl border transition-all duration-300",
          isFocused
            ? "border-accent/50 bg-secondary shadow-[0_0_30px_-10px] shadow-accent/20"
            : "border-border bg-secondary/50 hover:border-border/80",
          isCompact ? "h-12" : "h-14"
        )}
      >
        <div className={cn("flex items-center justify-center shrink-0", isCompact ? "pl-4" : "pl-5")}>
          {isLoading ? (
            <div className="size-5 rounded-full border-2 border-muted-foreground/30 border-t-accent animate-spin" />
          ) : (
            <Search className={cn("text-muted-foreground transition-colors", isFocused && "text-accent", isCompact ? "size-4" : "size-5")} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Введите DataMatrix код, GTIN или серийный номер..."
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60 font-sans",
            isCompact ? "px-3 text-sm" : "px-4 text-base"
          )}
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className={cn(
            "flex items-center justify-center shrink-0 rounded-xl transition-all duration-200 disabled:opacity-30",
            query.trim()
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground",
            isCompact ? "size-8 mr-2" : "size-10 mr-2"
          )}
        >
          <ArrowRight className={isCompact ? "size-4" : "size-5"} />
        </button>
      </div>

      {!isCompact && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <ScanLine className="size-3.5" />
            <span>DataMatrix</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">GTIN</span>
            <span>04600439931256</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">S/N</span>
            <span>JgXJ!93dGVz</span>
          </div>
        </div>
      )}
    </form>
  )
}
