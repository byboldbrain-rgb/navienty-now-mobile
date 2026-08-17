import fs from 'node:fs';

const filePath = 'src/services/order-service.ts';

function replaceExactly(
  source,
  pattern,
  replacement,
  expectedCount,
  label,
) {
  const matches = source.match(pattern) ?? [];

  if (matches.length !== expectedCount) {
    throw new Error(
      `${label}: expected ${expectedCount} replacement(s), found ${matches.length}.`,
    );
  }

  return source.replace(pattern, replacement);
}

let source = fs.readFileSync(filePath, 'utf8');

source = replaceExactly(
  source,
  /^import \{ supabase \} from '\.\.\/lib\/supabase';/m,
  `import AsyncStorage from '@react-native-async-storage/async-storage';\n\nimport {\n  createClientRequestId,\n  getOrderRequestFingerprint,\n} from '../domain/order-idempotency';\nimport { supabase } from '../lib/supabase';`,
  1,
  'imports',
);

const pendingAttemptHelpers = `const PENDING_ORDER_ATTEMPT_STORAGE_KEY =\n  '@navienty-now/pending-order-create-v1';\n\nconst PENDING_ORDER_ATTEMPT_MAX_AGE_MS =\n  10 * 60 * 1000;\n\ntype PendingOrderAttempt = {\n  fingerprint: string;\n  clientRequestId: string;\n  createdAt: number;\n};\n\nlet memoryPendingOrderAttempt:\n  | PendingOrderAttempt\n  | null = null;\n\nfunction isReusablePendingOrderAttempt(\n  attempt: PendingOrderAttempt | null,\n  fingerprint: string,\n  currentTime: number,\n): attempt is PendingOrderAttempt {\n  return (\n    attempt !== null &&\n    attempt.fingerprint === fingerprint &&\n    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(\n      attempt.clientRequestId,\n    ) &&\n    Number.isFinite(attempt.createdAt) &&\n    attempt.createdAt > 0 &&\n    currentTime - attempt.createdAt >= 0 &&\n    currentTime - attempt.createdAt <=\n      PENDING_ORDER_ATTEMPT_MAX_AGE_MS\n  );\n}\n\nfunction parsePendingOrderAttempt(\n  value: string | null,\n): PendingOrderAttempt | null {\n  if (!value) {\n    return null;\n  }\n\n  try {\n    const parsed = JSON.parse(value) as Partial<PendingOrderAttempt>;\n\n    if (\n      typeof parsed.fingerprint !== 'string' ||\n      typeof parsed.clientRequestId !== 'string' ||\n      typeof parsed.createdAt !== 'number'\n    ) {\n      return null;\n    }\n\n    return {\n      fingerprint: parsed.fingerprint,\n      clientRequestId: parsed.clientRequestId,\n      createdAt: parsed.createdAt,\n    };\n  } catch {\n    return null;\n  }\n}\n\nasync function getOrCreatePendingOrderAttempt(\n  input: CreateWhatsAppOrderInput,\n): Promise<PendingOrderAttempt> {\n  const fingerprint =\n    getOrderRequestFingerprint(input);\n  const currentTime = Date.now();\n\n  if (\n    isReusablePendingOrderAttempt(\n      memoryPendingOrderAttempt,\n      fingerprint,\n      currentTime,\n    )\n  ) {\n    return memoryPendingOrderAttempt;\n  }\n\n  try {\n    const persistedAttempt =\n      parsePendingOrderAttempt(\n        await AsyncStorage.getItem(\n          PENDING_ORDER_ATTEMPT_STORAGE_KEY,\n        ),\n      );\n\n    if (\n      isReusablePendingOrderAttempt(\n        persistedAttempt,\n        fingerprint,\n        currentTime,\n      )\n    ) {\n      memoryPendingOrderAttempt =\n        persistedAttempt;\n      return persistedAttempt;\n    }\n  } catch {\n    // Idempotency still works for this process through the in-memory fallback.\n  }\n\n  const nextAttempt: PendingOrderAttempt = {\n    fingerprint,\n    clientRequestId: createClientRequestId(),\n    createdAt: currentTime,\n  };\n\n  // Set memory before awaiting persistence so two rapid taps in the same\n  // process cannot generate separate client_request_id values.\n  memoryPendingOrderAttempt = nextAttempt;\n\n  try {\n    await AsyncStorage.setItem(\n      PENDING_ORDER_ATTEMPT_STORAGE_KEY,\n      JSON.stringify(nextAttempt),\n    );\n  } catch {\n    // The in-memory attempt still protects retries while this process lives.\n  }\n\n  return nextAttempt;\n}\n\nasync function clearPendingOrderAttempt(\n  attempt: PendingOrderAttempt,\n): Promise<void> {\n  if (\n    memoryPendingOrderAttempt?.clientRequestId ===\n      attempt.clientRequestId &&\n    memoryPendingOrderAttempt.fingerprint ===\n      attempt.fingerprint\n  ) {\n    memoryPendingOrderAttempt = null;\n  }\n\n  try {\n    const persistedAttempt =\n      parsePendingOrderAttempt(\n        await AsyncStorage.getItem(\n          PENDING_ORDER_ATTEMPT_STORAGE_KEY,\n        ),\n      );\n\n    if (\n      persistedAttempt?.clientRequestId ===\n        attempt.clientRequestId &&\n      persistedAttempt.fingerprint ===\n        attempt.fingerprint\n    ) {\n      await AsyncStorage.removeItem(\n        PENDING_ORDER_ATTEMPT_STORAGE_KEY,\n      );\n    }\n  } catch {\n    // A stale attempt expires automatically after the short retry window.\n  }\n}\n\nfunction getErrorMessage`;

source = replaceExactly(
  source,
  /function createClientRequestId\(\):\n  string \{[\s\S]*?\n\}\n\nfunction getErrorMessage/,
  pendingAttemptHelpers,
  1,
  'pending-attempt helpers',
);

source = replaceExactly(
  source,
  /export async function createWhatsAppOrder\(\n  input: CreateWhatsAppOrderInput,\n\): Promise<Order> \{\n  const payload = \{\n    client_request_id:\n      createClientRequestId\(\),/,
  `export async function createWhatsAppOrder(\n  input: CreateWhatsAppOrderInput,\n): Promise<Order> {\n  const pendingAttempt =\n    await getOrCreatePendingOrderAttempt(\n      input,\n    );\n\n  const payload = {\n    client_request_id:\n      pendingAttempt.clientRequestId,`,
  1,
  'create-order attempt',
);

source = replaceExactly(
  source,
  /  return getOrderByToken\(\n    createdOrder\.access_token,\n  \);\n\}/,
  `  const order = await getOrderByToken(\n    createdOrder.access_token,\n  );\n\n  await clearPendingOrderAttempt(\n    pendingAttempt,\n  );\n\n  return order;\n}`,
  1,
  'clear successful attempt',
);

fs.writeFileSync(filePath, source);
console.log('Applied persistent checkout idempotency hardening.');
