import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculatePaymentProcessingFee,
  getPaymentProcessingFeeLabelAr,
} from '../src/domain/payment-method.ts';

test('disabled or merchant-paid processing fees are zero', () => {
  assert.equal(
    calculatePaymentProcessingFee(
      {
        processing_fee_enabled: false,
        processing_fee_charge_customer: true,
        processing_fee_type: 'fixed',
        processing_fee_fixed_amount: 10,
      },
      200,
    ),
    0,
  );

  assert.equal(
    calculatePaymentProcessingFee(
      {
        processing_fee_enabled: true,
        processing_fee_charge_customer: false,
        processing_fee_type: 'fixed',
        processing_fee_fixed_amount: 10,
      },
      200,
    ),
    0,
  );
});

test('fixed payment fee matches Supabase configuration', () => {
  assert.equal(
    calculatePaymentProcessingFee(
      {
        processing_fee_enabled: true,
        processing_fee_charge_customer: true,
        processing_fee_type: 'fixed',
        processing_fee_fixed_amount: 10,
      },
      200,
    ),
    10,
  );
});

test('percentage payment fee rounds to two decimals', () => {
  assert.equal(
    calculatePaymentProcessingFee(
      {
        processing_fee_enabled: true,
        processing_fee_charge_customer: true,
        processing_fee_type: 'percentage',
        processing_fee_percentage: 2.5,
      },
      199,
    ),
    4.98,
  );
});

test('minimum and maximum payment fee bounds are applied', () => {
  const configuration = {
    processing_fee_enabled: true,
    processing_fee_charge_customer: true,
    processing_fee_type: 'percentage',
    processing_fee_percentage: 2,
    processing_fee_min_amount: 5,
    processing_fee_max_amount: 12,
  };

  assert.equal(
    calculatePaymentProcessingFee(
      configuration,
      100,
    ),
    5,
  );

  assert.equal(
    calculatePaymentProcessingFee(
      configuration,
      1000,
    ),
    12,
  );
});

test('Arabic payment fee label uses database value with safe fallback', () => {
  assert.equal(
    getPaymentProcessingFeeLabelAr({
      processing_fee_label_ar:
        'رسوم تحويل إلكتروني',
    }),
    'رسوم تحويل إلكتروني',
  );

  assert.equal(
    getPaymentProcessingFeeLabelAr({
      processing_fee_label_ar: '   ',
    }),
    'رسوم الدفع الإلكتروني',
  );
});
