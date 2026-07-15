/** Helper mínimo de fetch con timeout y errores tipados para los adapters live. */

export class LiveServiceError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** GET JSON con timeout. Lanza LiveServiceError en red caída / status != 2xx. */
export async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new LiveServiceError(`HTTP ${res.status} en ${url}`, url, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof LiveServiceError) throw err;
    throw new LiveServiceError(
      err instanceof Error ? err.message : 'Fallo de red',
      url,
    );
  } finally {
    clearTimeout(timer);
  }
}
