import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
    createJSONStorage,
    persist,
} from 'zustand/middleware';

export type PaymentMethodId =
  string;

export type CustomerData = {
  customerName: string;
  phoneNumber: string;
  address: string;
  landmark: string;
  paymentMethod:
    PaymentMethodId | null;
};

type CustomerField =
  keyof CustomerData;

type CustomerState =
  CustomerData & {
    hasHydrated: boolean;

    setCustomerName: (
      customerName: string,
    ) => void;

    setPhoneNumber: (
      phoneNumber: string,
    ) => void;

    setAddress: (
      address: string,
    ) => void;

    setLandmark: (
      landmark: string,
    ) => void;

    setPaymentMethod: (
      paymentMethod:
        | PaymentMethodId
        | null,
    ) => void;

    updateCustomerField: (
      field: CustomerField,
      value:
        CustomerData[CustomerField],
    ) => void;

    setCustomerData: (
      customerData:
        Partial<CustomerData>,
    ) => void;

    clearCustomerData: () => void;

    setHasHydrated: (
      hasHydrated: boolean,
    ) => void;
  };

const initialCustomerState:
  CustomerData = {
    customerName: '',
    phoneNumber: '',
    address: '',
    landmark: '',
    paymentMethod: null,
  };

export const useCustomerStore =
  create<CustomerState>()(
    persist(
      (set) => ({
        ...initialCustomerState,

        hasHydrated: false,

        setCustomerName: (
          customerName,
        ) => {
          set({
            customerName,
          });
        },

        setPhoneNumber: (
          phoneNumber,
        ) => {
          set({
            phoneNumber,
          });
        },

        setAddress: (address) => {
          set({
            address,
          });
        },

        setLandmark: (landmark) => {
          set({
            landmark,
          });
        },

        setPaymentMethod: (
          paymentMethod,
        ) => {
          set({
            paymentMethod,
          });
        },

        updateCustomerField: (
          field,
          value,
        ) => {
          set({
            [field]: value,
          } as Pick<
            CustomerState,
            CustomerField
          >);
        },

        setCustomerData: (
          customerData,
        ) => {
          set((state) => ({
            customerName:
              customerData
                .customerName ??
              state.customerName,

            phoneNumber:
              customerData
                .phoneNumber ??
              state.phoneNumber,

            address:
              customerData.address ??
              state.address,

            landmark:
              customerData.landmark ??
              state.landmark,

            paymentMethod:
              customerData
                .paymentMethod ??
              state.paymentMethod,
          }));
        },

        clearCustomerData: () => {
          set({
            ...initialCustomerState,
          });
        },

        setHasHydrated: (
          hasHydrated,
        ) => {
          set({
            hasHydrated,
          });
        },
      }),

      {
        name:
          'navienty-now-customer',

        storage: createJSONStorage(
          () => AsyncStorage,
        ),

        partialize: (
          state,
        ): CustomerData => ({
          customerName:
            state.customerName,

          phoneNumber:
            state.phoneNumber,

          address: state.address,

          landmark: state.landmark,

          paymentMethod:
            state.paymentMethod,
        }),

        onRehydrateStorage:
          () => (state) => {
            state?.setHasHydrated(
              true,
            );
          },

        version: 2,
      },
    ),
  );
