import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetFavoritesStoreForTests,
  useFavoritesStore,
} from '../store/favoritesStore';
import {
  __resetHistoryStoreForTests,
  useHistoryStore,
} from '../store/historyStore';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('favorites and history persistence', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.mocked(AsyncStorage.getItem).mockImplementation(
      (key) => Promise.resolve(mockStorage.get(key) ?? null),
    );
    jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation((key) => {
      mockStorage.delete(key);
      return Promise.resolve();
    });
    __resetFavoritesStoreForTests();
    __resetHistoryStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  test('rapid favorite toggles serialize and persist the final state', async () => {
    await useFavoritesStore.getState().loadFavorites();
    const firstWrite = deferred();
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => firstWrite.promise);

    const add = useFavoritesStore.getState().toggleFavorite('行く');
    await Promise.resolve();
    const remove = useFavoritesStore.getState().toggleFavorite('行く');
    firstWrite.resolve();

    expect(await add).toBe(true);
    expect(await remove).toBe(true);
    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(JSON.parse(mockStorage.get('favorites')!)).toEqual([]);
  });

  test('rapid history additions serialize in user-action order', async () => {
    await useHistoryStore.getState().loadHistory();
    const firstWrite = deferred();
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => firstWrite.promise);

    const first = useHistoryStore.getState().addToHistory('行く');
    await Promise.resolve();
    const second = useHistoryStore.getState().addToHistory('来る');
    firstWrite.resolve();

    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(useHistoryStore.getState().history).toEqual(['来る', '行く']);
    expect(JSON.parse(mockStorage.get('keigo_history')!)).toEqual(['来る', '行く']);
  });

  test('favorite write failure leaves UI state unchanged', async () => {
    await useFavoritesStore.getState().loadFavorites();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    expect(await useFavoritesStore.getState().toggleFavorite('行く')).toBe(false);
    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(mockStorage.has('favorites')).toBe(false);
  });

  test('history write failure leaves UI state unchanged', async () => {
    await useHistoryStore.getState().loadHistory();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    expect(await useHistoryStore.getState().addToHistory('行く')).toBe(false);
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(mockStorage.has('keigo_history')).toBe(false);
  });

  test.each([
    ['favorites', () => useFavoritesStore.getState().loadFavorites(), () => useFavoritesStore.getState().favorites],
    ['keigo_history', () => useHistoryStore.getState().loadHistory(), () => useHistoryStore.getState().history],
  ])('%s sanitizes non-array and wrong-type payloads', async (key, load, getValues) => {
    mockStorage.set(key, JSON.stringify({ 0: '行く', invalid: 2 }));

    await load();

    expect(getValues()).toEqual([]);
    expect(JSON.parse(mockStorage.get(key)!)).toEqual([]);
  });

  test.each([
    ['favorites', () => useFavoritesStore.getState().loadFavorites(), () => useFavoritesStore.getState()],
    ['keigo_history', () => useHistoryStore.getState().loadHistory(), () => useHistoryStore.getState()],
  ])('%s resets invalid JSON and remains loaded', async (key, load, getState) => {
    mockStorage.set(key, '[not-json');

    await load();

    expect(mockStorage.has(key)).toBe(false);
    expect(getState()).toMatchObject({ loaded: true, loadError: false });
  });
});
