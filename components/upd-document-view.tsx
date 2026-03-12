"use client"

import { FileText, Building2, User, Package } from "lucide-react"

type Doc = {
  header?: {
    documentId?: string
    docDate?: string
    processingDate?: string
    sender?: { inn?: string; name?: string }
    receiver?: { inn?: string; name?: string; address?: string }
    invoiceId?: string
    invoiceDateTime?: string
    total?: string
    vat?: string
    productGroups?: number[]
    turnoverType?: string
  }
  body?: {
    sellerInfo?: { name?: string; inn?: string; kpp?: string; address?: string }
    buyerInfo?: { name?: string; inn?: string; kpp?: string; address?: string }
    signerSeller?: { fullName?: string; position?: string }
    signerBuyer?: { fullName?: string }
    upd?: string
    updDate?: string
    sumNds?: string
    knd?: string
    function?: string
    formationCircumstances?: string
    cisesInfo?: Array<{ cis?: string; name?: string }>
  }
}

function formatDate(s: string | undefined): string {
  if (!s) return "—"
  const d = new Date(s)
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null
  return (
    <div className="flex flex-wrap gap-x-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="break-words">{String(value)}</span>
    </div>
  )
}

const CIS_VISIBLE = 50

export function UpdDocumentView({ doc }: { doc: unknown }) {
  const d = doc as Doc
  const header = d?.header
  const body = d?.body
  if (!header && !body) {
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(doc, null, 2)}
      </pre>
    )
  }

  const cises = body?.cisesInfo ?? []
  const hasMoreCises = cises.length > CIS_VISIBLE

  return (
    <div className="flex flex-col gap-4">
      {/* Верхний ряд: два блока по горизонтали */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Шапка документа */}
        {header && (
          <Section title="Реквизиты документа" icon={<FileText className="size-4" />}>
            <Row label="ID" value={header.documentId} />
            <Row label="Дата документа" value={formatDate(header.docDate)} />
            <Row label="Дата обработки" value={formatDate(header.processingDate)} />
            <Row label="Номер счёта" value={header.invoiceId} />
            <Row label="Дата счёта" value={formatDate(header.invoiceDateTime)} />
            <Row label="Сумма" value={header.total} />
            <Row label="НДС" value={header.vat} />
            <Row label="Товарные группы" value={header.productGroups?.join(", ")} />
          </Section>
        )}

        {/* Отправитель / Получатель */}
        {(header?.sender || header?.receiver) && (
          <Section title="Отправитель и получатель" icon={<Building2 className="size-4" />}>
            {header.sender && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Отправитель</p>
                <Row label="Название" value={header.sender.name} />
                <Row label="ИНН" value={header.sender.inn} />
              </div>
            )}
            {header.receiver && (
              <div className="space-y-1 mt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Получатель</p>
                <Row label="Название" value={header.receiver.name} />
                <Row label="ИНН" value={header.receiver.inn} />
                <Row label="Адрес" value={header.receiver.address} />
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Второй ряд: два блока по горизонтали */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Продавец / Покупатель (body) */}
        {(body?.sellerInfo || body?.buyerInfo) && (
          <Section title="Продавец и покупатель" icon={<Building2 className="size-4" />}>
            {body.sellerInfo && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Продавец</p>
                <Row label="Название" value={body.sellerInfo.name} />
                <Row label="ИНН" value={body.sellerInfo.inn} />
                <Row label="КПП" value={body.sellerInfo.kpp} />
                <Row label="Адрес" value={body.sellerInfo.address} />
              </div>
            )}
            {body.buyerInfo && (
              <div className="space-y-1 mt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Покупатель</p>
                <Row label="Название" value={body.buyerInfo.name} />
                <Row label="ИНН" value={body.buyerInfo.inn} />
                <Row label="КПП" value={body.buyerInfo.kpp} />
                <Row label="Адрес" value={body.buyerInfo.address} />
              </div>
            )}
          </Section>
        )}

        {/* Подписанты и УПД */}
        {(body?.signerSeller || body?.signerBuyer || body?.upd) && (
          <Section title="Подписание и УПД" icon={<User className="size-4" />}>
            {body.signerSeller && (
              <Row label="Подписант продавца" value={body.signerSeller.fullName} />
            )}
            {body.signerSeller?.position && (
              <Row label="Должность" value={body.signerSeller.position} />
            )}
            {body.signerBuyer?.fullName && (
              <Row label="Подписант покупателя" value={body.signerBuyer.fullName} />
            )}
            <Row label="Номер УПД" value={body.upd} />
            <Row label="Дата УПД" value={formatDate(body.updDate)} />
            {body.sumNds && <Row label="Сумма НДС" value={body.sumNds} />}
            {body.knd && <Row label="КНД" value={body.knd} />}
            {body.function && <Row label="Функция" value={body.function} />}
            {body.formationCircumstances && (
              <Row label="Обстоятельства формирования" value={body.formationCircumstances} />
            )}
          </Section>
        )}
      </div>

      {/* Список КИЗов — на всю ширину */}
      {cises.length > 0 && (
        <Section
          title={`Коды маркировки (КИЗ) — ${cises.length}`}
          icon={<Package className="size-4" />}
        >
          <div className="max-h-64 overflow-auto rounded border border-border bg-secondary/30">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground">№</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Код (CIS)</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Наименование</th>
                </tr>
              </thead>
              <tbody>
                {cises.slice(0, CIS_VISIBLE).map((item, i) => (
                  <tr key={item.cis ?? i} className="border-t border-border/50">
                    <td className="p-2 text-muted-foreground w-8">{i + 1}</td>
                    <td className="p-2 font-mono break-all">{item.cis ?? "—"}</td>
                    <td className="p-2 break-words">{item.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMoreCises && (
            <p className="text-xs text-muted-foreground">
              Показано {CIS_VISIBLE} из {cises.length} кодов. Остальные в полном документе.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}
