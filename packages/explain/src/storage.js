/**
 * Збереження в localStorage, стійке до його відсутності.
 *
 * У приватному вікні або при заблокованих даних сайту сам доступ до
 * localStorage кидає виняток — тому кожна операція загорнута в try/catch,
 * і застосунок має коректно працювати, коли сховище недоступне.
 */
export function createStorage(key) {
  function read(fallback = null) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(value) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function clear() {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* сховище недоступне — нічого страшного */
    }
  }

  return { read, write, clear };
}
