// Paris arrondissement commune codes and approximate center coordinates
export const PARIS_ARRONDISSEMENTS: Record<
  number,
  { code: string; lat: number; lon: number; name: string }
> = {
  1: { code: "75101", lat: 48.8606, lon: 2.3376, name: "Paris 1er" },
  2: { code: "75102", lat: 48.8685, lon: 2.3439, name: "Paris 2e" },
  3: { code: "75103", lat: 48.8632, lon: 2.3592, name: "Paris 3e" },
  4: { code: "75104", lat: 48.8543, lon: 2.3574, name: "Paris 4e" },
  5: { code: "75105", lat: 48.8449, lon: 2.3504, name: "Paris 5e" },
  6: { code: "75106", lat: 48.8494, lon: 2.3326, name: "Paris 6e" },
  7: { code: "75107", lat: 48.8566, lon: 2.3117, name: "Paris 7e" },
  8: { code: "75108", lat: 48.8745, lon: 2.3106, name: "Paris 8e" },
  9: { code: "75109", lat: 48.8768, lon: 2.3379, name: "Paris 9e" },
  10: { code: "75110", lat: 48.876, lon: 2.3607, name: "Paris 10e" },
  11: { code: "75111", lat: 48.8593, lon: 2.3793, name: "Paris 11e" },
  12: { code: "75112", lat: 48.8396, lon: 2.3876, name: "Paris 12e" },
  13: { code: "75113", lat: 48.8322, lon: 2.355, name: "Paris 13e" },
  14: { code: "75114", lat: 48.8264, lon: 2.3271, name: "Paris 14e" },
  15: { code: "75115", lat: 48.8396, lon: 2.2958, name: "Paris 15e" },
  16: { code: "75116", lat: 48.8637, lon: 2.2769, name: "Paris 16e" },
  17: { code: "75117", lat: 48.8848, lon: 2.3087, name: "Paris 17e" },
  18: { code: "75118", lat: 48.8925, lon: 2.3444, name: "Paris 18e" },
  19: { code: "75119", lat: 48.8871, lon: 2.3822, name: "Paris 19e" },
  20: { code: "75120", lat: 48.8638, lon: 2.3985, name: "Paris 20e" },
};

export const DEFAULT_FINANCING = {
  rate: 3.5,
  durationYears: 20,
  notaryFeesPercent: 7.5,
  insuranceRatePercent: 0.34,
};
