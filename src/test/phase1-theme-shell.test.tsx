import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from '../components/Navbar'
import { ThemeProvider } from '../context/ThemeContext'
import { getSetting, setSetting } from '../db/settings'

vi.mock('../db/settings', () => ({
  THEME_SETTING_KEY: 'theme',
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

const mockedGetSetting = vi.mocked(getSetting)
const mockedSetSetting = vi.mocked(setSetting)

function renderShell() {
  return render(
    <ThemeProvider>
      <HashRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<div>Home Route</div>} />
          <Route path="/sections" element={<div>More Route</div>} />
          <Route path="*" element={<div>Other Route</div>} />
        </Routes>
      </HashRouter>
    </ThemeProvider>,
  )
}

describe('Phase 1 theme shell', () => {
  beforeEach(() => {
    window.location.hash = '#/leaderboard'
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    mockedGetSetting.mockReset()
    mockedSetSetting.mockReset()
    mockedGetSetting.mockResolvedValue('light')
    mockedSetSetting.mockResolvedValue(undefined)
    vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'getItem')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in light mode with the Moon icon, toggles to dark with the Lightbulb icon, persists to SQLite, and avoids web storage', async () => {
    renderShell()

    await waitFor(() => {
      expect(mockedGetSetting).toHaveBeenCalledWith('theme')
    })

    expect(document.documentElement).not.toHaveClass('dark')

    const lightModeButton = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(lightModeButton.querySelector('.lucide-moon')).not.toBeNull()
    expect(lightModeButton.querySelector('.lucide-lightbulb')).toBeNull()

    fireEvent.click(lightModeButton)

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark')
    })

    const darkModeButton = screen.getByRole('button', { name: 'Switch to light mode' })
    expect(darkModeButton.querySelector('.lucide-lightbulb')).not.toBeNull()
    expect(darkModeButton.querySelector('.lucide-moon')).toBeNull()

    await waitFor(() => {
      expect(mockedSetSetting).toHaveBeenCalledWith('theme', 'dark')
    })

    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
    expect(Storage.prototype.getItem).not.toHaveBeenCalled()
  })

  it('navigates back to the home route when the Arm Lab logo is clicked', async () => {
    renderShell()

    await waitFor(() => {
      expect(mockedGetSetting).toHaveBeenCalledWith('theme')
    })

    expect(screen.getByText('Other Route')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /arm lab home/i }))

    expect(await screen.findByText('Home Route')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/')
  })

  it('shows a More navigation link and no Back to Sign-In button on top-level screens', async () => {
    renderShell()

    await waitFor(() => {
      expect(mockedGetSetting).toHaveBeenCalledWith('theme')
    })

    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '#/sections')
    expect(screen.queryByRole('button', { name: /back to sign-in/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sections' })).not.toBeInTheDocument()
  })

  it('uses a More back link on section sub-screens', async () => {
    window.location.hash = '#/members'
    renderShell()

    await waitFor(() => {
      expect(mockedGetSetting).toHaveBeenCalledWith('theme')
    })

    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    expect(await screen.findByText('More Route')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/sections')
  })
})
