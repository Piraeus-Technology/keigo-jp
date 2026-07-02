import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetFlashcardSessionStoreForTests,
  useFlashcardSessionStore,
} from '../store/flashcardSessionStore';
import { __resetSessionStoreForTests, useSessionStore } from '../store/sessionStore';
import { getTodayKey } from '../utils/dayKey';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('session store day keys and persistence', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetSessionStoreForTests();
    __resetFlashcardSessionStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('quiz load normalizes parseable legacy day keys and writes migration once', async () => {
    mockStorage.set('sessions', JSON.stringify([
      { day: '6/10/2026', total: 2, correct: 1, streak: 1 },
      { day: '2026-06-10', total: 3, correct: 2, streak: 4 },
    ]));

    await useSessionStore.getState().loadSessions();

    const expected = [{ day: '2026-06-10', total: 5, correct: 3, streak: 4 }];
    expect(useSessionStore.getState().sessions).toEqual(expected);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual(expected);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('flashcard load normalizes parseable legacy day keys and writes migration once', async () => {
    mockStorage.set('flashcardSessions', JSON.stringify([
      { day: '6/10/2026', reviewed: 2, correct: 1 },
      { day: '2026-06-10', reviewed: 3, correct: 2 },
    ]));

    await useFlashcardSessionStore.getState().loadSessions();

    const expected = [{ day: '2026-06-10', reviewed: 5, correct: 3 }];
    expect(useFlashcardSessionStore.getState().sessions).toEqual(expected);
    expect(JSON.parse(mockStorage.get('flashcardSessions')!)).toEqual(expected);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('unparseable day keys stay unchanged and do not rewrite storage', async () => {
    const stored = [{ day: 'not-a-date', total: 2, correct: 1, streak: 1 }];
    mockStorage.set('sessions', JSON.stringify(stored));

    await useSessionStore.getState().loadSessions();

    expect(useSessionStore.getState().sessions).toEqual(stored);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual(stored);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test('quiz save waits for in-flight load and merges with loaded day', async () => {
    const today = getTodayKey();
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useSessionStore.getState().loadSessions();
    const savePromise = useSessionStore.getState().saveSession({ total: 2, correct: 1, streak: 1 });

    load.resolve(JSON.stringify([{ day: today, total: 5, correct: 4, streak: 3 }]));
    const [, saveResult] = await Promise.all([loadPromise, savePromise]);

    expect(useSessionStore.getState().sessions).toEqual([
      { day: today, total: 7, correct: 5, streak: 3 },
    ]);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual([
      { day: today, total: 7, correct: 5, streak: 3 },
    ]);
    expect(saveResult).toBe(true);
  });

  test('flashcard save after failed load refuses to clobber disk', async () => {
    const today = getTodayKey();
    mockStorage.set('flashcardSessions', JSON.stringify([{ day: today, reviewed: 80, correct: 60 }]));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    const saveResult = await useFlashcardSessionStore.getState().saveSession({ reviewed: 1, correct: 1 });

    expect(JSON.parse(mockStorage.get('flashcardSessions')!)).toEqual([
      { day: today, reviewed: 80, correct: 60 },
    ]);
    expect(useFlashcardSessionStore.getState()).toMatchObject({ loaded: false, loadError: true });
    expect(saveResult).toBe(false);
  });

  test('quiz save returns false and preserves memory when persistence fails', async () => {
    const today = getTodayKey();
    const stored = [{ day: today, total: 5, correct: 4, streak: 3 }];
    mockStorage.set('sessions', JSON.stringify(stored));
    await useSessionStore.getState().loadSessions();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    const saveResult = await useSessionStore.getState().saveSession({ total: 2, correct: 1, streak: 4 });

    expect(saveResult).toBe(false);
    expect(useSessionStore.getState().sessions).toEqual(stored);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual(stored);
  });

  test('flashcard save returns false and preserves memory when persistence fails', async () => {
    const today = getTodayKey();
    const stored = [{ day: today, reviewed: 5, correct: 4 }];
    mockStorage.set('flashcardSessions', JSON.stringify(stored));
    await useFlashcardSessionStore.getState().loadSessions();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    const saveResult = await useFlashcardSessionStore.getState().saveSession({ reviewed: 2, correct: 1 });

    expect(saveResult).toBe(false);
    expect(useFlashcardSessionStore.getState().sessions).toEqual(stored);
    expect(JSON.parse(mockStorage.get('flashcardSessions')!)).toEqual(stored);
  });

  test('quiz save attributes to an explicit day, not today', async () => {
    const today = getTodayKey();
    mockStorage.set('sessions', JSON.stringify([{ day: today, total: 1, correct: 1, streak: 1 }]));
    await useSessionStore.getState().loadSessions();

    const ok = await useSessionStore.getState().saveSession({ total: 2, correct: 1, streak: 2 }, '2026-06-26');

    expect(ok).toBe(true);
    expect(useSessionStore.getState().sessions).toContainEqual({ day: '2026-06-26', total: 2, correct: 1, streak: 2 });
    // The pre-existing "today" row is untouched.
    expect(useSessionStore.getState().sessions).toContainEqual({ day: today, total: 1, correct: 1, streak: 1 });
  });

  test('quiz save sorts sessions chronologically descending', async () => {
    mockStorage.set('sessions', JSON.stringify([
      { day: '2026-06-25', total: 1, correct: 1, streak: 1 },
      { day: '2026-06-27', total: 2, correct: 2, streak: 2 },
    ]));
    await useSessionStore.getState().loadSessions();

    const ok = await useSessionStore.getState().saveSession({ total: 3, correct: 3, streak: 3 }, '2026-06-26');

    expect(ok).toBe(true);
    expect(useSessionStore.getState().sessions).toEqual([
      { day: '2026-06-27', total: 2, correct: 2, streak: 2 },
      { day: '2026-06-26', total: 3, correct: 3, streak: 3 },
      { day: '2026-06-25', total: 1, correct: 1, streak: 1 },
    ]);
  });

  test('flashcard save attributes to an explicit day, not today', async () => {
    await useFlashcardSessionStore.getState().loadSessions();

    const ok = await useFlashcardSessionStore.getState().saveSession({ reviewed: 3, correct: 2 }, '2026-06-26');

    expect(ok).toBe(true);
    expect(useFlashcardSessionStore.getState().sessions).toEqual([{ day: '2026-06-26', reviewed: 3, correct: 2 }]);
  });

  test('flashcard save sorts sessions chronologically descending', async () => {
    mockStorage.set('flashcardSessions', JSON.stringify([
      { day: '2026-06-25', reviewed: 1, correct: 1 },
      { day: '2026-06-27', reviewed: 2, correct: 2 },
    ]));
    await useFlashcardSessionStore.getState().loadSessions();

    const ok = await useFlashcardSessionStore.getState().saveSession({ reviewed: 3, correct: 3 }, '2026-06-26');

    expect(ok).toBe(true);
    expect(useFlashcardSessionStore.getState().sessions).toEqual([
      { day: '2026-06-27', reviewed: 2, correct: 2 },
      { day: '2026-06-26', reviewed: 3, correct: 3 },
      { day: '2026-06-25', reviewed: 1, correct: 1 },
    ]);
  });
});
