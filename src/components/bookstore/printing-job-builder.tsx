import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';
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

type PrintingOptionBase = {
  id: string;
  label: string;
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
  size = 20,
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
    isPageInputFocused,
    setIsPageInputFocused,
  ] = useState(false);

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
      <View
        style={[
          styles.stateScreen,
          {
            paddingTop:
              insets.top,
            paddingBottom:
              insets.bottom,
          },
        ]}
      >
        <StatusBar style="dark" />

        <View style={styles.loadingIcon}>
          <ActivityIndicator
            size="small"
            color={
              NAVIENTY_NOW_COLORS.primary
            }
          />
        </View>

        <Text style={styles.stateDescription}>
          بنجهز لك الخيارات والأسعار المتاحة.
        </Text>
      </View>
    );
  }

  if (!config || loadError) {
    return (
      <View
        style={[
          styles.stateScreen,
          {
            paddingTop:
              insets.top,
            paddingBottom:
              insets.bottom,
          },
        ]}
      >
        <StatusBar style="dark" />

        <View style={styles.stateIcon}>
          <Ionicons
            name="print-outline"
            size={26}
            color={
              NAVIENTY_NOW_COLORS.primary
            }
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
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.primaryPressed,
          ]}
          onPress={() => {
            void loadConfig();
          }}
        >
          <Text style={styles.retryButtonText}>
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.stateBackButton,
            pressed &&
              styles.buttonPressed,
          ]}
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
      <StatusBar style="dark" />

      <View
        style={[
          styles.header,
          {
            paddingTop:
              Math.max(
                insets.top,
                Platform.OS ===
                  'android'
                  ? 24
                  : 6,
              ),
          },
        ]}
      >
        <Pressable
          accessibilityLabel={
            config.uiCopy
              .backAccessibilityLabel
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.headerButton,
            pressed &&
              styles.headerButtonPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={
              NAVIENTY_NOW_COLORS.text
            }
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
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {catalog.store.isManuallyClosed ? (
          <View style={styles.closedCard}>
            <View style={styles.closedIcon}>
              <Ionicons
                name="time-outline"
                size={16}
                color="#8A5A12"
              />
            </View>

            <Text style={styles.closedText}>
              {catalog.store.manualClosedNote ??
                config.uiCopy.closedFallback}
            </Text>
          </View>
        ) : null}

        <OptionSection
          title="نوع الطباعة"
          options={config.colorOptions}
          selectedId={selectedColorId}
          onSelect={(
            option: PrintingColorOption,
          ) => {
            setSelectedColorId(
              option.id,
            );
            setSubmitError(null);
          }}
        />

        <OptionSection
          title="شكل الطباعة"
          options={config.sideOptions}
          selectedId={selectedSideId}
          onSelect={(
            option: PrintingSideOption,
          ) => {
            setSelectedSideId(
              option.id,
            );
            setSubmitError(null);
          }}
        />

        <View style={styles.sectionCard}>
          <SectionHeading
            title="عدد الصفحات"
          />

          <View
            style={[
              styles.pageInputCard,
              isPageInputFocused &&
                styles.pageInputCardFocused,
              !!pageCountError &&
                styles.inputCardError,
            ]}
          >
            <TextInput
              value={pageCountText}
              keyboardType="number-pad"
              maxLength={6}
              placeholder={String(
                config.defaultPageCount,
              )}
              placeholderTextColor={
                NAVIENTY_NOW_COLORS.textMuted
              }
              selectTextOnFocus
              style={styles.pageInput}
              textAlign="right"
              onBlur={() =>
                setIsPageInputFocused(
                  false,
                )
              }
              onFocus={() =>
                setIsPageInputFocused(
                  true,
                )
              }
              onChangeText={(value) => {
                setPageCountText(
                  digitsOnly(value),
                );
                setSubmitError(null);
              }}
            />

            <Text style={styles.pageInputSuffix}>
              {config.uiCopy.pageUnitLabel}
            </Text>
          </View>

          {pageCountError ? (
            <View style={styles.inlineErrorRow}>
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={
                  NAVIENTY_NOW_COLORS.error
                }
              />

              <Text style={styles.errorText}>
                {pageCountError}
              </Text>
            </View>
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
                      accessibilityRole="button"
                      accessibilityState={{
                        selected:
                          isSelected,
                      }}
                      style={({ pressed }) => [
                        styles.presetChip,
                        isSelected &&
                          styles.presetChipSelected,
                        pressed &&
                          styles.buttonPressed,
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

        <View style={styles.sectionCard}>
          <SectionHeading
            title={config.copyCountLabel}
          />

          <View style={styles.copyStepper}>
            <Pressable
              accessibilityLabel={
                config.uiCopy
                  .increaseCopiesAccessibilityLabel
              }
              accessibilityRole="button"
              disabled={
                copyCount >=
                config.maximumCopyCount
              }
              style={({ pressed }) => [
                styles.stepperButton,
                pressed &&
                  copyCount <
                    config.maximumCopyCount &&
                  styles.stepperButtonPressed,
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
                color={
                  NAVIENTY_NOW_COLORS.primary
                }
              />
            </Pressable>

            <View style={styles.copyValueWrap}>
              <Text style={styles.copyValue}>
                {copyCount}
              </Text>
            </View>

            <Pressable
              accessibilityLabel={
                config.uiCopy
                  .decreaseCopiesAccessibilityLabel
              }
              accessibilityRole="button"
              disabled={
                copyCount <=
                config.minimumCopyCount
              }
              style={({ pressed }) => [
                styles.stepperButton,
                pressed &&
                  copyCount >
                    config.minimumCopyCount &&
                  styles.stepperButtonPressed,
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
                color={
                  NAVIENTY_NOW_COLORS.primary
                }
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>
              {config.summaryTitle}
            </Text>
          </View>

          <View style={styles.summaryRows}>
            <SummaryRow
              label={
                config.sheetsPerCopyLabel
              }
              value={String(
                localQuote?.sheetsPerCopy ??
                  0,
              )}
            />

            <View style={styles.summaryRowDivider} />

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
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>
              {config.totalLabel}
            </Text>

            <Text style={styles.totalValue}>
              {formatAmount(
                localQuote?.totalPrice ??
                  0,
                currencyCode,
              )}
            </Text>
          </View>
        </View>

        {totalSheetsError ? (
          <View style={styles.submitErrorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={
                NAVIENTY_NOW_COLORS.error
              }
            />

            <Text style={styles.submitErrorText}>
              {totalSheetsError}
            </Text>
          </View>
        ) : null}

        <View style={styles.fileNotice}>
          <View style={styles.fileNoticeIcon}>
            <OptionIcon
              name={config.uiIcons.fileNotice}
              fallback="logo-whatsapp"
              size={18}
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
              size={16}
              color={
                NAVIENTY_NOW_COLORS.error
              }
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
        <View style={styles.bottomBarContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              editingItem
                ? config.updateCtaLabel
                : config.addCtaLabel
            }
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit &&
                styles.submitButtonDisabled,
              pressed &&
                canSubmit &&
                styles.submitButtonPressed,
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
                <Text
                  numberOfLines={1}
                  style={styles.submitTotal}
                >
                  {formatAmount(
                    localQuote?.totalPrice ??
                      0,
                    currencyCode,
                  )}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.submitLabel}
                >
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
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SectionHeading({
  title,
}: {
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
}

function OptionSection<
  TOption extends PrintingOptionBase,
>({
  title,
  options,
  selectedId,
  onSelect,
}: {
  title: string;
  options: TOption[];
  selectedId: string;
  onSelect: (
    option: TOption,
  ) => void;
}) {
  const hasTitle = title.trim().length > 0;

  return (
    <View style={styles.sectionCard}>
      {hasTitle ? (
        <SectionHeading title={title} />
      ) : null}

      <View
        style={[
          styles.optionsGrid,
          !hasTitle &&
            styles.optionsGridWithoutTitle,
        ]}
      >
        {options.map((option) => {
          const isSelected =
            option.id === selectedId;

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: isSelected,
              }}
              style={({ pressed }) => [
                styles.optionCard,
                isSelected &&
                  styles.optionCardSelected,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                onSelect(option)
              }
            >
              <Text style={styles.optionLabel}>
                {option.label}
              </Text>
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
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  stateIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },

  stateTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  stateDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 290,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  retryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: 20,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  stateBackButton: {
    marginTop: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  stateBackText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* ============================================================
   * COMPACT UNIFIED HEADER
   * ============================================================
   */

  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#EEEEEE',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingBottom: 6,
    paddingHorizontal: 16,
    zIndex: 10,
  },

  headerButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  headerButtonPressed: {
    backgroundColor: '#F6F6F6',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  headerTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  headerSpacer: {
    height: 40,
    width: 40,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    width: '100%',
  },

  closedCard: {
    alignItems: 'center',
    backgroundColor: '#FFF8E8',
    borderColor: '#F0DFC0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  closedIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0C9',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },

  closedText: {
    color: '#735414',
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 16,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },

  sectionHeading: {
    alignItems: 'flex-end',
  },

  sectionTitle: {
    alignSelf: 'stretch',
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  optionsGrid: {
    alignItems: 'stretch',
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 10,
  },

  optionsGridWithoutTitle: {
    marginTop: 0,
  },

  optionCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 14,
    borderWidth: 1.25,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },

  optionCardSelected: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  optionLabel: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 12.5,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 18,
    textAlign: 'center',
    width: '100%',
    writingDirection: 'rtl',
  },

  pageInputCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 14,
    borderWidth: 1.25,
    flexDirection: 'row-reverse',
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 10,
  },

  pageInputCardFocused: {
    backgroundColor: '#FFFFFF',
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  inputCardError: {
    backgroundColor: '#FFF9F9',
    borderColor:
      NAVIENTY_NOW_COLORS.error,
  },

  pageInput: {
    color:
      NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    minHeight: 46,
    paddingHorizontal: 9,
    paddingVertical: 0,
  },

  pageInputSuffix: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
    writingDirection: 'rtl',
  },

  inlineErrorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    marginTop: 7,
  },

  errorText: {
    color:
      NAVIENTY_NOW_COLORS.error,
    flex: 1,
    fontSize: 9.5,
    lineHeight: 15,
    marginRight: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  presetsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },

  presetChip: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 46,
    paddingHorizontal: 10,
  },

  presetChipSelected: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.text,
    borderColor:
      NAVIENTY_NOW_COLORS.text,
  },

  presetText: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 11.5,
    fontWeight: '700',
  },

  presetTextSelected: {
    color: '#FFFFFF',
  },

  copyStepper: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 54,
    padding: 6,
  },

  stepperButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCE0',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  stepperButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  stepperDisabled: {
    opacity: 0.35,
  },

  copyValueWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  copyValue: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },

  summaryHeader: {
    marginBottom: 9,
  },

  summaryTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  summaryRows: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 34,
  },

  summaryLabel: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    flex: 1,
    fontSize: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  summaryValue: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 11.5,
    fontWeight: '800',
    marginRight: 10,
    textAlign: 'left',
  },

  summaryRowDivider: {
    backgroundColor: '#E8E8EB',
    height:
      StyleSheet.hairlineWidth,
  },

  totalCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor: '#DDF3E6',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 11,
  },

  totalLabel: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },

  totalValue: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'left',
  },

  fileNotice: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor: '#DDF3E6',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 10,
    padding: 10,
  },

  fileNoticeIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  fileNoticeCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 9,
  },

  fileNoticeTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  fileNoticeBody: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9.5,
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  submitErrorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F5',
    borderColor: '#F0D0D0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 9,
    padding: 9,
  },

  submitErrorText: {
    color: '#A53636',
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    marginRight: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEEE',
    borderTopWidth:
      StyleSheet.hairlineWidth,
    elevation: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 7,
  },

  bottomBarContent: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },

  submitButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
    paddingHorizontal: 7,
  },

  submitButtonDisabled: {
    backgroundColor: '#A8DDBF',
  },

  submitButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  submitTotal: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    minWidth: 80,
    paddingLeft: 8,
    textAlign: 'left',
  },

  submitLabel: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  submitIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  buttonPressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  primaryPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },
});
