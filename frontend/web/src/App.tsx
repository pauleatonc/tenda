import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { LoginPage, RecoveryPage, RegisterPage, VerificationPage } from './auth/AuthPages'
import {
  ApplicationShell,
  DashboardPage,
  MorePage,
} from './app/AppShell'
import { ProfilePage } from './app/ProfilePage'
import './app/profile.css'
import { LandingPage } from './landing/LandingPage'
import './landing/landing.css'
import { ContactPage } from './public/ContactPage'
import { InventoryListPage } from './inventory/InventoryListPage'
import { InventoryExportsPage } from './inventory/InventoryExportsPage'
import { InventoryImportPage } from './inventory/InventoryImportPage'
import { ProductDetailPage } from './inventory/ProductDetailPage'
import { ProductCreateChooser } from './inventory/ProductCreateChooser'
import { ProductFormPage } from './inventory/ProductFormPage'
import { PublicCheckoutPage } from './public/PublicCheckoutPage'
import { PublicOrderPage } from './public/PublicOrderPage'
import { PublicProofPage } from './public/PublicProofPage'
import { PublicStatusPage } from './public/PublicStatusPage'
import { BalancesPage } from './sales/BalancesPage'
import { NewSalePage } from './sales/NewSalePage'
import { BillingPlanPage } from './billing/BillingPlanPage'
import { PaymentsSettingsPage } from './sales/PaymentsSettingsPage'
import { ReconciliationsPage } from './sales/ReconciliationsPage'
import { SaleDetailPage } from './sales/SaleDetailPage'
import { SalesListPage } from './sales/SalesListPage'
import { ShipmentDetailPage } from './shipping/ShipmentDetailPage'
import { ShippingListPage } from './shipping/ShippingListPage'
import './inventory/inventory.css'
import './sales/sales.css'
import './shipping/shipping.css'

function ConfigurationPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (params.has('paymentConnection')) {
    return <Navigate to={`/app/configuracion/pagos${location.search}`} replace />
  }
  return <ProfilePage />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/recuperar" element={<RecoveryPage />} />
      <Route path="/verificar-email" element={<VerificationPage />} />
      <Route path="/contacto" element={<ContactPage />} />
      <Route path="/p/:token" element={<PublicOrderPage />} />
      <Route path="/p/:token/comprar" element={<PublicCheckoutPage />} />
      <Route path="/p/:token/comprobante" element={<PublicProofPage />} />
      <Route path="/p/:token/estado" element={<PublicStatusPage />} />
      <Route path="/app" element={<ApplicationShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="inventario" element={<InventoryListPage />} />
        <Route path="inventario/nuevo" element={<ProductCreateChooser />} />
        <Route
          path="inventario/nuevo/manual"
          element={<ProductFormPage mode="create" origin="manual" />}
        />
        <Route
          path="inventario/nuevo/variante"
          element={<ProductFormPage mode="create" origin="variant" />}
        />
        <Route
          path="inventario/nuevo/asistida"
          element={<ProductFormPage mode="create" origin="assisted" />}
        />
        <Route path="inventario/importar" element={<InventoryImportPage />} />
        <Route path="inventario/exportaciones" element={<InventoryExportsPage />} />
        <Route path="inventario/:productId" element={<ProductDetailPage />} />
        <Route
          path="inventario/:productId/editar"
          element={<ProductFormPage mode="edit" />}
        />
        <Route path="ventas" element={<SalesListPage />} />
        <Route path="ventas/nueva" element={<NewSalePage />} />
        <Route path="ventas/reconciliaciones" element={<ReconciliationsPage />} />
        <Route path="ventas/:id" element={<SaleDetailPage />} />
        <Route path="despachos" element={<ShippingListPage />} />
        <Route path="despachos/:id" element={<ShipmentDetailPage />} />
        <Route path="balances" element={<BalancesPage />} />
        <Route path="mas" element={<MorePage />} />
        <Route path="configuracion/pagos" element={<PaymentsSettingsPage />} />
        <Route path="configuracion/plan" element={<BillingPlanPage />} />
        <Route path="configuracion" element={<ConfigurationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
