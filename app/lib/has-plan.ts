// app/lib/has-plan.ts

export type PlanKey = "talent" | "networking" | "bundle";

/**
 * Oczekiwany kształt odpowiedzi z /api/me/entitlements:
 * {
 *   user_id: string,
 *   entitlements: { talent: boolean, networking: boolean, bundle: boolean },
 *   subscriptions: [...]
 * }
 *
 * Dodatkowo wspieramy legacy: ent.plans
 */
export type EntitlementsResponse = {
  user_id?: string;
  entitlements?: Partial<Record<PlanKey, boolean>>;
  plans?: Partial<Record<PlanKey, boolean>>; // legacy
  subscriptions?: any[];
};

export function hasPlan(
  ent: EntitlementsResponse | null | undefined,
  plan: PlanKey
): boolean {
  if (!ent) return false;

  // preferujemy nowe pole: entitlements, ale wspieramy legacy: plans
  const map = ent.entitlements ?? ent.plans;
  if (!map) return false;

  // bundle ma wszystko
  if (map.bundle) return true;

  return !!map[plan];
}

