/** Desktop carriers keep a complete interpreter payload even when SDK carriers choose Python-only. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { preparePrimaryRuntime as preparePayload } from '../../../scripts/primary-runtime/prepare.ts'
import { preparePrimaryRuntime, smokePrimaryRuntime } from '../scripts/prepare-primary-runtime.ts'

vi.mock('../../../scripts/primary-runtime/prepare.ts', () => ({
  preparePrimaryRuntime: vi.fn(),
  smokePrimaryRuntime: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

it('prepares the Linux ARM64 development interpreters without selecting an installer target', async () => {
  await preparePrimaryRuntime({ target: 'linux-arm64', deferSmoke: true })
  const options = vi.mocked(preparePayload).mock.calls[0]?.[0]
  expect(options?.target).toBe('linux-arm64')
  expect(options?.output).toContain(join('targets', 'linux-arm64', 'runtime'))
})

it.each([
  ['darwin', 'arm64', 'mac-arm64'],
  ['darwin', 'x64', 'mac-x64'],
  ['win32', 'x64', 'win-x64'],
] as const)('prepares the environment-selected %s %s release interpreters', async (platform, arch, target) => {
  vi.stubEnv('DSH_DESKTOP_TARGET_PLATFORM', platform)
  vi.stubEnv('DSH_DESKTOP_TARGET_ARCH', arch)
  await preparePrimaryRuntime({ deferSmoke: true })
  const options = vi.mocked(preparePayload).mock.calls[0]?.[0]
  expect(options?.target).toBe(target)
  expect(options?.output).toContain(join('targets', target, 'runtime'))
})

it('rejects a Python-only native Desktop payload before executing interpreters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-python-only-'))
  try {
    await writeFile(join(root, 'runtime.json'), JSON.stringify({
      desktopVersion: '1.0.0', platform: process.platform, arch: process.arch,
      python: '3.12.14', pythonPackages: { numpy: '2.3.5', pandas: '3.0.1' },
    }))
    expect(() => { smokePrimaryRuntime(root) }).toThrow('Desktop payload must declare node and pnpm')
  } finally { await rm(root, { recursive: true, force: true }) }
})
