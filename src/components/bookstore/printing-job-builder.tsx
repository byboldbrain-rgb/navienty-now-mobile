import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  CatalogSection,
  StoreCatalog,
} from '../../services/catalog-service';
import {
  calculateLocalPrintJobQuote,
  getPrintingServiceConfig,
  quotePrintJob,
} from '../../services/printing-service';
import {
  isPrintJobCartItem,
  useCartStore,
} from '../../store/cart-store';
import type {
  PrintingColorOption,
  PrintingServiceConfig,
  PrintingSideOption,
} from '../../types/printing';

type PrintingJobBuilderProps = {
  catalog: StoreCatalog;
  section: CatalogSection;
  currencyCode: string;
  editLineId?: string | null;
};

function digitsOnly(
  value: string,
) {
  return value.replace(
    /\D/g,
    '',
  );
}

function formatAmount(
  value: number,
  currencyCode: string,
) {
  const normalizedCurrency =
    currencyCode
      .trim()
      .toUpperCase();

  const currencyLabel =
    normalizedCurrency === 'EGP'
      ? 'ج.م'
      : normalizedCurrency || 'ج.م';

  const amount = Number(
    value ?? 0,
  );

  return `${
    Number.isInteger(amount)
      ? amount.toFixed(0)
      : amount.toFixed(2)
  } ${currencyLabel}`;
}

function formatCopyTemplate(
  template: string,
  values: Record<
    string,
    string | number
  >,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result
        .split(`{${key}}`)
        .join(String(value)),
    template,
  );
}

function getDefaultColorOption(
  config: PrintingServiceConfig,
) {
  return (
    config.colorOptions.find(
      (option) =>
        option.isDefault,
    ) ??
    config.colorOptions[0]
  );
}

function getDefaultSideOption(
  config: PrintingServiceConfig,
) {
  return (
    config.sideOptions.find(
      (option) =>
        option.isDefault,
    ) ??
    config.sideOptions[0]
  );
}

function OptionIcon({
  name,
  color,
  size = 22,
  fallback =
    'document-text-outline',
}: {
  name: string;
  color: string;
  size?: number;
  fallback?: keyof typeof Ionicons.glyphMap;
}) {
  const iconName =
    name in Ionicons.glyphMap
      ? (name as keyof typeof Ionicons.glyphMap)
      : fallback;

  return (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
    />
  );
}

export default function PrintingJobBuilder({
  catalog,
  section,
  currencyCode,
  editLineId = null,
}: PrintingJobBuilderProps) {
  const router = useRouter();
  const insets =
    useSafeAreaInsets();

  const carts = useCartStore(
    (state) => state.carts,
  );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  const [
    config,
    setConfig,
  ] =
    useState<PrintingServiceConfig | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedColorId,
    setSelectedColorId,
  ] = useState('');

  const [
    selectedSideId,
    setSelectedSideId,
  ] = useState('');

  const [
    pageCountText,
    setPageCountText,
  ] = useState('');

  const [
    copyCount,
    setCopyCount,
  ] = useState(1);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null,
  );

  const initializedConfigIdRef =
    useRef<string | null>(null);

  const currentCart =
    carts[catalog.store.id] ??
    null;

  const editingItem =
    currentCart?.items.find(
      (item) =>
        isPrintJobCartItem(item) &&
        (
          editLineId
            ? item.lineId ===
              editLineId
            : item.printJob
                .catalogCategoryId ===
              section.id
        ),
    ) ?? null;

  async function loadConfig() {
    try {
      setIsLoading(true);
      setLoadError(null);

      const loadedConfig =
        await getPrintingServiceConfig(
          catalog.store.id,
          section.id,
        );

      setConfig(loadedConfig);
    } catch (error) {
      setConfig(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل خدمة الطباعة.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, [
    catalog.store.id,
    section.id,
  ]);

  useEffect(() => {
    if (
      !config ||
      initializedConfigIdRef.current ===
        config.id
    ) {
      return;
    }

    initializedConfigIdRef.current =
      config.id;

    const existingSnapshot =
      editingItem?.printJob;

    const defaultColor =
      getDefaultColorOption(
        config,
      );

    const defaultSide =
      getDefaultSideOption(
        config,
      );

    setSelectedColorId(
      existingSnapshot &&
      config.colorOptions.some(
        (option) =>
          option.id ===
          existingSnapshot.colorOptionId,
      )
        ? existingSnapshot.colorOptionId
        : defaultColor?.id ?? '',
    );

    setSelectedSideId(
      existingSnapshot &&
      config.sideOptions.some(
        (option) =>
          option.id ===
          existingSnapshot.sideOptionId,
      )
        ? existingSnapshot.sideOptionId
        : defaultSide?.id ?? '',
    );

    setPageCountText(
      String(
        existingSnapshot?.pageCount ??
          config.defaultPageCount,
      ),
    );

    setCopyCount(
      existingSnapshot?.copyCount ??
        config.defaultCopyCount,
    );
  }, [
    config,
    editingItem?.lineId,
  ]);

  const pageCount =
    Number(
      pageCountText || 0,
    );

  const localQuote = useMemo(
    () =>
      config
        ? calculateLocalPrintJobQuote(
            config,
            {
              colorOptionId:
                selectedColorId,
              sideOptionId:
                selectedSideId,
              pageCount,
              copyCount,
            },
          )
        : null,
    [
      config,
      selectedColorId,
      selectedSideId,
      pageCount,
      copyCount,
    ],
  );

  const pageCountError =
    config &&
    pageCountText.length > 0 &&
    !localQuote?.pageCountIsValid
      ? formatCopyTemplate(
          config.uiCopy
            .pageRangeErrorTemplate,
          {
            min:
              config.minimumPageCount,
            max:
              config.maximumPageCount,
          },
        )
      : null;

  const totalSheetsError =
    config &&
    localQuote &&
    localQuote.pageCountIsValid &&
    localQuote.copyCountIsValid &&
    !localQuote.totalSheetsIsValid
      ? formatCopyTemplate(
          config.uiCopy
            .totalSheetsErrorTemplate,
          {
            max:
              config.maximumTotalSheets,
          },
        )
      : null;

  const canSubmit =
    !!config &&
    !!localQuote?.isValid &&
    !catalog.store.isManuallyClosed &&
    !isSubmitting;

  function selectPreset(
    preset: number,
  ) {
    setPageCountText(
      String(preset),
    );
    setSubmitError(null);
  }

  function changeCopyCount(
    nextValue: number,
  ) {
    if (!config) {
      return;
    }

    const boundedValue =
      Math.min(
        Math.max(
          nextValue,
          config.minimumCopyCount,
        ),
        config.maximumCopyCount,
      );

    setCopyCount(boundedValue);
    setSubmitError(null);
  }

  async function submitPrintJob() {
    if (
      !config ||
      !localQuote?.isValid ||
      isSubmitting
    ) {
      return;
    }

    if (
      catalog.store.isManuallyClosed
    ) {
      Alert.alert(
        config.uiCopy
          .closedAlertTitle,
        catalog.store.manualClosedNote ??
          config.uiCopy.closedFallback,
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const serverQuote =
        await quotePrintJob({
          printingServiceId:
            config.id,
          colorOptionId:
            selectedColorId,
          sideOptionId:
            selectedSideId,
          pageCount:
            localQuote.pageCount,
          copyCount:
            localQuote.copyCount,
        });

      const result =
        addItem(
          {
            id: catalog.store.id,
            name: catalog.store.name,
            icon:
              catalog.store.icon,
            categorySlug:
              catalog.store
                .categorySlug,
            deliveryFee:
              catalog.delivery
                .deliveryFee,
            minimumOrder:
              catalog.delivery
                .minimumOrder,
          },
          {
            id:
              serverQuote.productId,
            name:
              serverQuote.productName,
            description:
              serverQuote.summary,
            price:
              serverQuote.totalPrice,
            icon:
              serverQuote.productIcon,
            variantId:
              serverQuote.productVariantId,
            variantName:
              serverQuote.summary,
            itemKind:
              'print_job',
            lineId:
              editingItem?.lineId ??
              editLineId ??
              `print-job:${serverQuote.printingServiceId}`,
            printJob:
              serverQuote,
          },
        );

      if (
        result !== 'added'
      ) {
        throw new Error(
          config.uiCopy.addError,
        );
      }

      setActiveCart(
        catalog.store.id,
      );

      router.replace({
        pathname: '/cart-details',
        params: {
          storeId:
            catalog.store.id,
        },
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : config.uiCopy.submitError,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color="#00B14F"
        />

        <Text style={styles.stateDescription}>
          جاري تجهيز خدمة الطباعة
        </Text>
      </View>
    );
  }

  if (!config || loadError) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.stateIcon}>
          <Ionicons
            name="print-outline"
            size={30}
            color="#00B14F"
          />
        </View>

        <Text style={styles.stateTitle}>
          خدمة الطباعة غير متاحة
        </Text>

        <Text style={styles.stateDescription}>
          {loadError ??
            'حاول مرة أخرى بعد قليل.'}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={() => {
            void loadConfig();
          }}
        >
          <Text style={styles.retryButtonText}>
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={styles.stateBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.stateBackText}>
            رجوع
          </Text>
        </Pressable>
      </View>
    );
  }

  const visiblePresets =
    config.pageCountPresets.filter(
      (preset) =>
        preset >=
          config.minimumPageCount &&
        preset <=
          config.maximumPageCount,
    );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View
        style={[
          styles.header,
          {
            paddingTop:
              Math.max(
                insets.top,
                6,
              ),
          },
        ]}
      >
        <Pressable
          accessibilityLabel={
            config.uiCopy
              .backAccessibilityLabel
          }
          style={({ pressed }) => [
            styles.headerButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color="#202020"
          />
        </Pressable>

        <Text
          numberOfLines={1}
          style={styles.headerTitle}
        >
          {section.name}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                12,
              ) + 118,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor:
                config.heroBackgroundColor,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor:
                    config.accentColor,
                },
              ]}
            >
              <OptionIcon
                name={config.uiIcons.hero}
                fallback="print-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.heroBadge}>
              <OptionIcon
                name={
                  config.uiIcons
                    .pageSizeBadge
                }
                color={config.accentColor}
                size={15}
              />

              <Text
                style={[
                  styles.heroBadgeText,
                  {
                    color:
                      config.accentDarkColor,
                  },
                ]}
              >
                {config.pageSizeLabel}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.eyebrow,
              {
                color:
                  config.accentDarkColor,
              },
            ]}
          >
            {config.eyebrow}
          </Text>

          <Text style={styles.heroTitle}>
            {config.title}
          </Text>

          <Text style={styles.heroSubtitle}>
            {config.subtitle}
          </Text>
        </View>

        {catalog.store.isManuallyClosed ? (
          <View style={styles.closedCard}>
            <Ionicons
              name="time-outline"
              size={19}
              color="#9A6516"
            />

            <Text style={styles.closedText}>
              {catalog.store.manualClosedNote ??
                config.uiCopy.closedFallback}
            </Text>
          </View>
        ) : null}

        <OptionSection
          title={
            config.colorSectionTitle
          }
          options={config.colorOptions}
          selectedId={selectedColorId}
          accentColor={config.accentColor}
          onSelect={(option) => {
            setSelectedColorId(
              option.id,
            );
            setSubmitError(null);
          }}
        />

        <SideOptionSection
          title={
            config.sidesSectionTitle
          }
          options={config.sideOptions}
          selectedId={selectedSideId}
          accentColor={config.accentColor}
          onSelect={(option) => {
            setSelectedSideId(
              option.id,
            );
            setSubmitError(null);
          }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {config.pageCountLabel}
          </Text>

          <Text style={styles.sectionHelper}>
            {config.pageCountHelper}
          </Text>

          <View
            style={[
              styles.pageInputCard,
              !!pageCountError &&
                styles.inputCardError,
            ]}
          >
            <Text style={styles.pageInputSuffix}>
              {config.uiCopy.pageUnitLabel}
            </Text>

            <TextInput
              value={pageCountText}
              keyboardType="number-pad"
              maxLength={6}
              placeholder={String(
                config.defaultPageCount,
              )}
              placeholderTextColor="#B0B0B0"
              selectTextOnFocus
              style={styles.pageInput}
              textAlign="right"
              onChangeText={(value) => {
                setPageCountText(
                  digitsOnly(value),
                );
                setSubmitError(null);
              }}
            />
          </View>

          {pageCountError ? (
            <Text style={styles.errorText}>
              {pageCountError}
            </Text>
          ) : null}

          {visiblePresets.length > 0 ? (
            <View style={styles.presetsRow}>
              {visiblePresets.map(
                (preset) => {
                  const isSelected =
                    pageCount ===
                    preset;

                  return (
                    <Pressable
                      key={preset}
                      style={[
                        styles.presetChip,
                        isSelected && {
                          backgroundColor:
                            config.accentColor,
                          borderColor:
                            config.accentColor,
                        },
                      ]}
                      onPress={() =>
                        selectPreset(
                          preset,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.presetText,
                          isSelected &&
                            styles.presetTextSelected,
                        ]}
                      >
                        {preset}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.copyHeader}>
            <View
              style={styles.copyStepper}
            >
              <Pressable
                accessibilityLabel={
                  config.uiCopy
                    .increaseCopiesAccessibilityLabel
                }
                disabled={
                  copyCount >=
                  config.maximumCopyCount
                }
                style={({ pressed }) => [
                  styles.stepperButton,
                  {
                    borderColor:
                      config.accentColor,
                  },
                  pressed &&
                    styles.buttonPressed,
                  copyCount >=
                    config.maximumCopyCount &&
                    styles.stepperDisabled,
                ]}
                onPress={() =>
                  changeCopyCount(
                    copyCount + 1,
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={config.accentColor}
                />
              </Pressable>

              <Text style={styles.copyValue}>
                {copyCount}
              </Text>

              <Pressable
                accessibilityLabel={
                  config.uiCopy
                    .decreaseCopiesAccessibilityLabel
                }
                disabled={
                  copyCount <=
                  config.minimumCopyCount
                }
                style={({ pressed }) => [
                  styles.stepperButton,
                  {
                    borderColor:
                      config.accentColor,
                  },
                  pressed &&
                    styles.buttonPressed,
                  copyCount <=
                    config.minimumCopyCount &&
                    styles.stepperDisabled,
                ]}
                onPress={() =>
                  changeCopyCount(
                    copyCount - 1,
                  )
                }
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={config.accentColor}
                />
              </Pressable>
            </View>

            <View style={styles.copyTitleWrap}>
              <Text style={styles.sectionTitle}>
                {config.copyCountLabel}
              </Text>

              <Text style={styles.sectionHelper}>
                {config.copyCountHelper}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor:
                    config.heroBackgroundColor,
                },
              ]}
            >
              <OptionIcon
                name={config.uiIcons.summary}
                fallback="receipt-outline"
                size={20}
                color={config.accentColor}
              />
            </View>

            <Text style={styles.summaryTitle}>
              {config.summaryTitle}
            </Text>
          </View>

          <SummaryRow
            label={
              config.sheetsPerCopyLabel
            }
            value={String(
              localQuote?.sheetsPerCopy ??
                0,
            )}
          />

          <SummaryRow
            label={
              config.totalSheetsLabel
            }
            value={String(
              localQuote?.totalSheets ??
                0,
            )}
          />

          <SummaryRow
            label={
              config.pricePerSheetLabel
            }
            value={formatAmount(
              localQuote?.rate
                ?.pricePerSheet ?? 0,
              currencyCode,
            )}
          />

          <View style={styles.summaryDivider} />

          <View style={styles.totalRow}>
            <Text
              style={[
                styles.totalValue,
                {
                  color:
                    config.accentDarkColor,
                },
              ]}
            >
              {formatAmount(
                localQuote?.totalPrice ??
                  0,
                currencyCode,
              )}
            </Text>

            <Text style={styles.totalLabel}>
              {config.totalLabel}
            </Text>
          </View>
        </View>

        {totalSheetsError ? (
          <Text style={styles.errorText}>
            {totalSheetsError}
          </Text>
        ) : null}

        <View
          style={[
            styles.fileNotice,
            {
              backgroundColor:
                config.heroBackgroundColor,
            },
          ]}
        >
          <View
            style={[
              styles.fileNoticeIcon,
              {
                backgroundColor:
                  config.accentColor,
              },
            ]}
          >
            <OptionIcon
              name={config.uiIcons.fileNotice}
              fallback="logo-whatsapp"
              size={21}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.fileNoticeCopy}>
            <Text style={styles.fileNoticeTitle}>
              {config.fileNoticeTitle}
            </Text>

            <Text style={styles.fileNoticeBody}>
              {config.fileNoticeBody}
            </Text>
          </View>
        </View>

        {submitError ? (
          <View style={styles.submitErrorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#C83737"
            />

            <Text style={styles.submitErrorText}>
              {submitError}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                10,
              ),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor:
                config.accentColor,
            },
            !canSubmit &&
              styles.submitButtonDisabled,
            pressed &&
              canSubmit && {
                backgroundColor:
                  config.accentDarkColor,
                transform: [
                  {
                    scale: 0.992,
                  },
                ],
              },
          ]}
          onPress={() => {
            void submitPrintJob();
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Text style={styles.submitTotal}>
                {formatAmount(
                  localQuote?.totalPrice ??
                    0,
                  currencyCode,
                )}
              </Text>

              <Text style={styles.submitLabel}>
                {editingItem
                  ? config.updateCtaLabel
                  : config.addCtaLabel}
              </Text>

              <View style={styles.submitIcon}>
                <OptionIcon
                  name={
                    editingItem
                      ? config.uiIcons
                          .updateCta
                      : config.uiIcons
                          .addCta
                  }
                  fallback={
                    editingItem
                      ? 'checkmark'
                      : 'bag-add-outline'
                  }
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function OptionSection({
  title,
  options,
  selectedId,
  accentColor,
  onSelect,
}: {
  title: string;
  options: PrintingColorOption[];
  selectedId: string;
  accentColor: string;
  onSelect: (
    option: PrintingColorOption,
  ) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <View style={styles.optionsRow}>
        {options.map((option) => {
          const isSelected =
            option.id === selectedId;

          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.optionCard,
                isSelected && {
                  backgroundColor:
                    `${accentColor}0D`,
                  borderColor:
                    accentColor,
                },
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                onSelect(option)
              }
            >
              <View
                style={[
                  styles.optionIcon,
                  isSelected && {
                    backgroundColor:
                      accentColor,
                  },
                ]}
              >
                <OptionIcon
                  name={option.iconName}
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : '#313131'
                  }
                />
              </View>

              <Text style={styles.optionLabel}>
                {option.label}
              </Text>

              <Text
                numberOfLines={2}
                style={styles.optionHelper}
              >
                {option.helper}
              </Text>

              <View
                style={[
                  styles.radioOuter,
                  isSelected && {
                    borderColor:
                      accentColor,
                  },
                ]}
              >
                {isSelected ? (
                  <View
                    style={[
                      styles.radioInner,
                      {
                        backgroundColor:
                          accentColor,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SideOptionSection({
  title,
  options,
  selectedId,
  accentColor,
  onSelect,
}: {
  title: string;
  options: PrintingSideOption[];
  selectedId: string;
  accentColor: string;
  onSelect: (
    option: PrintingSideOption,
  ) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <View style={styles.optionsRow}>
        {options.map((option) => {
          const isSelected =
            option.id === selectedId;

          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.optionCard,
                isSelected && {
                  backgroundColor:
                    `${accentColor}0D`,
                  borderColor:
                    accentColor,
                },
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                onSelect(option)
              }
            >
              <View
                style={[
                  styles.optionIcon,
                  isSelected && {
                    backgroundColor:
                      accentColor,
                  },
                ]}
              >
                <OptionIcon
                  name={option.iconName}
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : '#313131'
                  }
                />
              </View>

              <Text style={styles.optionLabel}>
                {option.label}
              </Text>

              <Text
                numberOfLines={2}
                style={styles.optionHelper}
              >
                {option.helper}
              </Text>

              <View
                style={[
                  styles.radioOuter,
                  isSelected && {
                    borderColor:
                      accentColor,
                  },
                ]}
              >
                {isSelected ? (
                  <View
                    style={[
                      styles.radioInner,
                      {
                        backgroundColor:
                          accentColor,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryValue}>
        {value}
      </Text>

      <Text style={styles.summaryLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F8F7',
    flex: 1,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF8F0',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  stateTitle: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 15,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  stateDescription: {
    color: '#6F6F6F',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#00B14F',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  stateBackButton: {
    marginTop: 9,
    padding: 10,
  },
  stateBackText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#ECECEC',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    color: '#202020',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 14,
    width: '100%',
  },
  heroCard: {
    borderRadius: 24,
    padding: 18,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginTop: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroTitle: {
    color: '#172019',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 31,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroSubtitle: {
    color: '#4D6254',
    fontSize: 12.5,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closedCard: {
    alignItems: 'center',
    backgroundColor: '#FFF5DA',
    borderColor: '#F0D89E',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 12,
    padding: 12,
  },
  closedText: {
    color: '#745814',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEEEC',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 13,
    padding: 15,
  },
  sectionTitle: {
    color: '#202020',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionHelper: {
    color: '#777777',
    fontSize: 10.5,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  optionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 13,
  },
  optionCard: {
    alignItems: 'flex-end',
    backgroundColor: '#FAFAFA',
    borderColor: '#E7E7E7',
    borderRadius: 17,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 142,
    padding: 12,
    position: 'relative',
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionLabel: {
    color: '#222222',
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  optionHelper: {
    color: '#777777',
    fontSize: 9.5,
    lineHeight: 15,
    marginTop: 4,
    paddingLeft: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#CFCFCF',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    left: 10,
    position: 'absolute',
    top: 10,
    width: 18,
  },
  radioInner: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  pageInputCard: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderColor: '#DFDFDF',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    minHeight: 60,
    paddingHorizontal: 15,
  },
  inputCardError: {
    borderColor: '#D94C4C',
  },
  pageInput: {
    color: '#202020',
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    minHeight: 56,
    paddingHorizontal: 10,
  },
  pageInputSuffix: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  presetsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 11,
  },
  presetChip: {
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderColor: '#E2E2E2',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 12,
  },
  presetText: {
    color: '#3B3B3B',
    fontSize: 12,
    fontWeight: '800',
  },
  presetTextSelected: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#C83737',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  copyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copyTitleWrap: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 14,
  },
  copyStepper: {
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 12,
    padding: 5,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepperDisabled: {
    opacity: 0.35,
  },
  copyValue: {
    color: '#202020',
    fontSize: 17,
    fontWeight: '900',
    minWidth: 25,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#202320',
    borderRadius: 21,
    marginTop: 13,
    padding: 16,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  summaryTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    marginRight: 9,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 31,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10.5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },
  summaryDivider: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: StyleSheet.hairlineWidth,
    marginVertical: 11,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  fileNotice: {
    alignItems: 'center',
    borderRadius: 19,
    flexDirection: 'row-reverse',
    marginTop: 13,
    padding: 13,
  },
  fileNoticeIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  fileNoticeCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 11,
  },
  fileNoticeTitle: {
    color: '#203226',
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fileNoticeBody: {
    color: '#536B5B',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  submitErrorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF1F1',
    borderColor: '#F1CACA',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 12,
    padding: 11,
  },
  submitErrorText: {
    color: '#9C3030',
    flex: 1,
    fontSize: 10.5,
    lineHeight: 17,
    marginRight: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E8E8E8',
    borderTopWidth:
      StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitTotal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    minWidth: 86,
    paddingLeft: 9,
    textAlign: 'left',
  },
  submitLabel: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  submitIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.13)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },
});
