import { HashRouter, Route, Routes } from 'react-router-dom'
import AdminGate from './components/AdminGate'
import Navbar from './components/Navbar'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AdminPage from './pages/AdminPage'
import EventCheckInPage from './pages/EventCheckInPage'
import EventsPage from './pages/EventsPage'
import HomePage from './pages/HomePage'
import InternsPage from './pages/InternsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import MembersPage from './pages/MembersPage'
import SectionsPage from './pages/SectionsPage'

function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The page you are looking for does not exist in the Arm Lab Sign-In System.
      </p>
    </section>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AdminAuthProvider>
        <HashRouter>
          <div className="flex min-h-screen flex-col bg-app text-ink">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/sections" element={<SectionsPage />} />
                <Route path="/members" element={<MembersPage />} />
                <Route path="/interns" element={<InternsPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:id/checkin" element={<EventCheckInPage />} />
                <Route
                  path="/admin"
                  element={
                    <AdminGate>
                      <AdminPage />
                    </AdminGate>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
      </AdminAuthProvider>
    </ThemeProvider>
  )
}
