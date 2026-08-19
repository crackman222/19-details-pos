import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Antrian from './pages/Antrian'
import TransaksiBaru from './pages/TransaksiBaru'
import Katalog from './pages/Katalog'
import Struk from './pages/Struk'
import RiwayatTransaksi from './pages/RiwayatTransaksi'
import Laporan from './pages/Laporan'
import DetailTreatment from './pages/DetailTreatment'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Antrian />} />
                <Route path="/transaksi-baru" element={<TransaksiBaru />} />
                <Route path="/katalog" element={<Katalog />} />
                <Route path="/riwayat" element={<RiwayatTransaksi />} />
                <Route path="/laporan" element={<Laporan />} />
                <Route path="/treatment/:id" element={<DetailTreatment />} />
                <Route path="/struk/:id" element={<Struk />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
