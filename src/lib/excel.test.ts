// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportSchedulesToExcel } from './excel';
import { createSeedSchedules } from './seed';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportSchedulesToExcel', () => {
  it('menghasilkan file .xlsx yang valid (ZIP) dan memicu unduhan', async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:mock';
    });
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

    let downloadedName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });

    const schedules = createSeedSchedules('2026-10-21');
    await exportSchedulesToExcel(schedules, '2026-10-21');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(blobs[0].size).toBeGreaterThan(1000);
    expect(downloadedName).toBe('tenggat-2026-10-21.xlsx');

    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    // File xlsx adalah arsip ZIP: dua byte pertama "PK".
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('tetap menghasilkan file walau tidak ada riwayat', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await exportSchedulesToExcel(
      [
        {
          id: 'x',
          title: 'Tanpa riwayat',
          category: 'dokumen',
          kind: 'fixed',
          dueDate: '2027-01-01',
          remindBeforeDays: 30,
          history: [],
          createdAt: '2026-10-21T00:00:00.000Z',
          updatedAt: '2026-10-21T00:00:00.000Z',
        },
      ],
      '2026-10-21',
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
