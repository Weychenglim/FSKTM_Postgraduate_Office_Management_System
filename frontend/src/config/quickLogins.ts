export interface QuickLogin {
  course: string;
  role: string;
  name: string;
  email: string;
  password: string;
}

export interface QuickLoginGroup {
  course: string;
  logins: QuickLogin[];
}

interface QuickLoginEnvironment {
  DEV?: boolean;
  VITE_ENABLE_DEMO_LOGIN?: string;
  VITE_QUICK_LOGINS?: string;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function createQuickLogins(environment: QuickLoginEnvironment): QuickLoginGroup[] | null {
  if (environment.DEV !== true || environment.VITE_ENABLE_DEMO_LOGIN !== 'true' || !environment.VITE_QUICK_LOGINS) {
    return null;
  }
  let rows: unknown;
  try {
    rows = JSON.parse(environment.VITE_QUICK_LOGINS);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;

  const groups: QuickLoginGroup[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const login: QuickLogin = {
      course: text(row?.course),
      role: text(row?.role),
      name: text(row?.name),
      email: text(row?.email),
      password: typeof row?.password === 'string' ? row.password : '',
    };
    if (!login.role || !login.email || !login.password) continue;
    const group = groups.find(item => item.course === login.course);
    if (group) group.logins.push(login);
    else groups.push({ course: login.course, logins: [login] });
  }
  return groups.length ? groups : null;
}

const hasViteEnvironment = 'env' in import.meta;

export const QUICK_LOGINS =
  hasViteEnvironment && import.meta.env.DEV
    ? createQuickLogins({
        DEV: import.meta.env.DEV,
        VITE_ENABLE_DEMO_LOGIN: import.meta.env.VITE_ENABLE_DEMO_LOGIN,
        VITE_QUICK_LOGINS: import.meta.env.VITE_QUICK_LOGINS,
      })
    : null;
