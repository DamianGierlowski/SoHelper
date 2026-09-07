import { useEffect, useState } from 'react';

/**
 * Jeden zegar na cala aplikacje. Zwraca `Date.now()` odswiezane co sekunde -
 * liczniki wyliczaja z niego pozostaly czas, zamiast dekrementowac wlasne wartosci.
 * Dzieki temu sen komputera niczego nie rozjezdza, a sygnal `onWake` z procesu
 * glownego przelicza wszystko natychmiast po wybudzeniu.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = (): void => setNow(Date.now());
    const timer = setInterval(tick, intervalMs);
    const unsubscribe = window.api.onWake(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [intervalMs]);

  return now;
}
