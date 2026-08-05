import type { Session } from '@supabase/supabase-js';
import {
    useEffect,
    useState,
} from 'react';

import { supabase } from '../lib/supabase';

export type AuthSessionState =
  | {
      status: 'loading';
      session: null;
      errorMessage: null;
    }
  | {
      status: 'signedOut';
      session: null;
      errorMessage: null;
    }
  | {
      status: 'signedIn';
      session: Session;
      errorMessage: null;
    }
  | {
      status: 'error';
      session: null;
      errorMessage: string;
    };

function stateFromSession(
  session: Session | null,
): AuthSessionState {
  if (session) {
    return {
      status: 'signedIn',
      session,
      errorMessage: null,
    };
  }

  return {
    status: 'signedOut',
    session: null,
    errorMessage: null,
  };
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] =
    useState<AuthSessionState>({
      status: 'loading',
      session: null,
      errorMessage: null,
    });

  useEffect(() => {
    let isMounted = true;
    let authEventRevision = 0;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        authEventRevision += 1;

        if (!isMounted) {
          return;
        }

        setState(stateFromSession(session));
      },
    );

    const initialRevision =
      authEventRevision;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (
          !isMounted ||
          authEventRevision !==
            initialRevision
        ) {
          return;
        }

        if (error) {
          setState({
            status: 'error',
            session: null,
            errorMessage:
              'تعذر التحقق من حالة تسجيل الدخول.',
          });
          return;
        }

        setState(
          stateFromSession(data.session),
        );
      })
      .catch(() => {
        if (
          !isMounted ||
          authEventRevision !==
            initialRevision
        ) {
          return;
        }

        setState({
          status: 'error',
          session: null,
          errorMessage:
            'تعذر التحقق من حالة تسجيل الدخول.',
        });
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
