"use client"

import { Truck, FileCheck, Factory, Wrench, Clock, User, FileText, MapPin, Layers, Package, Hash, Barcode, Calendar } from "lucide-react"
import type { ChestnyZnakData, IntegratorData } from "@/lib/mock-data"
import { StatusBadge } from "@/components/status-badge"

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function ChestnyZnakPanel({
  data,
  onOpenDocument,
}: {
  data: ChestnyZnakData
  onOpenDocument?: (docId: string) => void
}) {
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.updNumber && (
          <MiniCard
            icon={<FileCheck className="size-4" />}
            label="Номер УПД"
            value={data.updNumber}
          />
        )}
        {data.updDate && (
          <MiniCard
            icon={<Clock className="size-4" />}
            label="Дата УПД"
            value={formatDate(data.updDate)}
          />
        )}
        {data.lastOperationStatus ? (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="text-muted-foreground mt-0.5"><Truck className="size-4" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Последняя операция</p>
              <div className="mt-1"><StatusBadge status={data.lastOperationStatus} /></div>
            </div>
          </div>
        ) : (
          <MiniCard
            icon={<Truck className="size-4" />}
            label="Последняя операция"
            value={data.lastOperation}
          />
        )}
      </div>

      {data.certificate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
          <FileText className="size-3.5 text-accent shrink-0" />
          <span className="text-xs text-accent/90">Сертификат: {data.certificate}</span>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          История движения
        </h4>
        <div className="relative">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
          <div className="flex flex-col gap-0">
            {data.trackingHistory.map((event, i) => (
              <div key={i} className="relative flex items-start gap-4 py-3 group">
                <div className="relative z-10 shrink-0 mt-0.5">
                  <div className={`size-[23px] rounded-full border-2 flex items-center justify-center ${
                    i === data.trackingHistory.length - 1
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card"
                  }`}>
                    <div className={`size-2 rounded-full ${
                      i === data.trackingHistory.length - 1 ? "bg-accent" : "bg-muted-foreground/40"
                    }`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-border/50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-foreground/90 font-medium">{event.operation}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Building className="size-3 text-muted-foreground/60" />
                        <p className="text-xs text-muted-foreground">{event.participant}</p>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                        ИНН {event.participantInn}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  {(event.documentType || event.documentNumber) && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap items-center">
                      {event.documentType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground font-mono">
                          {event.documentType}
                        </span>
                      )}
                      {event.documentNumber && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          {event.documentNumber}
                        </span>
                      )}
                      {event.documentNumber && onOpenDocument && (
                        <button
                          type="button"
                          onClick={() => onOpenDocument(event.documentNumber!)}
                          className="text-[10px] text-accent hover:underline font-medium"
                        >
                          Открыть УПД
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function IntegratorPanel({ data }: { data: IntegratorData }) {
  const hasVekas = data.status != null || data.batchNumber != null || data.identificationCode != null || data.productName != null

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniCard
          icon={<Factory className="size-4" />}
          label="Дата эмиссии"
          value={formatDate(data.emissionDate)}
        />
        {data.applicationDate && (
          <MiniCard
            icon={<MapPin className="size-4" />}
            label="Дата нанесения"
            value={formatDate(data.applicationDate)}
          />
        )}
        {data.aggregationDate && (
          <MiniCard
            icon={<Layers className="size-4" />}
            label="Дата агрегации"
            value={formatDate(data.aggregationDate)}
          />
        )}
      </div>

      {/* Векас: статус, партия, линия, продукт */}
      {hasVekas && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Данные интегратора (Векас)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.status != null && (
              <MiniCard icon={<Package className="size-4" />} label="Статус" value={data.status} />
            )}
            {data.batchNumber != null && (
              <MiniCard icon={<Hash className="size-4" />} label="Номер партии" value={data.batchNumber} />
            )}
            {data.productLineName != null && (
              <MiniCard icon={<Factory className="size-4" />} label="Линия" value={data.productLineName} />
            )}
            {data.productName != null && (
              <MiniCard icon={<FileText className="size-4" />} label="Продукт" value={data.productName} />
            )}
            {data.productGtin != null && (
              <MiniCard icon={<Barcode className="size-4" />} label="GTIN" value={data.productGtin} />
            )}
            {data.productGroupType != null && (
              <MiniCard icon={<Layers className="size-4" />} label="Тип группы" value={data.productGroupType} />
            )}
            {data.aggregated != null && (
              <MiniCard icon={<Layers className="size-4" />} label="Агрегация" value={data.aggregated} />
            )}
            {data.isValidated != null && (
              <MiniCard icon={<FileCheck className="size-4" />} label="Валидирован" value={data.isValidated ? "Да" : "Нет"} />
            )}
            {data.isDefected != null && (
              <MiniCard icon={<Wrench className="size-4" />} label="Брак" value={data.isDefected ? "Да" : "Нет"} />
            )}
          </div>
          {(data.identificationCode != null || data.parentCode != null || (data.childrenCount != null && data.childrenCount > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              {data.identificationCode != null && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Идентификационный код</p>
                  <p className="text-xs font-mono break-all text-foreground/90">{data.identificationCode}</p>
                </div>
              )}
              {data.parentCode != null && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Родительский код</p>
                  <p className="text-xs font-mono break-all text-foreground/90">{data.parentCode}</p>
                </div>
              )}
              {data.childrenCount != null && data.childrenCount > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Дочерних кодов</p>
                  <p className="text-sm text-foreground/90">{data.childrenCount}</p>
                  {data.childrenCodes && data.childrenCodes.length > 0 && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer">Показать коды</summary>
                      <ul className="mt-1 max-h-32 overflow-y-auto text-[10px] font-mono text-muted-foreground space-y-0.5">
                        {data.childrenCodes.slice(0, 50).map((c, i) => (
                          <li key={i} className="truncate">{c}</li>
                        ))}
                        {data.childrenCodes.length > 50 && (
                          <li className="text-muted-foreground/70">… ещё {data.childrenCodes.length - 50}</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
          {(data.startDate != null || data.finalizationDate != null || data.productionDate != null || data.expirationDate != null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
              {data.startDate != null && (
                <MiniCard icon={<Calendar className="size-4" />} label="Начало" value={formatDateTime(data.startDate)} />
              )}
              {data.productionDate != null && (
                <MiniCard icon={<Factory className="size-4" />} label="Производство" value={formatDateTime(data.productionDate)} />
              )}
              {data.finalizationDate != null && (
                <MiniCard icon={<Layers className="size-4" />} label="Финализация" value={formatDateTime(data.finalizationDate)} />
              )}
              {data.expirationDate != null && (
                <MiniCard icon={<Clock className="size-4" />} label="Срок годности" value={formatDateTime(data.expirationDate)} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Production info */}
      {(data.lineNumber || data.shiftNumber) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
          <Wrench className="size-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data.lineNumber && <span>{data.lineNumber}</span>}
            {data.lineNumber && data.shiftNumber && (
              <span className="h-3 w-px bg-border" />
            )}
            {data.shiftNumber && <span>{data.shiftNumber}</span>}
          </div>
        </div>
      )}

      {/* Aggregation timeline */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          История формирования
        </h4>
        <div className="relative">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
          <div className="flex flex-col gap-0">
            {data.aggregationHistory.map((event, i) => (
              <div key={i} className="relative flex items-start gap-4 py-3 group">
                <div className="relative z-10 shrink-0 mt-0.5">
                  <div className={`size-[23px] rounded-full border-2 flex items-center justify-center ${
                    i === data.aggregationHistory.length - 1
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card"
                  }`}>
                    <div className={`size-2 rounded-full ${
                      i === data.aggregationHistory.length - 1 ? "bg-accent" : "bg-muted-foreground/40"
                    }`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-border/50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-foreground/90 font-medium">{event.operation}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                          {event.level}
                        </span>
                        {event.parentCode && (
                          <span className="text-[10px] font-mono text-muted-foreground/60">
                            {event.parentCode}
                          </span>
                        )}
                      </div>
                      {event.operator && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <User className="size-3 text-muted-foreground/60" />
                          <p className="text-xs text-muted-foreground">{event.operator}</p>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0">
                      {formatDate(event.date)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground/90 mt-0.5 break-all">{value}</p>
      </div>
    </div>
  )
}

function Building({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}
