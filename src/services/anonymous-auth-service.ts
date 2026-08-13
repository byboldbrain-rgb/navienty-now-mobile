import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

let sessionBootstrapPromise:
  | Promise<Session>
  | null = null;

export function isAnonymousSession(
  session: Session | null,
): boolean {
  return (
    session?.user.is_anonymous === true
  );
}

export async function ensureAppSession():
  Promise<Session> {
  if (sessionBootstrapPromise) {
    return sessionBootstrapPromise;
  }

  sessionBootstrapPromise =
    (async () => {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (sessionData.session) {
        return sessionData.session;
      }

      const {
        data: anonymousData,
        error: anonymousError,
      } =
        await supabase.auth
          .signInAnonymously();

      if (anonymousError) {
        throw anonymousError;
      }

      if (!anonymousData.session) {
        throw new Error(
          'تعذر إنشاء جلسة مؤقتة للمستخدم.',
        );
      }

      return anonymousData.session;
    })();

  try {
    return await sessionBootstrapPromise;
  } finally {
    sessionBootstrapPromise = null;
  }
}
