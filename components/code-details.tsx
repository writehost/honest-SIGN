"use client"

import { Package, Building2, CalendarDays, Hash, FileText, Layers, CircleDot, LogOut, ChevronRight, ArrowUpRight, ChevronDown } from "lucide-react"
import type { CodeEntry } from "@/lib/mock-data"
import { StatusBadge, GroupTypeBadge } from "./status-badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

const TURNOVER_TYPE_LABELS: Record<string, string> = {
  SELLING: "Продажа",
  CONTRACT: "Передача по АКС",
}
const OGVS_LABELS: Record<string, string> = {
  RAR: "Росалкогольрегулирование",
  FTS: "ФТС России",
  FNS: "ФНС России",
  RSHN: "Россельхознадзор",
  RPN: "Роспотребнадзор",
  MVD: "МВД России",
  RZN: "Росздравнадзор",
}

interface CodeDetailsProps {
  entry: CodeEntry
  onNavigate?: (code: string) => void
  /** При клике по GTIN открыть модалку поиска по GTIN */
  onGtinClick?: (gtin: string) => void
}

export function CodeDetails({ entry, onNavigate, onGtinClick }: CodeDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <GroupTypeBadge type={entry.groupType} />
            <StatusBadge status={entry.status} />
          </div>
          <h2 className="font-mono text-sm text-foreground/90 break-all leading-relaxed">{entry.code}</h2>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
        <InfoCell icon={<Package className="size-4" />} label="Номенклатура" value={entry.nomenclature} />
        <div className="flex items-center gap-3 p-4 bg-card">
          <div className="shrink-0 text-muted-foreground mt-0.5">
            <CircleDot className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Статус</p>
            <StatusBadge status={entry.status} />
          </div>
        </div>
        <InfoCell
          icon={<Building2 className="size-4" />}
          label="Владелец"
          value={entry.owner}
          subtitle={entry.ownerInn && entry.ownerInn !== "—" ? `ИНН ${entry.ownerInn}` : undefined}
        />
        {onGtinClick && entry.gtin && entry.gtin !== "—" ? (
          <div className="flex items-start gap-3 p-4 bg-card">
            <div className="shrink-0 text-muted-foreground mt-0.5"><Hash className="size-4" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">GTIN</p>
              <button
                type="button"
                onClick={() => onGtinClick(entry.gtin!)}
                className="text-sm font-mono text-accent hover:underline break-all text-left"
              >
                {entry.gtin}
              </button>
            </div>
          </div>
        ) : (
          <InfoCell icon={<Hash className="size-4" />} label="GTIN" value={entry.gtin} mono />
        )}
        <InfoCell icon={<Hash className="size-4" />} label="Серийный номер" value={entry.serial} mono />
        <InfoCell icon={<CalendarDays className="size-4" />} label="Дата производства" value={formatDate(entry.productionDate)} />
        {entry.expirationDate && (
          <InfoCell icon={<CalendarDays className="size-4" />} label="Срок годности" value={formatDate(entry.expirationDate)} />
        )}
        {entry.batch && (
          <InfoCell icon={<FileText className="size-4" />} label="Партия" value={entry.batch} mono />
        )}
        <InfoCell icon={<Layers className="size-4" />} label="Товарная группа" value={entry.productGroup} />
        {(entry.tnVed || entry.tnVedEaesGroup) && (
          <InfoCell icon={<FileText className="size-4" />} label="ТН ВЭД" value={entry.tnVed ? `${entry.tnVed}${entry.tnVedEaesGroup ? ` (группа ${entry.tnVedEaesGroup})` : ""}` : entry.tnVedEaesGroup!} mono />
        )}
        {entry.brand && (
          <InfoCell icon={<Package className="size-4" />} label="Бренд" value={entry.brand} />
        )}
        {entry.withdrawReason && (
          <div className="sm:col-span-2 flex items-start gap-3 p-4 bg-card border-l-4 border-red-500/30">
            <div className="shrink-0 text-muted-foreground mt-0.5"><LogOut className="size-4" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Причина вывода из оборота</p>
              <p className="text-sm text-foreground/90">{entry.withdrawReason}</p>
            </div>
          </div>
        )}
        {entry.markWithdraw != null && (
          <div className="sm:col-span-2 flex items-start gap-3 p-4 bg-card">
            <div className="shrink-0 text-muted-foreground mt-0.5"><LogOut className="size-4" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Выбытие от не владельца</p>
              <p className="text-sm text-foreground/90">
                {entry.markWithdraw ? "Да — зафиксирована продажа по чеку от невладельца КИ в ГИС МТ" : "Нет"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Дополнительные данные из API */}
      <ExtraDataSection entry={entry} />

      {/* Parent Link */}
      {entry.parentCode && onNavigate && (
        <button
          onClick={() => onNavigate(entry.parentCode!)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 hover:bg-secondary transition-all group"
        >
          <div className="flex items-center gap-3">
            <ChevronRight className="size-4 text-muted-foreground" />
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Родительский элемент</p>
              <p className="text-sm font-mono text-foreground/90">{entry.parentCode}</p>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
        </button>
      )}

      {/* Children */}
      {entry.children && entry.children.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Вложенные элементы ({entry.children.length})
          </p>
          <div className="flex flex-col gap-1">
            {entry.children.map((child) => (
              <button
                key={child}
                onClick={() => onNavigate?.(child)}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/50 hover:border-accent/30 hover:bg-secondary transition-all group text-left"
              >
                <span className="font-mono text-xs text-foreground/80">{child}</span>
                <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === "—") return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(dateStr: string): string {
  if (!dateStr || dateStr === "—") return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function InfoCell({
  icon,
  label,
  value,
  subtitle,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-card">
      <div className="shrink-0 text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm text-foreground/90 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function ExtraDataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <span className="text-sm text-foreground/90 break-words">{value}</span>
    </div>
  )
}

function ExtraDataSection({ entry }: { entry: CodeEntry }) {
  const hasExtra =
    entry.applicationDate != null ||
    entry.introducedDate != null ||
    entry.producedDate != null ||
    entry.emissionDate != null ||
    entry.emissionType != null ||
    entry.turnoverType != null ||
    entry.producerInn != null ||
    entry.producerName != null ||
    entry.manufacturerInn != null ||
    entry.manufacturerName != null ||
    entry.isTracking != null ||
    entry.isMultipleSales != null ||
    entry.batchNumber != null ||
    entry.partyNumber != null ||
    entry.manufacturerSerialNumber != null ||
    entry.withdrawReasonOther != null ||
    (entry.ogvs != null && entry.ogvs.length > 0) ||
    (entry.licences != null && entry.licences.length > 0) ||
    (entry.certDoc != null && entry.certDoc.length > 0) ||
    entry.partialSaleInfo != null
  if (!hasExtra) return null

  return (
    <Collapsible className="rounded-xl border border-border overflow-hidden">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between rounded-none h-11 px-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Дополнительные данные из ответа API</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 bg-card/50 space-y-3 text-sm">
          {entry.applicationDate && <ExtraDataRow label="Дата нанесения" value={formatDateTime(entry.applicationDate)} />}
          {entry.introducedDate && <ExtraDataRow label="Дата ввода в оборот" value={formatDateTime(entry.introducedDate)} />}
          {entry.producedDate && <ExtraDataRow label="Дата производства (producedDate)" value={formatDateTime(entry.producedDate)} />}
          {entry.emissionDate && <ExtraDataRow label="Дата эмиссии" value={formatDateTime(entry.emissionDate)} />}
          {entry.emissionType && <ExtraDataRow label="Тип эмиссии" value={entry.emissionType} />}
          {entry.turnoverType && <ExtraDataRow label="Вид товарооборота" value={TURNOVER_TYPE_LABELS[entry.turnoverType] ?? entry.turnoverType} />}
          {entry.producerName != null && <ExtraDataRow label="Производитель / импортёр" value={[entry.producerName, entry.producerInn].filter(Boolean).join(", ИНН ")} />}
          {entry.manufacturerName != null && entry.producerName !== entry.manufacturerName && <ExtraDataRow label="Изготовитель" value={[entry.manufacturerName, entry.manufacturerInn].filter(Boolean).join(", ИНН ")} />}
          {entry.isTracking != null && <ExtraDataRow label="Признак прослеживаемости" value={entry.isTracking ? "Да" : "Нет"} />}
          {entry.isMultipleSales != null && <ExtraDataRow label="Признак множественных продаж" value={entry.isMultipleSales ? "Да" : "Нет"} />}
          {entry.batchNumber != null && <ExtraDataRow label="Номер серии" value={entry.batchNumber} />}
          {entry.partyNumber != null && <ExtraDataRow label="Номер партии" value={entry.partyNumber} />}
          {entry.manufacturerSerialNumber != null && <ExtraDataRow label="Заводской серийный номер" value={entry.manufacturerSerialNumber} />}
          {entry.withdrawReasonOther != null && <ExtraDataRow label="Описание другой причины вывода" value={entry.withdrawReasonOther} />}
          {entry.ogvs != null && entry.ogvs.length > 0 && (
            <ExtraDataRow
              label="Блокировка (органы)"
              value={entry.ogvs.map((o) => OGVS_LABELS[o] ?? o).join(", ")}
            />
          )}
          {entry.licences != null && entry.licences.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Лицензии на недра</p>
              <ul className="text-sm text-foreground/90 space-y-0.5">
                {entry.licences.map((l, i) => (
                  <li key={i}>
                    {l.licenceNumber ?? ""}
                    {l.licenceDate ? ` — ${formatDate(l.licenceDate)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.certDoc != null && entry.certDoc.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Разрешительные документы</p>
              <ul className="text-sm text-foreground/90 space-y-0.5">
                {entry.certDoc.map((c, i) => (
                  <li key={i}>
                    {c.number != null && <span>{c.number}</span>}
                    {c.type != null && <span> ({c.type})</span>}
                    {c.date != null && <span> — {c.date}</span>}
                    {c.wellNumber != null && <span> Скважина: {c.wellNumber}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.partialSaleInfo != null && (
            <ExtraDataRow
              label="Частичное выбытие"
              value={`Продано: ${entry.partialSaleInfo.soldUnitCount ?? "—"}, остаток: ${entry.partialSaleInfo.rest ?? "—"}${entry.partialSaleInfo.correctRest != null ? `, корректность: ${entry.partialSaleInfo.correctRest ? "да" : "нет"}` : ""}`}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
