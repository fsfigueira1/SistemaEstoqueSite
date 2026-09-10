export type Role = 'OWNER' | 'EMPLOYEE' | 'VIEWER';

type PinEnv = {
  OWNER_PASSWORD?: string;
  EMPLOYEE_PASSWORD?: string;
  VIEWER_PIN?: string;
};

/**
 * Resolve um PIN para um papel. `VIEWER` só existe quando `VIEWER_PIN` está
 * configurado — usado no deploy público (Vercel), onde só o PIN de leitura
 * é distribuído. PIN vazio nunca casa.
 */
export function resolveRole(pin: string, env: PinEnv): Role | null {
  if (!pin) return null;
  if (env.OWNER_PASSWORD && pin === env.OWNER_PASSWORD) return 'OWNER';
  if (env.EMPLOYEE_PASSWORD && pin === env.EMPLOYEE_PASSWORD) return 'EMPLOYEE';
  if (env.VIEWER_PIN && pin === env.VIEWER_PIN) return 'VIEWER';
  return null;
}
