"use client"

import { useState, useCallback } from "react"
import { ArrowLeft, Database, Factory, X } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CodeDetails } from "./code-details"
import { ChestnyZnakPanel, IntegratorPanel } from "./source-panels"
import { SearchInput } from "./search-input"
import { fetchDocument, fetchCisesSearch, type CisesSearchItem } from "@/lib/real-api"
import { UpdDocumentView } from "@/components/upd-document-view"
import type { CodeEntry, ChestnyZnakData, IntegratorData } from "@/lib/mock-data"

const PRODUCT_GROUP_MAP: Record<string, number> = { water: 13, softdrinks: 12 }

interface ResultViewProps {
  entry: CodeEntry
  chestnyZnakData?: ChestnyZnakData
  integratorData?: IntegratorData
  onBack: () => void
  /** При переходе по коду (родитель/вложенный) вызывается поиск — родитель сам подгрузит данные */
  onSearch: (query: string) => void
  /** Токен ЧЗ для запроса УПД по docId */
  crptToken?: string
}

export function ResultView({
  entry: initialEntry,
  chestnyZnakData: initialCZ,
  integratorData: initialInt,
  onBack,
  onSearch,
  crptToken,
}: ResultViewProps) {
  const [entry, setEntry] = useState(initialEntry)
  const [czData, setCzData] = useState(initialCZ)
  const [intData, setIntData] = useState(initialInt)
  const [isNavigating, setIsNavigating] = useState(false)
  const [documentDocId, setDocumentDocId] = useState<string | null>(null)
  const [documentContent, setDocumentContent] = useState<unknown | null>(null)
  const [documentLoading, setDocumentLoading] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)

  const [gtinModalOpen, setGtinModalOpen] = useState(false)
  const [gtinModalGtin, setGtinModalGtin] = useState("")
  const [gtinModalProductGroup, setGtinModalProductGroup] = useState("water")
  const [gtinModalResult, setGtinModalResult] = useState<CisesSearchItem[]>([])
  const [gtinModalLoading, setGtinModalLoading] = useState(false)
  const [gtinModalError, setGtinModalError] = useState<string | null>(null)
  const [gtinPerPage, setGtinPerPage] = useState(100)

  const productGroupNum = (PRODUCT_GROUP_MAP[entry.productGroup] ?? Number(entry.productGroup)) || 13

  const handleOpenDocument = useCallback(
    (docId: string) => {
      if (!crptToken) return
      setDocumentDocId(docId)
      setDocumentError(null)
      setDocumentContent(null)
      setDocumentLoading(true)
      fetchDocument(docId, crptToken, productGroupNum)
        .then(setDocumentContent)
        .catch((e) => setDocumentError(e instanceof Error ? e.message : String(e)))
        .finally(() => setDocumentLoading(false))
    },
    [crptToken, productGroupNum]
  )

  const handleNavigate = (code: string) => {
    setIsNavigating(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
    onSearch(code)
    setIsNavigating(false)
  }

  const loadGtinSearch = useCallback(
    (gtin: string, productGroup: string, perPage: number) => {
      if (!crptToken) return
      setGtinModalLoading(true)
      setGtinModalError(null)
      const pg = productGroup && productGroup !== "—" ? productGroup : "water"
      fetchCisesSearch(
        crptToken,
        { gtins: [gtin], productGroups: [pg] },
        { perPage, direction: 0 }
      )
        .then((r) => setGtinModalResult(r.result ?? []))
        .catch((e) => setGtinModalError(e instanceof Error ? e.message : String(e)))
        .finally(() => setGtinModalLoading(false))
    },
    [crptToken]
  )

  const handleGtinClick = useCallback(
    (gtin: string) => {
      if (!gtin || gtin === "—" || !crptToken) return
      setGtinModalGtin(gtin)
      setGtinModalProductGroup(entry.productGroup && entry.productGroup !== "—" ? entry.productGroup : "water")
      setGtinModalOpen(true)
      setGtinModalResult([])
      setGtinModalError(null)
      loadGtinSearch(gtin, entry.productGroup || "water", gtinPerPage)
    },
    [crptToken, entry.productGroup, gtinPerPage, loadGtinSearch]
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="shrink-0 flex items-center justify-center size-9 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors"
            aria-label="Back to search"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </button>
          <div className="flex-1">
            <SearchInput onSearch={onSearch} isCompact isLoading={isNavigating} />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative">
        {/* Navigating overlay */}
        {isNavigating && (
          <div className="absolute inset-0 z-40 flex items-start justify-center pt-24 bg-background/60 backdrop-blur-sm rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-12">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Загрузка данных кода</p>
            </div>
          </div>
        )}

        {/* Code info */}
        <div className="mb-8">
          <CodeDetails
            entry={entry}
            onNavigate={handleNavigate}
            onGtinClick={crptToken && entry.gtin && entry.gtin !== "—" ? handleGtinClick : undefined}
          />
        </div>

        {/* Source tabs: Честный Знак и Интегратор (Векас) */}
        <Tabs defaultValue={initialCZ ? "chestnyznak" : "integrator"} className="w-full">
          <TabsList className="w-full sm:w-auto mb-6 bg-secondary border border-border h-11 p-1 rounded-xl">
            <TabsTrigger
              value="chestnyznak"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:text-foreground px-4"
            >
              <Database className="size-3.5" />
              <span>Честный Знак</span>
            </TabsTrigger>
            <TabsTrigger
              value="integrator"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:text-foreground px-4"
            >
              <Factory className="size-3.5" />
              <span>Интегратор (Векас)</span>
            </TabsTrigger>
          </TabsList>

            <TabsContent value="chestnyznak">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="size-2 rounded-full bg-accent" />
                  <h3 className="text-sm font-medium text-foreground">
                    Данные Честного Знака
                  </h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    УПД / Трекинг
                  </span>
                </div>
                {czData ? (
                  <ChestnyZnakPanel
                    data={czData}
                    onOpenDocument={crptToken ? handleOpenDocument : undefined}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">История движения не загружена.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="integrator">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="size-2 rounded-full bg-chart-2" />
                  <h3 className="text-sm font-medium text-foreground">
                    Данные Интегратора (Векас)
                  </h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Производство / Агрегация
                  </span>
                </div>
                {intData ? (
                  <IntegratorPanel data={intData} />
                ) : (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>Данные Векас не загружены.</p>
                    <p className="text-xs">
                      Включите «Параллельный поиск в Векас» в настройках на главной странице, укажите URL входа и API Векас, затем снова выполните поиск по коду.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
        </Tabs>

        {/* No source data message (legacy, when neither tab has content) */}
        {!czData && !intData && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              <X className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Дополнительные данные из источников не найдены
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Для данного кода доступна только базовая информация
            </p>
          </div>
        )}
      </main>

      {/* Модальное окно поиска по GTIN */}
      <Dialog open={gtinModalOpen} onOpenChange={(open) => !open && setGtinModalOpen(false)}>
        <DialogContent className="w-[95vw] max-w-none sm:max-w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">Поиск по GTIN — {gtinModalGtin}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground">
                Записей на странице:
                <select
                  value={gtinPerPage}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setGtinPerPage(v)
                    if (gtinModalOpen && gtinModalGtin) {
                      loadGtinSearch(gtinModalGtin, gtinModalProductGroup, v)
                    }
                  }}
                  className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => loadGtinSearch(gtinModalGtin, gtinModalProductGroup, gtinPerPage)}
                disabled={gtinModalLoading}
                className="text-sm px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 disabled:opacity-50"
              >
                {gtinModalLoading ? "Загрузка…" : "Обновить"}
              </button>
            </div>
            {gtinModalError && (
              <p className="text-sm text-destructive">{gtinModalError}</p>
            )}
            {gtinModalLoading && gtinModalResult.length === 0 && (
              <div className="flex justify-center py-12">
                <div className="size-10 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            )}
            {!gtinModalLoading && gtinModalResult.length === 0 && !gtinModalError && (
              <p className="text-sm text-muted-foreground">Нет данных</p>
            )}
            {gtinModalResult.length > 0 && (
              <div className="border border-border rounded-lg overflow-auto max-h-[60vh]">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted/90">
                    <tr>
                      <th className="text-left p-2 font-medium">№</th>
                      <th className="text-left p-2 font-medium">CIS / SGTIN</th>
                      <th className="text-left p-2 font-medium">GTIN</th>
                      <th className="text-left p-2 font-medium">Статус</th>
                      <th className="text-left p-2 font-medium">Дата эмиссии</th>
                      <th className="text-left p-2 font-medium">ИНН владельца</th>
                      <th className="text-left p-2 font-medium">Тип упаковки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gtinModalResult.map((row, i) => (
                      <tr key={row.cis ?? i} className="border-t border-border/50 hover:bg-secondary/30">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-mono break-all">
                          <button
                            type="button"
                            onClick={() => {
                              setGtinModalOpen(false)
                              onSearch(row.cis ?? row.sgtin ?? "")
                            }}
                            className="text-accent hover:underline text-left"
                          >
                            {row.cis ?? row.sgtin ?? "—"}
                          </button>
                        </td>
                        <td className="p-2 font-mono">{row.gtin ?? "—"}</td>
                        <td className="p-2">{row.status ?? "—"}</td>
                        <td className="p-2">
                          {row.emissionDate
                            ? new Date(row.emissionDate).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="p-2 font-mono">{row.ownerInn ?? row.producerInn ?? "—"}</td>
                        <td className="p-2">{row.generalPackageType ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {gtinModalResult.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Найдено записей: {gtinModalResult.length}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Модальное окно УПД */}
      <Dialog open={!!documentDocId} onOpenChange={(open) => !open && setDocumentDocId(null)}>
        <DialogContent className="w-[95vw] max-w-none sm:max-w-[95vw] max-h-[95vh] h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">Документ УПД</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-secondary/30 p-4">
            {documentLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="size-10 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            )}
            {documentError && (
              <p className="text-sm text-destructive">{documentError}</p>
            )}
            {!documentLoading && !documentError && documentContent != null && (
              <UpdDocumentView doc={documentContent} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
