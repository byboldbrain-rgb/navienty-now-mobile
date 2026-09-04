import {
    Redirect,
    useLocalSearchParams,
} from 'expo-router';

import SearchScreen from '../../components/search/search-screen';
import {
    resolveSearchScope,
} from '../../config/search-scopes';

export default function ScopedSearchRoute() {
  const params =
    useLocalSearchParams<{
      scope?: string | string[];
    }>();

  const rawScope = Array.isArray(
    params.scope,
  )
    ? params.scope[0]
    : params.scope;

  /*
   * مهم:
   * ماينفعش نعرض SearchScreen قبل ما الـscope
   * يوصل من الـdynamic route.
   *
   * ده بيضمن إن أول Render نفسه يكون
   * supermarket أو bookstore أو personal-care...
   * ومش restaurants بشكل مؤقت.
   */
  if (!rawScope) {
    return null;
  }

  const scope = resolveSearchScope(
    rawScope,
  );

  /*
   * لو حد فتح Scope غير مسجل في
   * search-scopes.ts نرجعه للبحث العام.
   */
  if (!scope) {
    return <Redirect href="/search" />;
  }

  return (
    <SearchScreen
      scope={scope}
    />
  );
}