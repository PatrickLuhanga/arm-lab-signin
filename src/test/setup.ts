import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-sql', () => {
  const select = vi.fn().mockResolvedValue([])
  const execute = vi.fn().mockResolvedValue(undefined)

  return {
    default: {
      load: vi.fn().mockResolvedValue({ select, execute }),
    },
  }
})

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn().mockResolvedValue('C:/arm-lab'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

afterEach(() => {
  cleanup()
})
