import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { recordStartupTimingOnce } from './startup-performance-service';

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
      const startedAt = Date.now();
      let path:
        | 'existing-session'
        | 'anonymous-sign-in'
        | 'get-session' =
        'get-session';
      let outcome:
        | 'success'
        | 'error' =
        'success';

      try {
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (sessionData.session) {
          path = 'existing-session';
          return sessionData.session;
        }

        path = 'anonymous-sign-in';

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
      } catch (error) {
        outcome = 'error';
        throw error;
      } finally {
        recordStartupTimingOnce(
          'auth-bootstrap',
          Date.now() - startedAt,
          {
            outcome,
            path,
          },
        );
      }
    })();

  try {
    return await sessionBootstrapPromise;
  } finally {
    sessionBootstrapPromise = null;
  }
}
