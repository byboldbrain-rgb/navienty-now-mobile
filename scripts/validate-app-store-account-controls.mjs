import { readFileSync } from 'node:fs';

const account = readFileSync(
  'src/app/account.tsx',
  'utf8',
);
const deletionService = readFileSync(
  'src/services/account-deletion-service.ts',
  'utf8',
);

const failures = [];

for (const requiredText of [
  'requestAccountDeletion',
  'getMyAccountDeletionRequest',
  'cancelMyAccountDeletionRequest',
  'طلب حذف الحساب',
  "authState.status === 'anonymous'",
  'سياسة الخصوصية',
  'شروط الاستخدام',
]) {
  if (!account.includes(requiredText)) {
    failures.push(
      `account screen is missing required control: ${requiredText}`,
    );
  }
}

for (const rpcName of [
  'request_account_deletion',
  'get_my_account_deletion_request',
  'cancel_my_account_deletion_request',
]) {
  if (!deletionService.includes(rpcName)) {
    failures.push(
      `account deletion service is missing RPC: ${rpcName}`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    'App Store account control validation failed:',
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  'App Store account control validation passed.',
);
