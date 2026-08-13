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

  /**
   * Editable checkout address.
   *
   * location-picker fills this automatically using reverse geocoding.
   * The customer can still append building / floor / apartment details
   * later from checkout.
   */
  address: string;

  /**
   * Address returned directly from reverse geocoding for the selected
   * map pin. Kept separately from `address` so manual checkout edits do
   * not lose the original mapped address.
   */
  locationAddress: string;

  /**
   * Exact map pin selected by the customer.
   */
  locationLatitude: number | null;
  locationLongitude: number | null;

  landmark: string;

  paymentMethod:
    PaymentMethodId | null;
};

export type DeliveryLocation = {
  latitude: number;
  longitude: number;
  address: string;
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

    setDeliveryLocation: (
      location: DeliveryLocation,
    ) => void;

    clearDeliveryLocation: () => void;

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
    locationAddress: '',
    locationLatitude: null,
    locationLongitude: null,
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

        setDeliveryLocation: (
          location,
        ) => {
          set({
            address:
              location.address,

            locationAddress:
              location.address,

            locationLatitude:
              location.latitude,

            locationLongitude:
              location.longitude,
          });
        },

        clearDeliveryLocation: () => {
          set({
            address: '',
            locationAddress: '',
            locationLatitude: null,
            locationLongitude: null,
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

            locationAddress:
              customerData
                .locationAddress ??
              state.locationAddress,

            locationLatitude:
              customerData
                .locationLatitude ??
              state.locationLatitude,

            locationLongitude:
              customerData
                .locationLongitude ??
              state.locationLongitude,

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

          address:
            state.address,

          locationAddress:
            state.locationAddress,

          locationLatitude:
            state.locationLatitude,

          locationLongitude:
            state.locationLongitude,

          landmark:
            state.landmark,

          paymentMethod:
            state.paymentMethod,
        }),

        migrate: (
          persistedState,
          version,
        ) => {
          const previous =
            persistedState as
              Partial<CustomerData>;

          if (version < 2) {
            return {
              ...initialCustomerState,
            };
          }

          return {
            customerName:
              previous.customerName ??
              '',

            phoneNumber:
              previous.phoneNumber ??
              '',

            address:
              previous.address ??
              '',

            locationAddress:
              previous.locationAddress ??
              '',

            locationLatitude:
              typeof previous
                .locationLatitude ===
                'number'
                ? previous
                    .locationLatitude
                : null,

            locationLongitude:
              typeof previous
                .locationLongitude ===
                'number'
                ? previous
                    .locationLongitude
                : null,

            landmark:
              previous.landmark ??
              '',

            paymentMethod:
              previous.paymentMethod ??
              null,
          };
        },

        onRehydrateStorage:
          () => (state) => {
            state?.setHasHydrated(
              true,
            );
          },

        version: 3,
      },
    ),
  );
