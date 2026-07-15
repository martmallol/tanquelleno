import { describe, expect, it } from 'vitest';
import { mockFuelPrices } from './fuelPrices.mock';

describe('fallback de precios (naftas.com.ar mock)', () => {
  it('estación con precio puntual → exacto (source station)', async () => {
    const p = await mockFuelPrices.priceAtStation('axion-ayacucho', 'buenos-aires', 'super');
    expect(p.exact).toBe(true);
    expect(p.source).toBe('station');
    expect(p.pricePerLiter).toBe(1598);
  });

  it('estación sin precio puntual → cae al promedio provincial (estimado)', async () => {
    // 'shell-necochea' no está en STATION_PRICES a propósito
    const p = await mockFuelPrices.priceAtStation('shell-necochea', 'buenos-aires', 'super');
    expect(p.exact).toBe(false);
    expect(p.source).toBe('province');
    expect(p.pricePerLiter).toBe(1655); // promedio Buenos Aires
  });

  it('provincia desconocida → cae al promedio nacional', async () => {
    const p = await mockFuelPrices.priceAtStation('estacion-x', 'provincia-inexistente', 'super');
    expect(p.exact).toBe(false);
    expect(p.source).toBe('national');
    expect(p.pricePerLiter).toBe(1648);
  });

  it('provinceAverage devuelve source province', async () => {
    const p = await mockFuelPrices.provinceAverage('cordoba', 'premium');
    expect(p.source).toBe('province');
    expect(p.exact).toBe(false);
  });
});
