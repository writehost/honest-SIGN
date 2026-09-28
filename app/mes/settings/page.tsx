import { Suspense } from "react"
import { SettingsScreen } from "@/components/mes/screens/settings-screen"

export default function Page() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  )
}
