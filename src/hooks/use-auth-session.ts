import type { Session } from '@supabase/supabase-js';
import {
  useEffect,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import {
  isAnonymousSession,
} from '../services/anonymous-auth-service';

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
      status: 'anonymous';
      session: Session;
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
  if (!session) {
    return {
      status: 'signedOut',
      session: null,
      errorMessage: null,
    };
  }

  if (isAnonymousSession(session)) {
    return {
      status: 'anonymous',
      session,
      errorMessage: null,
    };
  }

  return {
    status: 'signedIn',
    session,
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
    let hasResolvedInitialState = false;
    let initializationTimeout:
      ReturnType<typeof setTimeout> | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        hasResolvedInitialState = true;

        if (initializationTimeout !== null) {
          clearTimeout(initializationTimeout);
          initializationTimeout = null;
        }

        if (!isMounted) {
          return;
        }

        setState(
          stateFromSession(session),
        );
      },
    );

    if (!hasResolvedInitialState) {
      initializationTimeout = setTimeout(() => {
        initializationTimeout = null;

        if (!isMounted || hasResolvedInitialState) {
          return;
        }

        setState({
          status: 'error',
          session: null,
          errorMessage:
            'تعذر التحقق من حالة الحساب.',
        });
      }, 8_000);
    }

    return () => {
      isMounted = false;

      if (initializationTimeout !== null) {
        clearTimeout(initializationTimeout);
      }

      subscription.unsubscribe();
    };
  }, []);

  return state;
}
