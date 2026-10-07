import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useApp, useSession } from '@/app/state'
import { Toaster } from '@/ui/kit'
import { Landing } from '@/pages/Landing'
import { Login, Signup } from '@/pages/Auth'
import { MobileShell } from '@/mobile/common'
import { MobileHome } from '@/mobile/Home'
import { MobileReceive } from '@/mobile/Receive'
import { MobilePickList, MobilePickTask } from '@/mobile/Pick'
import { MobilePack } from '@/mobile/Pack'
import { MobileMove } from '@/mobile/Move'
import { MobileInventory } from '@/mobile/Inventory'
import { MobileSearch } from '@/mobile/Search'
import { MobileJournal, MobileMore } from '@/mobile/Journal'
// The owner's cabinet is split out: the phone terminal never downloads it.
const Onboarding = lazy(() => import('@/pages/Onboarding').then((m) => ({ default: m.Onboarding })))
const DesktopShell = lazy(() => import('@/desktop/Shell').then((m) => ({ default: m.DesktopShell })))
const Overview = lazy(() => import('@/desktop/Overview').then((m) => ({ default: m.Overview })))
const Products = lazy(() => import('@/desktop/Products').then((m) => ({ default: m.Products })))
const StockPage = lazy(() => import('@/desktop/Stock').then((m) => ({ default: m.StockPage })))
const Orders = lazy(() => import('@/desktop/Orders').then((m) => ({ default: m.Orders })))
const Warehouse = lazy(() => import('@/desktop/Warehouse').then((m) => ({ default: m.Warehouse })))
const Receipts = lazy(() => import('@/desktop/Receipts').then((m) => ({ default: m.Receipts })))
const Journal = lazy(() => import('@/desktop/Journal').then((m) => ({ default: m.Journal })))
const ImportPage = lazy(() => import('@/desktop/Import').then((m) => ({ default: m.ImportPage })))
const Users = lazy(() => import('@/desktop/Users').then((m) => ({ default: m.Users })))
const Settings = lazy(() => import('@/desktop/Settings').then((m) => ({ default: m.Settings })))

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-paper" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/start" element={<Start />} />
          <Route path="/setup" element={<Onboarding />} />
          <Route path="/m" element={<MobileShell />}>
            <Route index element={<MobileHome />} />
            <Route path="receive" element={<MobileReceive />} />
            <Route path="pick" element={<MobilePickList />} />
            <Route path="pick/:orderId" element={<MobilePickTask />} />
            <Route path="pack" element={<MobilePack />} />
            <Route path="move" element={<MobileMove />} />
            <Route path="inventory" element={<MobileInventory />} />
            <Route path="search" element={<MobileSearch />} />
            <Route path="journal" element={<MobileJournal />} />
            <Route path="more" element={<MobileMore />} />
          </Route>
          <Route path="/app" element={<DesktopShell />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="orders" element={<Orders />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="receipts" element={<Receipts />} />
            <Route path="journal" element={<Journal />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </SessionProvider>
  )
}

/** After sign-in: phones and storekeepers go to the terminal, owners on a computer to the cabinet. */
function Start() {
  const { session } = useSession()
  const { user, org } = useApp()
  if (!session || !user) return <Navigate to="/login" replace />
  if (user.role === 'owner' && !org.onboardingDone) return <Navigate to="/setup" replace />
  const phone = window.matchMedia('(max-width: 820px)').matches
  return <Navigate to={phone || user.role === 'storekeeper' ? '/m' : '/app'} replace />
}
