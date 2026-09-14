import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { SupervisorRoute } from './components/SupervisorRoute'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Antrian from './pages/Antrian'
import TransaksiBaru from './pages/TransaksiBaru'
import Katalog from './pages/Katalog'
import Struk from './pages/Struk'
import RiwayatTransaksi from './pages/RiwayatTransaksi'
import Laporan from './pages/Laporan'
import DetailTreatment from './pages/DetailTreatment'
import KelolaStaf from './pages/KelolaStaf'
import KelolaUpah from './pages/KelolaUpah'

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
                {/* Treatment detail and the receipt stay open to staff — they
                    are where a ticket is actually worked (assigning workers,
                    the wash photo, taking payment), and Transaksi Baru lands
                    on the detail page right after submitting. */}
                <Route path="/treatment/:id" element={<DetailTreatment />} />
                <Route path="/struk/:id" element={<Struk />} />
                <Route element={<SupervisorRoute />}>
                  <Route path="/katalog" element={<Katalog />} />
                  <Route path="/riwayat" element={<RiwayatTransaksi />} />
                  <Route path="/laporan" element={<Laporan />} />
                  <Route path="/upah" element={<KelolaUpah />} />
                </Route>
                <Route element={<AdminRoute />}>
                  <Route path="/staf" element={<KelolaStaf />} />
                </Route>
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
