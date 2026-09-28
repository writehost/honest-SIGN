import { Suspense } from "react"
import { BatchesScreen } from "@/components/mes/screens/batches-screen"

export default function Page() {
  return (
    <Suspense>
      <BatchesScreen />
    </Suspense>
  )
}
