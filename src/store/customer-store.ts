import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';

export type PaymentMethodId = string;

export type AddressType =
  | 'apartment'
  | 'home'
  | 'office';

export type CustomerData = {
  customerName: string;
  phoneNumber: string;

  /** Final editable address that is submitted with the order. */
  address: string;

  /** Reverse-geocoded address for the selected map pin. */
  locationAddress: string;

  /** Exact delivery pin selected by the customer. */
  locationLatitude: number | null;
  locationLongitude: number | null;

  /** Server-resolved delivery area for the selected pin. */
  locationServiceAreaId: string | null;
  locationServiceAreaName: string;
  locationCityId: string | null;
  locationCityName: string;

  /** Structured delivery-address details collected after the map pin. */
  addressType: AddressType;
  buildingName: string;
  apartmentNumber: string;
  floor: string;
  street: string;
  deliveryInstructions: string;
  addressLabel: string;

  landmark: string;

  paymentMethod:
    PaymentMethodId | null;
};

export type DeliveryLocation = {
  latitude: number;
  longitude: number;
  address: string;

  serviceAreaId?: string | null;
  serviceAreaName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
};

type CustomerField = keyof CustomerData;

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
    locationServiceAreaId: null,
    locationServiceAreaName: '',
    locationCityId: null,
    locationCityName: '',
    addressType: 'apartment',
    buildingName: '',
    apartmentNumber: '',
    floor: '',
    street: '',
    deliveryInstructions: '',
    addressLabel: '',
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
          set({ customerName });
        },

        setPhoneNumber: (
          phoneNumber,
        ) => {
          set({ phoneNumber });
        },

        setAddress: (address) => {
          set({ address });
        },

        setLandmark: (landmark) => {
          set({ landmark });
        },

        setPaymentMethod: (
          paymentMethod,
        ) => {
          set({ paymentMethod });
        },

        setDeliveryLocation: (
          location,
        ) => {
          set({
            address: location.address,
            locationAddress:
              location.address,
            locationLatitude:
              location.latitude,
            locationLongitude:
              location.longitude,
            locationServiceAreaId:
              location.serviceAreaId ??
              null,
            locationServiceAreaName:
              location.serviceAreaName ??
              '',
            locationCityId:
              location.cityId ?? null,
            locationCityName:
              location.cityName ?? '',
          });
        },

        clearDeliveryLocation: () => {
          set({
            address: '',
            locationAddress: '',
            locationLatitude: null,
            locationLongitude: null,
            locationServiceAreaId: null,
            locationServiceAreaName: '',
            locationCityId: null,
            locationCityName: '',
            addressType: 'apartment',
            buildingName: '',
            apartmentNumber: '',
            floor: '',
            street: '',
            deliveryInstructions: '',
            addressLabel: '',
            landmark: '',
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

            locationServiceAreaId:
              customerData
                .locationServiceAreaId ??
              state.locationServiceAreaId,

            locationServiceAreaName:
              customerData
                .locationServiceAreaName ??
              state.locationServiceAreaName,

            locationCityId:
              customerData
                .locationCityId ??
              state.locationCityId,

            locationCityName:
              customerData
                .locationCityName ??
              state.locationCityName,

            addressType:
              customerData.addressType ??
              state.addressType,

            buildingName:
              customerData.buildingName ??
              state.buildingName,

            apartmentNumber:
              customerData.apartmentNumber ??
              state.apartmentNumber,

            floor:
              customerData.floor ??
              state.floor,

            street:
              customerData.street ??
              state.street,

            deliveryInstructions:
              customerData
                .deliveryInstructions ??
              state.deliveryInstructions,

            addressLabel:
              customerData.addressLabel ??
              state.addressLabel,

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
          set({ hasHydrated });
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

          locationServiceAreaId:
            state.locationServiceAreaId,

          locationServiceAreaName:
            state.locationServiceAreaName,

          locationCityId:
            state.locationCityId,

          locationCityName:
            state.locationCityName,

          addressType:
            state.addressType,

          buildingName:
            state.buildingName,

          apartmentNumber:
            state.apartmentNumber,

          floor:
            state.floor,

          street:
            state.street,

          deliveryInstructions:
            state.deliveryInstructions,

          addressLabel:
            state.addressLabel,

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

            locationServiceAreaId:
              typeof previous
                .locationServiceAreaId ===
                'string'
                ? previous
                    .locationServiceAreaId
                : null,

            locationServiceAreaName:
              previous
                .locationServiceAreaName ??
              '',

            locationCityId:
              typeof previous
                .locationCityId ===
                'string'
                ? previous
                    .locationCityId
                : null,

            locationCityName:
              previous
                .locationCityName ??
              '',

            addressType:
              previous.addressType ===
                'home' ||
              previous.addressType ===
                'office' ||
              previous.addressType ===
                'apartment'
                ? previous.addressType
                : 'apartment',

            buildingName:
              previous.buildingName ??
              '',

            apartmentNumber:
              previous.apartmentNumber ??
              '',

            floor:
              previous.floor ?? '',

            street:
              previous.street ?? '',

            deliveryInstructions:
              previous
                .deliveryInstructions ??
              '',

            addressLabel:
              previous.addressLabel ??
              '',

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

        version: 5,
      },
    ),
  );
