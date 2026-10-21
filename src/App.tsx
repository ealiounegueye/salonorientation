import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppFooter } from './components/AppFooter'
import { Protected } from './components/Protected'
import { AdminPage } from './pages/AdminPage'
import { AdminParticipantPage } from './pages/AdminParticipantPage'
import { ConfirmationPage } from './pages/ConfirmationPage'
import { InscriptionPage } from './pages/InscriptionPage'
import { LoginPage } from './pages/LoginPage'
import { ReglagesPage } from './pages/ReglagesPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<InscriptionPage />} />
              <Route path="/confirmation/:code" element={<ConfirmationPage />} />
              <Route path="/admin/connexion" element={<LoginPage />} />
              <Route
                path="/admin"
                element={
                  <Protected>
                    <AdminPage />
                  </Protected>
                }
              />
              <Route
                path="/admin/reglages"
                element={
                  <Protected>
                    <ReglagesPage />
                  </Protected>
                }
              />
              <Route
                path="/admin/participants/:id"
                element={
                  <Protected>
                    <AdminParticipantPage />
                  </Protected>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <AppFooter />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
