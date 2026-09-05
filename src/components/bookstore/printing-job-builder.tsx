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
            size={30}
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
            size={22}
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
                size={18}
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
                size={15}
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
                size={23}
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
                size={23}
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
              size={18}
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
                12,
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
                    size={20}
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
    paddingHorizontal: 28,
  },

  loadingIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },

  stateIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  stateTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  stateDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 300,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  retryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 50,
    minWidth: 170,
    paddingHorizontal: 24,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  stateBackButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  stateBackText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },

  header: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    borderBottomColor: '#ECECEF',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 78,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    zIndex: 10,
  },

  headerButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },

  headerButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
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
    fontSize: 17,
    fontWeight: '900',
    paddingHorizontal: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  headerSpacer: {
    height: 46,
    width: 46,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },

  closedCard: {
    alignItems: 'center',
    backgroundColor: '#FFF8E8',
    borderColor: '#F0DFC0',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.controlRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  closedIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0C9',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  closedText: {
    color: '#735414',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    marginRight: 9,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginTop: 14,
    padding: 15,
  },

  sectionHeading: {
    alignItems: 'flex-end',
  },

  sectionTitle: {
    alignSelf: 'stretch',
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },


  optionsGrid: {
    alignItems: 'stretch',
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
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
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 12,
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
    fontSize: 14,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 20,
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
    borderRadius:
      NAVIENTY_NOW_LAYOUT.controlRadius,
    borderWidth: 1.5,
    flexDirection: 'row-reverse',
    marginTop: 14,
    minHeight: 64,
    paddingHorizontal: 12,
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
    fontSize: 22,
    fontWeight: '900',
    minHeight: 58,
    paddingHorizontal: 11,
    paddingVertical: 0,
  },

  pageInputSuffix: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: '800',
    writingDirection: 'rtl',
  },

  inlineErrorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    marginTop: 8,
  },

  errorText: {
    color:
      NAVIENTY_NOW_COLORS.error,
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    marginRight: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  presetsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
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
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 12,
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
    fontSize: 12,
    fontWeight: '800',
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
    borderRadius:
      NAVIENTY_NOW_LAYOUT.controlRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 14,
    minHeight: 66,
    padding: 7,
  },

  stepperButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCE0',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
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
    fontSize: 21,
    fontWeight: '900',
    minWidth: 36,
    textAlign: 'center',
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginTop: 14,
    padding: 15,
  },

  summaryHeader: {
    marginBottom: 12,
  },

  summaryTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  summaryRows: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 40,
  },

  summaryLabel: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    flex: 1,
    fontSize: 10.5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  summaryValue: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    marginRight: 12,
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
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 58,
    paddingHorizontal: 13,
  },

  totalLabel: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    writingDirection: 'rtl',
  },

  totalValue: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'left',
  },

  fileNotice: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor: '#DDF3E6',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 14,
    padding: 13,
  },

  fileNoticeIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
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
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  fileNoticeBody: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  submitErrorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F5',
    borderColor: '#F0D0D0',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.controlRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 12,
    padding: 11,
  },

  submitErrorText: {
    color: '#A53636',
    flex: 1,
    fontSize: 10.5,
    lineHeight: 17,
    marginRight: 7,
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
    paddingTop: 11,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.07,
    shadowRadius: 8,
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
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
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
    fontSize: 13.5,
    fontWeight: '900',
    minWidth: 88,
    paddingLeft: 9,
    textAlign: 'left',
  },

  submitLabel: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15.5,
    fontWeight: '900',
    paddingHorizontal: 6,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  submitIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
