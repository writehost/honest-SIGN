import type { Metadata } from "next"
import { MesShell } from "@/components/mes/shell"

export const metadata: Metadata = {
  title: "SCADA System MES",
  description: "Рабочее место оператора линии маркировки бутылей 19 л и 11 л",
}

export default function MesLayout({ children }: { children: React.ReactNode }) {
  return <MesShell>{children}</MesShell>
}
