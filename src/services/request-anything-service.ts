import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createClientRequestId,
} from '../domain/order-idempotency';
import {
  supabase,
} from '../lib/supabase';
import {
  ensureAppSession,
} from './anonymous-auth-service';

export type CreateRequestAnythingInput = {
  requestText: string;
  pickupAddress: string;

  deliveryLatitude: number;
  deliveryLongitude: number;

  serviceAreaId?:
    | string
    | null;

  customerName: string;
  customerPhone: string;
  deliveryAddress: string;

  landmark?:
    | string
    | null;
};

export type CreatedRequestAnythingRequest = {
  id: string;
  requestCode: string;
  accessToken: string;
  clientRequestId: string;
  status: string;

  serviceAreaId: string;
  serviceAreaName: string;

  createdAt: string;
};

type RawCreatedRequestAnythingRequest = {
  id?: string;
  request_code?: string;
  access_token?: string;
  client_request_id?: string;
  status?: string;

  service_area_id?: string;
  service_area_name_ar?: string;

  created_at?: string;
};

type PendingRequestAttempt = {
  fingerprint: string;
  clientRequestId: string;
  createdAt: number;
};

const PENDING_REQUEST_ATTEMPT_STORAGE_KEY =
  '@navienty-now/request-anything-create-v1';

const PENDING_REQUEST_ATTEMPT_MAX_AGE_MS =
  10 * 60 * 1000;

let memoryPendingRequestAttempt:
  | PendingRequestAttempt
  | null = null;

function normalizeText(
  value:
    | string
    | null
    | undefined,
) {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function hashText(
  value: string,
) {
  let hash =
    2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(
        index,
      );

    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return (
    hash >>> 0
  ).toString(16);
}

function getRequestFingerprint(
  input:
    CreateRequestAnythingInput,
) {
  const normalizedPayload = {
    requestText:
      normalizeText(
        input.requestText,
      ),

    pickupAddress:
      normalizeText(
        input.pickupAddress,
      ),

    deliveryLatitude:
      Number(
        input.deliveryLatitude,
      ).toFixed(6),

    deliveryLongitude:
      Number(
        input.deliveryLongitude,
      ).toFixed(6),

    customerName:
      normalizeText(
        input.customerName,
      ),

    customerPhone:
      normalizeText(
        input.customerPhone,
      ),

    deliveryAddress:
      normalizeText(
        input.deliveryAddress,
      ),

    landmark:
      normalizeText(
        input.landmark,
      ),
  };

  return hashText(
    JSON.stringify(
      normalizedPayload,
    ),
  );
}

function parsePendingRequestAttempt(
  value:
    | string
    | null,
):
  | PendingRequestAttempt
  | null {
  if (!value) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        value,
      ) as Partial<PendingRequestAttempt>;

    if (
      typeof parsed.fingerprint !==
        'string' ||
      typeof parsed.clientRequestId !==
        'string' ||
      typeof parsed.createdAt !==
        'number'
    ) {
      return null;
    }

    return {
      fingerprint:
        parsed.fingerprint,

      clientRequestId:
        parsed.clientRequestId,

      createdAt:
        parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function isReusablePendingAttempt(
  attempt:
    | PendingRequestAttempt
    | null,
  fingerprint: string,
  now: number,
): attempt is PendingRequestAttempt {
  return (
    attempt !== null &&
    attempt.fingerprint ===
      fingerprint &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      attempt.clientRequestId,
    ) &&
    Number.isFinite(
      attempt.createdAt,
    ) &&
    now -
      attempt.createdAt >=
      0 &&
    now -
      attempt.createdAt <=
      PENDING_REQUEST_ATTEMPT_MAX_AGE_MS
  );
}

async function getOrCreatePendingAttempt(
  input:
    CreateRequestAnythingInput,
):
  Promise<PendingRequestAttempt> {
  const fingerprint =
    getRequestFingerprint(
      input,
    );

  const now =
    Date.now();

  if (
    isReusablePendingAttempt(
      memoryPendingRequestAttempt,
      fingerprint,
      now,
    )
  ) {
    return memoryPendingRequestAttempt;
  }

  try {
    const persistedAttempt =
      parsePendingRequestAttempt(
        await AsyncStorage.getItem(
          PENDING_REQUEST_ATTEMPT_STORAGE_KEY,
        ),
      );

    if (
      isReusablePendingAttempt(
        persistedAttempt,
        fingerprint,
        now,
      )
    ) {
      memoryPendingRequestAttempt =
        persistedAttempt;

      return persistedAttempt;
    }
  } catch {
    // In-memory protection still works for this process.
  }

  const nextAttempt:
    PendingRequestAttempt = {
    fingerprint,

    clientRequestId:
      createClientRequestId(),

    createdAt:
      now,
  };

  memoryPendingRequestAttempt =
    nextAttempt;

  try {
    await AsyncStorage.setItem(
      PENDING_REQUEST_ATTEMPT_STORAGE_KEY,
      JSON.stringify(
        nextAttempt,
      ),
    );
  } catch {
    // Keep the in-memory attempt even if persistence fails.
  }

  return nextAttempt;
}

async function clearPendingAttempt(
  attempt:
    PendingRequestAttempt,
) {
  if (
    memoryPendingRequestAttempt
      ?.clientRequestId ===
      attempt.clientRequestId &&
    memoryPendingRequestAttempt
      ?.fingerprint ===
      attempt.fingerprint
  ) {
    memoryPendingRequestAttempt =
      null;
  }

  try {
    const persistedAttempt =
      parsePendingRequestAttempt(
        await AsyncStorage.getItem(
          PENDING_REQUEST_ATTEMPT_STORAGE_KEY,
        ),
      );

    if (
      persistedAttempt
        ?.clientRequestId ===
        attempt.clientRequestId &&
      persistedAttempt
        ?.fingerprint ===
        attempt.fingerprint
    ) {
      await AsyncStorage.removeItem(
        PENDING_REQUEST_ATTEMPT_STORAGE_KEY,
      );
    }
  } catch {
    // A stale attempt expires automatically.
  }
}

function getErrorMessage(
  error: unknown,
) {
  const fallbackMessage =
    'تعذر إرسال طلب «اطلب أي حاجة». حاول مرة أخرى.';

  if (
    !error ||
    typeof error !==
      'object'
  ) {
    return fallbackMessage;
  }

  const message =
    'message' in error &&
    typeof error.message ===
      'string'
      ? error.message
      : '';

  const details =
    'details' in error &&
    typeof error.details ===
      'string'
      ? error.details
      : '';

  const combinedText =
    `${message} ${details}`;

  const knownErrors:
    Array<
      [string, string]
    > = [
      [
        'authentication_required',
        'تعذر تحديد حساب الجهاز. أغلق التطبيق وافتحه مرة أخرى ثم حاول مجددًا.',
      ],

      [
        'orders_disabled',
        'استقبال الطلبات متوقف حاليًا.',
      ],

      [
        'app_under_maintenance',
        'التطبيق تحت الصيانة حاليًا.',
      ],

      [
        'invalid_request_text',
        'اكتب الحاجة المطلوبة بشكل أوضح.',
      ],

      [
        'invalid_pickup_address',
        'اكتب المكان اللي هنجيب منه الطلب بشكل أوضح.',
      ],

      [
        'invalid_customer_name',
        'اكتب اسمًا صحيحًا.',
      ],

      [
        'invalid_customer_phone',
        'رقم الموبايل غير صحيح.',
      ],

      [
        'invalid_delivery_address',
        'عنوان التوصيل غير مكتمل.',
      ],

      [
        'delivery_location_required',
        'حدد موقع التوصيل من الخريطة أولًا.',
      ],

      [
        'invalid_delivery_coordinates',
        'إحداثيات موقع التوصيل غير صالحة. اختر الموقع مرة أخرى.',
      ],

      [
        'outside_service_area',
        'الموقع المحدد خارج نطاق توصيل Navienty Now حاليًا.',
      ],

      [
        'service_area_not_available',
        'منطقة التوصيل المحددة غير متاحة حاليًا.',
      ],

      [
        'request_anything_not_found',
        'تعذر العثور على الطلب.',
      ],
    ];

  const matched =
    knownErrors.find(
      ([code]) =>
        combinedText.includes(
          code,
        ),
    );

  return (
    matched?.[1] ||
    message ||
    fallbackMessage
  );
}

export async function createRequestAnythingRequest(
  input:
    CreateRequestAnythingInput,
):
  Promise<CreatedRequestAnythingRequest> {
  const requestText =
    input.requestText.trim();

  const pickupAddress =
    input.pickupAddress.trim();

  const customerName =
    input.customerName.trim();

  const customerPhone =
    input.customerPhone.trim();

  const deliveryAddress =
    input.deliveryAddress.trim();

  const landmark =
    input.landmark
      ?.trim() ?? '';

  if (
    requestText.length < 2 ||
    requestText.length > 500
  ) {
    throw new Error(
      'اكتب الحاجة المطلوبة بشكل أوضح.',
    );
  }

  if (
    pickupAddress.length < 2 ||
    pickupAddress.length > 500
  ) {
    throw new Error(
      'اكتب المكان اللي هنجيب منه الطلب بشكل أوضح.',
    );
  }

  if (
    !Number.isFinite(
      input.deliveryLatitude,
    ) ||
    !Number.isFinite(
      input.deliveryLongitude,
    )
  ) {
    throw new Error(
      'حدد موقع التوصيل من الخريطة أولًا.',
    );
  }

  const attempt =
    await getOrCreatePendingAttempt(
      input,
    );

  try {
    await ensureAppSession();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'create_request_anything_request',
        {
          p_payload: {
            client_request_id:
              attempt.clientRequestId,

            request_text:
              requestText,

            pickup_address:
              pickupAddress,

            delivery_latitude:
              input.deliveryLatitude,

            delivery_longitude:
              input.deliveryLongitude,

            service_area_id:
              input.serviceAreaId ??
              null,

            customer_name:
              customerName,

            customer_phone:
              customerPhone,

            delivery_address:
              deliveryAddress,

            landmark:
              landmark ||
              null,
          },
        },
      );

    if (error) {
      throw new Error(
        getErrorMessage(
          error,
        ),
      );
    }

    const raw =
      data as
        | RawCreatedRequestAnythingRequest
        | null;

    if (
      !raw?.id ||
      !raw.request_code ||
      !raw.access_token ||
      !raw.client_request_id ||
      !raw.service_area_id
    ) {
      throw new Error(
        'لم ترجع قاعدة البيانات تفاصيل صالحة للطلب.',
      );
    }

    await clearPendingAttempt(
      attempt,
    );

    return {
      id:
        raw.id,

      requestCode:
        raw.request_code,

      accessToken:
        raw.access_token,

      clientRequestId:
        raw.client_request_id,

      status:
        raw.status ??
        'submitted',

      serviceAreaId:
        raw.service_area_id,

      serviceAreaName:
        raw.service_area_name_ar ??
        '',

      createdAt:
        raw.created_at ??
        new Date().toISOString(),
    };
  } catch (error) {
    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      getErrorMessage(
        error,
      ),
    );
  }
}
