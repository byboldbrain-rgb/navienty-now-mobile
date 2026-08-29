import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductGridScreenSkeleton } from '../../components/ui/loading-skeleton';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  findCatalogSectionBySlug,
  getCatalogSectionOffers,
  getCatalogSectionProducts,
  getStoreCatalog,
  listStores,
  type StoreCatalog,
} from '../../services/catalog-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';

/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const PAGE_MAX_WIDTH = 560;
const HORIZONTAL_PADDING = 16;
const PRODUCT_GAP = 10;

type ProductFilterKey =
  | 'all'
  | 'offers'
  | string;

type ProductCardMode =
  | 'category'
  | 'offers';

const NAVIENTY_NOW_GREEN =
  '#00B14F';

const NAVIENTY_NOW_GREEN_DARK =
  '#009245';

/* ============================================================
 * PERSONAL CARE CATEGORY DEFINITIONS
 * ============================================================
 *
 * The screen keeps the exact Personal Care Category UI/UX, while the
 * definitions below make the requested Personal Care hierarchy
 * available even if a matching child section has not been added to
 * Supabase yet. When a real CatalogSection exists, it always wins.
 */

const PERSONAL_CARE_CATEGORY_IMAGE = require(
  '../../assets/icons/categories/personal-care.webp',
);

/*
 * The "الكل" tile must use the exact same category artwork shown on
 * src/app/category/personal-care.tsx.
 *
 * These are the top-level Personal Care subcategory images.
 * Child / sub-subcategory artwork continues to come from
 * PERSONAL_CARE_SUBCATEGORY_IMAGES below.
 */
const PERSONAL_CARE_CATEGORY_IMAGES: Readonly<
  Partial<Record<string, ImageSourcePropType>>
> = {
  'face-care': require(
    '../../../assets/images/personal-care-categories/face-care.webp',
  ),

  'hair-care': require(
    '../../../assets/images/personal-care-categories/hair-care.webp',
  ),

  'body-care': require(
    '../../../assets/images/personal-care-categories/body-care.webp',
  ),

  'dental-care': require(
    '../../../assets/images/personal-care-categories/dental-care.webp',
  ),

  'face-makeup': require(
    '../../../assets/images/personal-care-categories/face-makeup.webp',
  ),

  /*
   * The landing page uses eye-brow-makeup while this screen's
   * configured definition is eyes-brows-makeup. Support both keys
   * so the artwork is stable regardless of which route value arrives.
   */
  'eye-brow-makeup': require(
    '../../../assets/images/personal-care-categories/eye-brow-makeup.webp',
  ),

  'eyes-brows-makeup': require(
    '../../../assets/images/personal-care-categories/eye-brow-makeup.webp',
  ),

  'lip-makeup': require(
    '../../../assets/images/personal-care-categories/lip-makeup.webp',
  ),

  'makeup-tools': require(
    '../../../assets/images/personal-care-categories/makeup-tools.webp',
  ),

  /*
   * العناية بالعين والشفاه is a merged UI category.
   * Keep the same artwork used on the Personal Care landing screen.
   */
  'eye-lip-care': require(
    '../../../assets/images/personal-care-categories/eye-care.webp',
  ),

  /*
   * Defensive aliases for old/deep links that may still open one of
   * the two source categories directly.
   */
  'eye-care': require(
    '../../../assets/images/personal-care-categories/eye-care.webp',
  ),

  'lip-care': require(
    '../../../assets/images/personal-care-categories/eye-care.webp',
  ),

  'women-care': require(
    '../../../assets/images/personal-care-categories/women-care.webp',
  ),

  'men-care': require(
    '../../../assets/images/personal-care-categories/men-care.webp',
  ),
};

/* ============================================================
 * PERSONAL CARE SUBCATEGORY IMAGES
 * ============================================================
 *
 * Local bundled artwork for the 51 Personal Care Sub Subcategories.
 *
 * Put the files in:
 * assets/images/personal-care-subcategories/
 *
 * IMPORTANT:
 * Expo / Metro requires static require(...) calls for bundled assets,
 * so these paths must remain literal strings.
 */

const PERSONAL_CARE_SUBCATEGORY_IMAGES: Readonly<
  Record<string, ImageSourcePropType>
> = {
  /* العناية بالوجه */
  'face-wash': require(
    '../../../assets/images/personal-care-subcategories/face-wash.webp',
  ),
  'face-moisturizers': require(
    '../../../assets/images/personal-care-subcategories/face-moisturizers.webp',
  ),
  'serums-treatments': require(
    '../../../assets/images/personal-care-subcategories/serums-treatments.webp',
  ),
  sunscreen: require(
    '../../../assets/images/personal-care-subcategories/sunscreen.webp',
  ),
  'face-masks': require(
    '../../../assets/images/personal-care-subcategories/face-masks.webp',
  ),
  'face-scrubs': require(
    '../../../assets/images/personal-care-subcategories/face-scrubs.webp',
  ),
  'toner-micellar-water': require(
    '../../../assets/images/personal-care-subcategories/toner-micellar-water.webp',
  ),

  /* العناية بالشعر */
  shampoo: require(
    '../../../assets/images/personal-care-subcategories/shampoo.webp',
  ),
  conditioner: require(
    '../../../assets/images/personal-care-subcategories/conditioner.webp',
  ),
  'hair-cream-bath': require(
    '../../../assets/images/personal-care-subcategories/hair-cream-bath.webp',
  ),
  'hair-mask': require(
    '../../../assets/images/personal-care-subcategories/hair-mask.webp',
  ),
  'hair-serums-oils': require(
    '../../../assets/images/personal-care-subcategories/hair-serums-oils.webp',
  ),
  'leave-in-creams': require(
    '../../../assets/images/personal-care-subcategories/leave-in-creams.webp',
  ),
  'hair-dyes': require(
    '../../../assets/images/personal-care-subcategories/hair-dyes.webp',
  ),

  /* العناية بالجسم */
  'shower-gel-soap': require(
    '../../../assets/images/personal-care-subcategories/shower-gel-soap.webp',
  ),
  'body-scrubs': require(
    '../../../assets/images/personal-care-subcategories/body-scrubs.webp',
  ),
  'body-lotion': require(
    '../../../assets/images/personal-care-subcategories/body-lotion.webp',
  ),
  'body-fragrances-mukhammaria': require(
    '../../../assets/images/personal-care-subcategories/body-fragrances-mukhammaria.webp',
  ),
  'massage-moisturizing-oils': require(
    '../../../assets/images/personal-care-subcategories/massage-moisturizing-oils.webp',
  ),
  deodorants: require(
    '../../../assets/images/personal-care-subcategories/deodorants.webp',
  ),
  'hand-nail-creams': require(
    '../../../assets/images/personal-care-subcategories/hand-nail-creams.webp',
  ),

  /* العناية بالأسنان */
  toothpaste: require(
    '../../../assets/images/personal-care-subcategories/toothpaste.webp',
  ),
  toothbrushes: require(
    '../../../assets/images/personal-care-subcategories/toothbrushes.webp',
  ),
  mouthwash: require(
    '../../../assets/images/personal-care-subcategories/mouthwash.webp',
  ),
  'teeth-whitening': require(
    '../../../assets/images/personal-care-subcategories/teeth-whitening.webp',
  ),
  'dental-floss': require(
    '../../../assets/images/personal-care-subcategories/dental-floss.webp',
  ),

  /* تجميل الوجه */
  'foundation-concealer': require(
    '../../../assets/images/personal-care-subcategories/foundation-concealer.webp',
  ),
  'powder-blush': require(
    '../../../assets/images/personal-care-subcategories/powder-blush.webp',
  ),
  'contour-highlighter': require(
    '../../../assets/images/personal-care-subcategories/contour-highlighter.webp',
  ),
  'primer-setting-spray': require(
    '../../../assets/images/personal-care-subcategories/primer-setting-spray.webp',
  ),

  /* تجميل العيون والحواجب */
  mascara: require(
    '../../../assets/images/personal-care-subcategories/mascara.webp',
  ),
  'eyebrow-pencils-products': require(
    '../../../assets/images/personal-care-subcategories/eyebrow-pencils-products.webp',
  ),
  'eyeliner-kohl': require(
    '../../../assets/images/personal-care-subcategories/eyeliner-kohl.webp',
  ),
  eyeshadow: require(
    '../../../assets/images/personal-care-subcategories/eyeshadow.webp',
  ),

  /* تجميل الشفاه */
  lipstick: require(
    '../../../assets/images/personal-care-subcategories/lipstick.webp',
  ),
  'lip-gloss': require(
    '../../../assets/images/personal-care-subcategories/lip-gloss.webp',
  ),
  'lip-liner': require(
    '../../../assets/images/personal-care-subcategories/lip-liner.webp',
  ),

  /* أدوات التجميل */
  'makeup-brushes': require(
    '../../../assets/images/personal-care-subcategories/makeup-brushes.webp',
  ),
  'makeup-removal-tools': require(
    '../../../assets/images/personal-care-subcategories/makeup-removal-tools.webp',
  ),

  /* العناية بالعين */
  'eye-creams-serums': require(
    '../../../assets/images/personal-care-subcategories/eye-creams-serums.webp',
  ),

  /* العناية بالشفاه */
  'lip-moisturizers-scrubs': require(
    '../../../assets/images/personal-care-subcategories/lip-moisturizers-scrubs.webp',
  ),

  /* العناية بالمرأة */
  'sanitary-pads-supplies': require(
    '../../../assets/images/personal-care-subcategories/sanitary-pads-supplies.webp',
  ),
  'feminine-wash-change-supplies': require(
    '../../../assets/images/personal-care-subcategories/feminine-wash-change-supplies.webp',
  ),
  'hair-removal-razors': require(
    '../../../assets/images/personal-care-subcategories/hair-removal-razors.webp',
  ),
  'wax-hair-removal-creams': require(
    '../../../assets/images/personal-care-subcategories/wax-hair-removal-creams.webp',
  ),

  /* العناية بالرجل */
  'shaving-razors-foam': require(
    '../../../assets/images/personal-care-subcategories/shaving-razors-foam.webp',
  ),
  'aftershave-balm': require(
    '../../../assets/images/personal-care-subcategories/aftershave-balm.webp',
  ),
  'men-shower-gel-wash': require(
    '../../../assets/images/personal-care-subcategories/men-shower-gel-wash.webp',
  ),
  'men-deodorants': require(
    '../../../assets/images/personal-care-subcategories/men-deodorants.webp',
  ),
  'men-skin-face-care': require(
    '../../../assets/images/personal-care-subcategories/men-skin-face-care.webp',
  ),
  'anti-hair-loss-shampoo': require(
    '../../../assets/images/personal-care-subcategories/anti-hair-loss-shampoo.webp',
  ),
};

type PersonalCareSubcategoryDefinition = {
  key: string;
  label: string;
  aliases: readonly string[];
  productKeywords: readonly string[];
};

type PersonalCareCategoryDefinition = {
  key: string;
  label: string;
  aliases: readonly string[];
  productKeywords: readonly string[];
  subcategories: readonly PersonalCareSubcategoryDefinition[];
};

type PersonalCareFilterItem = {
  key: string;
  label: string;
  section: CatalogSection | null;
  definition: PersonalCareSubcategoryDefinition | null;
};

const PERSONAL_CARE_CATEGORIES:
  readonly PersonalCareCategoryDefinition[] = [
    {
      key: 'face-care',
      label: 'العناية بالوجه',
      aliases: [
        'face-care',
        'facial-care',
        'skin-care',
        'skincare',
        'العناية بالوجه',
        'عناية بالوجه',
      ],
      productKeywords: [
        'وجه', 'بشرة', 'غسول', 'مرطب', 'سيروم', 'واقي شمس', 'ماسك', 'مقشر', 'تونر', 'ميسيلار',
        'face', 'facial', 'skin', 'cleanser', 'moisturizer', 'serum', 'sunscreen', 'mask', 'scrub', 'toner', 'micellar',
      ],
      subcategories: [
        {
          key: 'face-wash',
          label: 'غسول الوجه',
          aliases: ['face-wash', 'facial-cleanser', 'face-cleanser', 'cleanser', 'غسول الوجه', 'غسول وجه'],
          productKeywords: ['غسول الوجه', 'غسول وجه', 'منظف الوجه', 'face wash', 'facial cleanser', 'face cleanser'],
        },
        {
          key: 'face-moisturizers',
          label: 'مرطبات الوجه',
          aliases: ['face-moisturizers', 'facial-moisturizers', 'face-moisturizer', 'مرطبات الوجه', 'مرطب الوجه'],
          productKeywords: ['مرطب الوجه', 'مرطبات الوجه', 'كريم مرطب', 'face moisturizer', 'facial moisturizer'],
        },
        {
          key: 'serums-treatments',
          label: 'سيروم ومعالجات',
          aliases: ['serums-treatments', 'serum-treatments', 'face-serums', 'treatments', 'سيروم ومعالجات', 'سيروم'],
          productKeywords: ['سيروم', 'معالج', 'معالجات', 'serum', 'treatment'],
        },
        {
          key: 'sunscreen',
          label: 'واقيات الشمس',
          aliases: ['sunscreen', 'sun-protection', 'sun-care', 'واقيات الشمس', 'واقي الشمس'],
          productKeywords: ['واقي شمس', 'واقيات الشمس', 'صن بلوك', 'sunscreen', 'sunblock', 'spf'],
        },
        {
          key: 'face-masks',
          label: 'ماسكات الوجه',
          aliases: ['face-masks', 'facial-masks', 'face-mask', 'ماسكات الوجه', 'ماسك الوجه'],
          productKeywords: ['ماسك الوجه', 'ماسكات الوجه', 'face mask', 'facial mask', 'sheet mask'],
        },
        {
          key: 'face-scrubs',
          label: 'مقشرات الوجه',
          aliases: ['face-scrubs', 'facial-scrubs', 'face-exfoliators', 'مقشرات الوجه', 'مقشر الوجه'],
          productKeywords: ['مقشر الوجه', 'مقشرات الوجه', 'face scrub', 'facial scrub', 'exfoliator'],
        },
        {
          key: 'toner-micellar-water',
          label: 'التونر والماء الميسيلار',
          aliases: ['toner-micellar-water', 'toner-and-micellar-water', 'toner', 'micellar-water', 'التونر والماء الميسيلار', 'ماء ميسيلار'],
          productKeywords: ['تونر', 'ماء ميسيلار', 'الماء الميسيلار', 'toner', 'micellar water'],
        },
      ],
    },
    {
      key: 'hair-care',
      label: 'العناية بالشعر',
      aliases: ['hair-care', 'haircare', 'hair', 'العناية بالشعر', 'عناية بالشعر'],
      productKeywords: ['شعر', 'شامبو', 'بلسم', 'ماسك', 'زيت شعر', 'سيروم شعر', 'صبغة', 'hair', 'shampoo', 'conditioner', 'hair mask', 'hair oil', 'hair serum', 'hair dye'],
      subcategories: [
        { key: 'shampoo', label: 'الشامبو', aliases: ['shampoo', 'الشامبو', 'شامبو'], productKeywords: ['شامبو', 'shampoo'] },
        { key: 'conditioner', label: 'البلسم', aliases: ['conditioner', 'hair-conditioner', 'البلسم', 'بلسم'], productKeywords: ['بلسم', 'conditioner'] },
        { key: 'hair-cream-bath', label: 'حمام الكريم', aliases: ['hair-cream-bath', 'cream-bath', 'hair-cream-treatment', 'حمام الكريم', 'حمام كريم'], productKeywords: ['حمام كريم', 'حمام الكريم', 'cream bath', 'hair cream bath'] },
        { key: 'hair-mask', label: 'الماسك', aliases: ['hair-mask', 'hair-masks', 'الماسك', 'ماسك الشعر'], productKeywords: ['ماسك الشعر', 'hair mask'] },
        { key: 'hair-serums-oils', label: 'سيروم وزيوت الشعر', aliases: ['hair-serums-oils', 'hair-serum-oils', 'hair-oils', 'سيروم وزيوت الشعر'], productKeywords: ['سيروم شعر', 'زيت شعر', 'زيوت الشعر', 'hair serum', 'hair oil'] },
        { key: 'leave-in-creams', label: 'كريمات وليف ان', aliases: ['leave-in-creams', 'leave-in', 'hair-creams-leave-in', 'كريمات وليف ان', 'ليف ان'], productKeywords: ['ليف ان', 'كريم شعر', 'leave in', 'leave-in', 'hair cream'] },
        { key: 'hair-dyes', label: 'صبغات الشعر', aliases: ['hair-dyes', 'hair-color', 'hair-colour', 'صبغات الشعر', 'صبغة شعر'], productKeywords: ['صبغة شعر', 'صبغات الشعر', 'hair dye', 'hair color', 'hair colour'] },
      ],
    },
    {
      key: 'body-care',
      label: 'العناية بالجسم',
      aliases: ['body-care', 'bodycare', 'body', 'العناية بالجسم', 'عناية بالجسم'],
      productKeywords: ['جسم', 'شاور جل', 'صابون', 'لوشن', 'مقشر', 'مزيل عرق', 'زيت مساج', 'يدين', 'أظافر', 'body', 'shower gel', 'soap', 'lotion', 'scrub', 'deodorant', 'massage oil', 'hand cream', 'nail'],
      subcategories: [
        { key: 'shower-gel-soap', label: 'شاور جل وصابون', aliases: ['shower-gel-soap', 'shower-gel-and-soap', 'body-wash-soap', 'شاور جل وصابون'], productKeywords: ['شاور جل', 'صابون', 'body wash', 'shower gel', 'soap'] },
        { key: 'body-scrubs', label: 'مقشرات الجسم', aliases: ['body-scrubs', 'body-exfoliators', 'مقشرات الجسم', 'مقشر الجسم'], productKeywords: ['مقشر الجسم', 'مقشرات الجسم', 'body scrub', 'body exfoliator'] },
        { key: 'body-lotion', label: 'لوشن', aliases: ['body-lotion', 'lotion', 'لوشن', 'لوشن الجسم'], productKeywords: ['لوشن', 'body lotion', 'lotion'] },
        { key: 'body-fragrances-mukhammaria', label: 'معطرات ومخمرية', aliases: ['body-fragrances-mukhammaria', 'body-fragrance', 'mukhammaria', 'معطرات ومخمرية', 'مخمرية'], productKeywords: ['معطر جسم', 'معطرات', 'مخمرية', 'body mist', 'body fragrance', 'mukhammaria'] },
        { key: 'massage-moisturizing-oils', label: 'زيوت المساج والترطيب', aliases: ['massage-moisturizing-oils', 'massage-oils', 'body-oils', 'زيوت المساج والترطيب'], productKeywords: ['زيت مساج', 'زيوت المساج', 'زيت ترطيب', 'body oil', 'massage oil'] },
        { key: 'deodorants', label: 'مزيلات العرق', aliases: ['deodorants', 'deodorant', 'antiperspirants', 'مزيلات العرق', 'مزيل عرق'], productKeywords: ['مزيل عرق', 'مزيلات العرق', 'deodorant', 'antiperspirant'] },
        { key: 'hand-nail-creams', label: 'كريمات اليدين والأظافر', aliases: ['hand-nail-creams', 'hand-and-nail-creams', 'hand-creams', 'كريمات اليدين والأظافر'], productKeywords: ['كريم يد', 'كريم اليدين', 'الأظافر', 'hand cream', 'nail cream', 'hand and nail'] },
      ],
    },
    {
      key: 'dental-care',
      label: 'العناية بالأسنان',
      aliases: ['dental-care', 'oral-care', 'teeth-care', 'العناية بالأسنان', 'العناية بالاسنان'],
      productKeywords: ['أسنان', 'اسنان', 'معجون', 'فرشاة', 'غسول فم', 'خيط', 'تبييض', 'tooth', 'dental', 'toothpaste', 'toothbrush', 'mouthwash', 'floss', 'whitening'],
      subcategories: [
        { key: 'toothpaste', label: 'معجون الأسنان', aliases: ['toothpaste', 'tooth-paste', 'معجون الأسنان', 'معجون الاسنان'], productKeywords: ['معجون أسنان', 'معجون اسنان', 'toothpaste'] },
        { key: 'toothbrushes', label: 'فرش الأسنان', aliases: ['toothbrushes', 'toothbrush', 'tooth-brushes', 'فرش الأسنان', 'فرش الاسنان'], productKeywords: ['فرشاة أسنان', 'فرش اسنان', 'toothbrush'] },
        { key: 'mouthwash', label: 'غسول الفم', aliases: ['mouthwash', 'mouth-wash', 'غسول الفم'], productKeywords: ['غسول الفم', 'mouthwash', 'mouth wash'] },
        { key: 'teeth-whitening', label: 'تبييض الأسنان', aliases: ['teeth-whitening', 'tooth-whitening', 'whitening', 'تبييض الأسنان', 'تبييض الاسنان'], productKeywords: ['تبييض الأسنان', 'تبييض اسنان', 'teeth whitening', 'whitening strips'] },
        { key: 'dental-floss', label: 'الخيط الطبي', aliases: ['dental-floss', 'floss', 'الخيط الطبي', 'خيط الأسنان', 'خيط الاسنان'], productKeywords: ['الخيط الطبي', 'خيط أسنان', 'dental floss', 'floss'] },
      ],
    },
    {
      key: 'face-makeup',
      label: 'تجميل الوجه',
      aliases: ['face-makeup', 'complexion-makeup', 'face-beauty', 'تجميل الوجه', 'مكياج الوجه'],
      productKeywords: ['فاونديشن', 'كونسيلر', 'بودرة', 'بلاشر', 'كنتور', 'هايلايتر', 'برايمر', 'تثبيت', 'foundation', 'concealer', 'powder', 'blush', 'contour', 'highlighter', 'primer', 'setting spray'],
      subcategories: [
        { key: 'foundation-concealer', label: 'الفاونديشن والكونسيلر', aliases: ['foundation-concealer', 'foundation-and-concealer', 'الفاونديشن والكونسيلر'], productKeywords: ['فاونديشن', 'كونسيلر', 'foundation', 'concealer'] },
        { key: 'powder-blush', label: 'البودرة والبلاشر', aliases: ['powder-blush', 'powder-and-blush', 'البودرة والبلاشر'], productKeywords: ['بودرة', 'بلاشر', 'powder', 'blush'] },
        { key: 'contour-highlighter', label: 'الكنتور والهايلايتر', aliases: ['contour-highlighter', 'contour-and-highlighter', 'الكنتور والهايلايتر'], productKeywords: ['كنتور', 'هايلايتر', 'contour', 'highlighter'] },
        { key: 'primer-setting-spray', label: 'البرايمر وبخاخ التثبيت', aliases: ['primer-setting-spray', 'primer-and-setting-spray', 'البرايمر وبخاخ التثبيت'], productKeywords: ['برايمر', 'بخاخ تثبيت', 'سبراي تثبيت', 'primer', 'setting spray'] },
      ],
    },
    {
      key: 'eyes-brows-makeup',
      label: 'تجميل العيون والحواجب',
      aliases: ['eyes-brows-makeup', 'eye-brow-makeup', 'eyes-eyebrows-makeup', 'eye-makeup', 'تجميل العيون والحواجب', 'تجميل العيون و الحواجب'],
      productKeywords: ['ماسكارا', 'حواجب', 'آيلاينر', 'ايلاينر', 'كحل', 'ظلال عيون', 'mascara', 'eyebrow', 'eyeliner', 'kohl', 'eyeshadow'],
      subcategories: [
        { key: 'mascara', label: 'الماسكارا', aliases: ['mascara', 'الماسكارا', 'ماسكارا'], productKeywords: ['ماسكارا', 'mascara'] },
        { key: 'eyebrow-pencils-products', label: 'أقلام ورسم الحواجب', aliases: ['eyebrow-pencils-products', 'eyebrow-pencils', 'brow-products', 'أقلام ورسم الحواجب', 'اقلام ورسم الحواجب'], productKeywords: ['قلم حواجب', 'أقلام حواجب', 'رسم الحواجب', 'eyebrow pencil', 'brow pencil', 'brow gel'] },
        { key: 'eyeliner-kohl', label: 'الآيلاينر والكحل', aliases: ['eyeliner-kohl', 'eyeliner-and-kohl', 'الآيلاينر والكحل', 'الايلاينر والكحل'], productKeywords: ['آيلاينر', 'ايلاينر', 'كحل', 'eyeliner', 'kohl'] },
        { key: 'eyeshadow', label: 'ظلال العيون', aliases: ['eyeshadow', 'eye-shadow', 'ظلال العيون'], productKeywords: ['ظلال العيون', 'اي شادو', 'آي شادو', 'eyeshadow', 'eye shadow'] },
      ],
    },
    {
      key: 'lip-makeup',
      label: 'تجميل الشفاة',
      aliases: ['lip-makeup', 'lips-makeup', 'lip-beauty', 'تجميل الشفاة', 'تجميل الشفاه'],
      productKeywords: ['روج', 'أحمر شفاه', 'ليبستيك', 'ليب جلوس', 'ليب لاينر', 'lipstick', 'lip gloss', 'lip liner'],
      subcategories: [
        { key: 'lipstick', label: 'Lipstick', aliases: ['lipstick', 'lip-stick', 'روج', 'أحمر الشفاه', 'احمر الشفاه'], productKeywords: ['lipstick', 'ليبستيك', 'روج', 'أحمر شفاه', 'احمر شفاه'] },
        { key: 'lip-gloss', label: 'Lip Gloss', aliases: ['lip-gloss', 'lipgloss', 'ليب جلوس'], productKeywords: ['lip gloss', 'lipgloss', 'ليب جلوس'] },
        { key: 'lip-liner', label: 'Lip Liner', aliases: ['lip-liner', 'lipliner', 'ليب لاينر', 'محدد الشفاه'], productKeywords: ['lip liner', 'lipliner', 'ليب لاينر', 'محدد شفاه'] },
      ],
    },
    {
      key: 'makeup-tools',
      label: 'أدوات التجميل',
      aliases: ['makeup-tools', 'beauty-tools', 'cosmetic-tools', 'أدوات التجميل', 'ادوات التجميل'],
      productKeywords: ['فرش مكياج', 'إزالة المكياج', 'ازالة المكياج', 'makeup brush', 'makeup remover', 'beauty tool'],
      subcategories: [
        { key: 'makeup-brushes', label: 'فرش', aliases: ['makeup-brushes', 'brushes', 'فرش', 'فرش المكياج'], productKeywords: ['فرش مكياج', 'فرش', 'makeup brush', 'brush set'] },
        { key: 'makeup-removal-tools', label: 'أدوات إزالة المكياج', aliases: ['makeup-removal-tools', 'makeup-remover-tools', 'أدوات إزالة المكياج', 'ادوات ازالة المكياج'], productKeywords: ['إزالة المكياج', 'ازالة المكياج', 'قطن إزالة المكياج', 'makeup remover', 'cleansing pad', 'makeup removal'] },
      ],
    },
    {
      key: 'eye-lip-care',
      label: 'العناية بالعين والشفاه',
      aliases: ['eye-lip-care', 'eyes-lips-care', 'eye-and-lip-care', 'eye-care-lip-care', 'العناية بالعين والشفاه', 'العناية بالعين والشفاة'],
      productKeywords: ['عين', 'شفاه', 'شفاة', 'كريم عين', 'سيروم عين', 'مرطب شفاه', 'مقشر شفاه', 'eye cream', 'eye serum', 'lip balm', 'lip scrub'],
      subcategories: [
        { key: 'eye-creams-serums', label: 'كريمات وسيروم العين', aliases: ['eye-creams-serums', 'eye-cream-serum', 'eye-care-serums', 'كريمات وسيروم العين'], productKeywords: ['كريم عين', 'سيروم عين', 'كريمات العين', 'eye cream', 'eye serum'] },
        { key: 'lip-moisturizers-scrubs', label: 'مرطبات ومقشرات الشفاه', aliases: ['lip-moisturizers-scrubs', 'lip-balms-scrubs', 'lip-care', 'مرطبات ومقشرات الشفاه', 'مرطبات ومقشرات الشفاة'], productKeywords: ['مرطب شفاه', 'مقشر شفاه', 'بلسم شفاه', 'lip balm', 'lip moisturizer', 'lip scrub'] },
      ],
    },
    {
      key: 'women-care',
      label: 'العناية بالمرأة',
      aliases: ['women-care', 'womens-care', 'woman-care', 'feminine-care', 'العناية بالمرأة', 'العناية بالمرأه'],
      productKeywords: ['فوط صحية', 'غسول نسائي', 'شفرات', 'إزالة الشعر', 'ازالة الشعر', 'شمع', 'sanitary pads', 'feminine wash', 'razor', 'hair removal', 'wax'],
      subcategories: [
        { key: 'sanitary-pads-supplies', label: 'فوط صحية ومستلزماتها', aliases: ['sanitary-pads-supplies', 'sanitary-pads', 'period-care', 'فوط صحية ومستلزماتها'], productKeywords: ['فوط صحية', 'فوط نسائية', 'sanitary pad', 'period pad', 'period care'] },
        { key: 'feminine-wash-change-supplies', label: 'غسول وغيارات', aliases: ['feminine-wash-change-supplies', 'feminine-wash', 'liners', 'غسول وغيارات'], productKeywords: ['غسول نسائي', 'غسول مهبلي', 'غيارات', 'بطانة يومية', 'feminine wash', 'panty liner', 'liner'] },
        { key: 'hair-removal-razors', label: 'شفرات إزالة الشعر', aliases: ['hair-removal-razors', 'women-razors', 'razors', 'شفرات إزالة الشعر', 'شفرات ازالة الشعر'], productKeywords: ['شفرة إزالة الشعر', 'شفرات إزالة الشعر', 'women razor', 'hair removal razor'] },
        { key: 'wax-hair-removal-creams', label: 'الشمع وكريمات الإزالة', aliases: ['wax-hair-removal-creams', 'wax-and-hair-removal-creams', 'hair-removal-creams', 'الشمع وكريمات الإزالة', 'الشمع وكريمات الازالة'], productKeywords: ['شمع إزالة الشعر', 'كريم إزالة الشعر', 'hair removal cream', 'depilatory cream', 'wax'] },
      ],
    },
    {
      key: 'men-care',
      label: 'العناية بالرجل',
      aliases: ['men-care', 'mens-care', 'male-care', 'men-grooming', 'العناية بالرجل', 'العناية بالرجال'],
      productKeywords: ['حلاقة', 'شفرات', 'رغوة', 'بعد الحلاقة', 'شاور جل', 'مزيل عرق', 'بشرة', 'تساقط الشعر', 'men', 'shaving', 'razor', 'aftershave', 'deodorant', 'anti hair loss'],
      subcategories: [
        { key: 'shaving-razors-foam', label: 'شفرات ورغوة الحلاقة', aliases: ['shaving-razors-foam', 'razors-shaving-foam', 'shaving', 'شفرات ورغوة الحلاقة'], productKeywords: ['شفرة حلاقة', 'شفرات حلاقة', 'رغوة حلاقة', 'shaving razor', 'shaving foam'] },
        { key: 'aftershave-balm', label: 'بلسم بعد الحلاقة', aliases: ['aftershave-balm', 'after-shave-balm', 'aftershave', 'بلسم بعد الحلاقة'], productKeywords: ['بعد الحلاقة', 'بلسم بعد الحلاقة', 'aftershave', 'after shave balm'] },
        { key: 'men-shower-gel-wash', label: 'شاور جل وغسول', aliases: ['men-shower-gel-wash', 'men-body-wash', 'shower-gel-wash', 'شاور جل وغسول'], productKeywords: ['شاور جل رجالي', 'غسول رجالي', 'men shower gel', 'men body wash', 'men face wash'] },
        { key: 'men-deodorants', label: 'مزيلات العرق', aliases: ['men-deodorants', 'mens-deodorants', 'deodorants-men', 'مزيلات العرق'], productKeywords: ['مزيل عرق رجالي', 'men deodorant', 'mens deodorant'] },
        { key: 'men-skin-face-care', label: 'البشرة والوجه', aliases: ['men-skin-face-care', 'mens-skincare', 'men-face-care', 'البشرة والوجه'], productKeywords: ['عناية وجه رجالي', 'بشرة رجالي', 'men skincare', 'men face care', 'men moisturizer'] },
        { key: 'anti-hair-loss-shampoo', label: 'شامبو ضد التساقط', aliases: ['anti-hair-loss-shampoo', 'hair-loss-shampoo', 'anti-fall-shampoo', 'شامبو ضد التساقط'], productKeywords: ['شامبو ضد التساقط', 'تساقط الشعر', 'anti hair loss shampoo', 'anti-fall shampoo', 'hair loss shampoo'] },
      ],
    },
  ];

/* ============================================================
 * HELPERS
 * ============================================================
 */

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeSearchText(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeSlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCategoryMatchValue(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9\u0600-\u06ff]+/g,
      '-',
    )
    .replace(/^-+|-+$/g, '');
}

function categoryValuesMatch(
  firstValue: string,
  secondValue: string,
) {
  if (
    !firstValue ||
    !secondValue
  ) {
    return false;
  }

  if (firstValue === secondValue) {
    return true;
  }

  return (
    firstValue.startsWith(
      `${secondValue}-`,
    ) ||
    firstValue.endsWith(
      `-${secondValue}`,
    ) ||
    firstValue.includes(
      `-${secondValue}-`,
    ) ||
    secondValue.startsWith(
      `${firstValue}-`,
    ) ||
    secondValue.endsWith(
      `-${firstValue}`,
    ) ||
    secondValue.includes(
      `-${firstValue}-`,
    )
  );
}

function getPersonalCareCategoryDefinition(
  sectionSlug: string,
  categoryKey: string | undefined,
  label: string | undefined,
) {
  const requestedValues = [
    sectionSlug,
    categoryKey,
    label,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  return (
    PERSONAL_CARE_CATEGORIES.find(
      (definition) => {
        const acceptedValues = [
          definition.key,
          definition.label,
          ...definition.aliases,
        ].map(
          normalizeCategoryMatchValue,
        );

        return requestedValues.some(
          (requestedValue) =>
            acceptedValues.some(
              (acceptedValue) =>
                categoryValuesMatch(
                  requestedValue,
                  acceptedValue,
                ),
            ),
        );
      },
    ) ?? null
  );
}

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage =
    product.images.find(
      (image) => image.isCover,
    );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return (
    product.images[0]?.imageUrl ??
    null
  );
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  if (
    product.compareAtPrice === null ||
    product.compareAtPrice <=
      product.price ||
    product.compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((product.compareAtPrice -
      product.price) /
      product.compareAtPrice) *
      100,
  );
}

function isOfferProduct(
  product: CatalogProduct,
) {
  return (
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price &&
    product.compareAtPrice > 0
  );
}

function formatMoney(
  value: number,
  currencyCode: string,
) {
  const currencyLabel =
    currencyCode
      .trim()
      .toUpperCase() === 'EGP'
      ? 'ج.م'
      : currencyCode;

  return `${value.toFixed(
    2,
  )} ${currencyLabel}`;
}

function deduplicateProducts(
  products: CatalogProduct[],
) {
  const productsMap =
    new Map<
      string,
      CatalogProduct
    >();

  for (const product of products) {
    productsMap.set(
      product.id,
      product,
    );
  }

  return Array.from(
    productsMap.values(),
  );
}

function getOfferPageRootCategories(
  catalog: StoreCatalog,
): CatalogSection[] {
  /*
   * Primary source:
   * categoryTree contains the real root categories.
   */
  const treeRoots =
    catalog.categoryTree.filter(
      (section) =>
        section.parentId === null ||
        section.depth === 0,
    );

  /*
   * Defensive fallback:
   * لو categoryTree رجعت فاضية لأي سبب،
   * نستخدم الـFlat sections ونجيب الـRoot categories.
   */
  const fallbackRoots =
    catalog.sections.filter(
      (section) =>
        section.parentId === null,
    );

  const source =
    treeRoots.length > 0
      ? treeRoots
      : fallbackRoots.length > 0
        ? fallbackRoots
        : catalog.sections.filter(
            (section) =>
              section.depth === 0,
          );

  const uniqueRoots =
    new Map<
      string,
      CatalogSection
    >();

  for (const section of source) {
    uniqueRoots.set(
      section.id,
      section,
    );
  }

  return Array.from(
    uniqueRoots.values(),
  ).sort(
    (
      first,
      second,
    ) => {
      if (
        first.sortOrder !==
        second.sortOrder
      ) {
        return (
          first.sortOrder -
          second.sortOrder
        );
      }

      return first.name.localeCompare(
        second.name,
        'ar',
      );
    },
  );
}

function getAllCatalogOffers(
  catalog: StoreCatalog,
) {
  const products: CatalogProduct[] =
    [];

  for (
    const rootCategory of
    getOfferPageRootCategories(
      catalog,
    )
  ) {
    products.push(
      ...getCatalogSectionOffers(
        rootCategory,
      ),
    );
  }

  /*
   * Final defensive fallback:
   * لو hierarchy مش مكتملة، نجمع أي منتج عليه خصم
   * من كل sections بدل ما صفحة العروض تظهر فاضية.
   */
  if (products.length === 0) {
    for (
      const section of
      catalog.sections
    ) {
      for (
        const product of
        section.products
      ) {
        if (
          isOfferProduct(
            product,
          )
        ) {
          products.push(
            product,
          );
        }
      }
    }
  }

  return deduplicateProducts(
    products,
  );
}

function findCatalogSectionByCategoryKey(
  catalog: StoreCatalog,
  categoryKey: string | undefined,
): CatalogSection | null {
  const rawCategoryKey =
    (categoryKey ?? '').trim();

  if (!rawCategoryKey) {
    return null;
  }

  /*
   * the Personal Care landing page sends categoryKey as section.id.
   * Older/deep links may still send the slug.
   * Support both so the "الكل" item can always
   * resolve the exact category that opened the page.
   */
  const sectionById =
    catalog.sections.find(
      (section) =>
        section.id === rawCategoryKey,
    ) ??
    catalog.categoryTree.find(
      (section) =>
        section.id === rawCategoryKey,
    );

  if (sectionById) {
    return sectionById;
  }

  const normalizedCategoryKey =
    normalizeSlug(rawCategoryKey);

  if (!normalizedCategoryKey) {
    return null;
  }

  return (
    catalog.sections.find(
      (section) =>
        normalizeSlug(section.slug) ===
        normalizedCategoryKey,
    ) ??
    catalog.categoryTree.find(
      (section) =>
        normalizeSlug(section.slug) ===
        normalizedCategoryKey,
    ) ??
    null
  );
}

function findCatalogSectionByRouteParams(
  catalog: StoreCatalog,
  sectionSlug: string,
  categoryKey: string | undefined,
  label: string | undefined,
) {
  const sectionBySlug =
    findCatalogSectionBySlug(
      catalog,
      sectionSlug,
    );

  /*
   * Child-category routes keep the root categoryKey for artwork,
   * so the requested slug must always take priority.
   */
  if (sectionBySlug) {
    return sectionBySlug;
  }

  const sectionByCategoryKey =
    findCatalogSectionByCategoryKey(
      catalog,
      categoryKey,
    );

  if (sectionByCategoryKey) {
    return sectionByCategoryKey;
  }

  const fallbackCategory =
    getPersonalCareCategoryDefinition(
      sectionSlug,
      categoryKey,
      label,
    );

  const requestedValues = [
    sectionSlug,
    categoryKey,
    label,
    fallbackCategory?.key,
    fallbackCategory?.label,
    ...(fallbackCategory?.aliases ?? []),
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  if (requestedValues.length === 0) {
    return null;
  }

  const uniqueSections =
    new Map<string, CatalogSection>();

  for (
    const section of [
      ...catalog.sections,
      ...catalog.categoryTree,
    ]
  ) {
    uniqueSections.set(
      section.id,
      section,
    );
  }

  const sections = Array.from(
    uniqueSections.values(),
  ).sort((first, second) => {
    const firstIsRoot =
      first.parentId === null ||
      first.depth === 0;
    const secondIsRoot =
      second.parentId === null ||
      second.depth === 0;

    return Number(secondIsRoot) -
      Number(firstIsRoot);
  });

  const getSectionValues = (
    section: CatalogSection,
  ) =>
    [
      section.slug,
      section.name,
      section.nameEn,
    ]
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

  const exactSection = sections.find(
    (section) =>
      getSectionValues(section).some(
        (sectionValue) =>
          requestedValues.includes(
            sectionValue,
          ),
      ),
  );

  if (exactSection) {
    return exactSection;
  }

  return (
    sections.find((section) =>
      getSectionValues(section).some(
        (sectionValue) =>
          requestedValues.some(
            (requestedValue) =>
              categoryValuesMatch(
                sectionValue,
                requestedValue,
              ),
          ),
      ),
    ) ?? null
  );
}

function getFallbackCategoryProducts(
  catalog: StoreCatalog,
  category: PersonalCareCategoryDefinition,
) {
  const categoryValues = [
    category.key,
    category.label,
    ...category.aliases,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  const productKeywords =
    category.productKeywords
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

  const products: CatalogProduct[] = [];

  for (const section of catalog.sections) {
    const sectionValues = [
      section.slug,
      section.name,
      section.nameEn,
    ]
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

    const sectionMatches =
      sectionValues.some(
        (sectionValue) =>
          categoryValues.some(
            (categoryValue) =>
              categoryValuesMatch(
                sectionValue,
                categoryValue,
              ),
          ),
      );

    if (sectionMatches) {
      products.push(
        ...getCatalogSectionProducts(
          section,
          true,
        ),
      );
      continue;
    }

    for (const product of section.products) {
      const searchableProductValue =
        normalizeCategoryMatchValue(
          [
            product.name,
            product.nameEn,
            product.description,
            product.descriptionEn,
            product.sku,
            product.unitLabelAr,
            product.unitLabelEn,
          ]
            .filter(Boolean)
            .join(' '),
        );

      if (
        productKeywords.some(
          (keyword) =>
            categoryValuesMatch(
              searchableProductValue,
              keyword,
            ),
        )
      ) {
        products.push(product);
      }
    }
  }

  return deduplicateProducts(products);
}


function resolvePersonalCareCategoryDefinition(
  section: CatalogSection | null,
  fallbackCategory: PersonalCareCategoryDefinition | null,
) {
  if (fallbackCategory) {
    return fallbackCategory;
  }

  if (!section) {
    return null;
  }

  const sectionValues = [
    section.slug,
    section.name,
    section.nameEn,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  return (
    PERSONAL_CARE_CATEGORIES.find(
      (definition) => {
        const acceptedValues = [
          definition.key,
          definition.label,
          ...definition.aliases,
        ]
          .map(normalizeCategoryMatchValue)
          .filter(Boolean);

        return sectionValues.some(
          (sectionValue) =>
            acceptedValues.some(
              (acceptedValue) =>
                categoryValuesMatch(
                  sectionValue,
                  acceptedValue,
                ),
            ),
        );
      },
    ) ?? null
  );
}

function sectionMatchesPersonalCareDefinition(
  section: CatalogSection,
  definition: PersonalCareSubcategoryDefinition,
) {
  const sectionValues = [
    section.slug,
    section.name,
    section.nameEn,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  const acceptedValues = [
    definition.key,
    definition.label,
    ...definition.aliases,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  return sectionValues.some(
    (sectionValue) =>
      acceptedValues.some(
        (acceptedValue) =>
          categoryValuesMatch(
            sectionValue,
            acceptedValue,
          ),
      ),
  );
}

function getConfiguredSubcategoryProducts(
  catalog: StoreCatalog,
  selectedSection: CatalogSection | null,
  definition: PersonalCareSubcategoryDefinition,
) {
  const products: CatalogProduct[] = [];

  const uniqueSections =
    new Map<string, CatalogSection>();

  for (
    const section of [
      ...catalog.sections,
      ...catalog.categoryTree,
    ]
  ) {
    uniqueSections.set(
      section.id,
      section,
    );
  }

  for (
    const section of
    uniqueSections.values()
  ) {
    if (
      sectionMatchesPersonalCareDefinition(
        section,
        definition,
      )
    ) {
      products.push(
        ...getCatalogSectionProducts(
          section,
          true,
        ),
      );
    }
  }

  const normalizedKeywords =
    [
      definition.key,
      definition.label,
      ...definition.aliases,
      ...definition.productKeywords,
    ]
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

  const sourceProducts =
    selectedSection
      ? getCatalogSectionProducts(
          selectedSection,
          true,
        )
      : catalog.sections.flatMap(
          (section) =>
            section.products,
        );

  for (const product of sourceProducts) {
    const searchableProductValue =
      normalizeCategoryMatchValue(
        [
          product.name,
          product.nameEn,
          product.description,
          product.descriptionEn,
          product.sku,
          product.barcode,
          product.unitLabelAr,
          product.unitLabelEn,
        ]
          .filter(Boolean)
          .join(' '),
      );

    if (
      normalizedKeywords.some(
        (keyword) =>
          searchableProductValue.includes(
            keyword,
          ),
      )
    ) {
      products.push(product);
    }
  }

  return deduplicateProducts(
    products,
  );
}

/* ============================================================
 * CATEGORY VISUAL
 * ============================================================
 */

function CategoryFilterVisual({
  section,
  definitionKey,
  categoryKey,
  isRoot = false,
}: {
  section?: CatalogSection | null;
  definitionKey?: string | null;
  categoryKey?: string | null;
  isRoot?: boolean;
}) {
  /*
   * 1) Prefer the exact bundled artwork for the section currently
   *    open on screen.
   *
   * This is especially important for nested pages: if "الكل" is
   * rendered inside a real subcategory such as face-wash, it should
   * keep that subcategory's own image instead of falling back to the
   * parent category artwork.
   */
  const localImageKey =
    normalizeSlug(section?.slug) ||
    normalizeSlug(definitionKey);

  const localSubcategoryImage =
    localImageKey
      ? PERSONAL_CARE_SUBCATEGORY_IMAGES[
          localImageKey
        ]
      : undefined;

  if (localSubcategoryImage) {
    return (
      <Image
        source={localSubcategoryImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  /*
   * 2) For the "الكل" tile on a top-level Personal Care category,
   *    use the exact same image mapping as the landing screen
   *    src/app/category/personal-care.tsx.
   *
   * categoryKey is preferred because the route intentionally carries
   * the UI category key (for example eye-lip-care), while the real
   * Supabase section slug can be a legacy/source slug such as
   * eye-care or lip-care.
   */
  if (isRoot) {
    const rootImageKeys = [
      categoryKey,
      definitionKey,
      section?.slug,
    ]
      .map(normalizeSlug)
      .filter(Boolean);

    for (const imageKey of rootImageKeys) {
      const categoryImage =
        PERSONAL_CARE_CATEGORY_IMAGES[
          imageKey
        ];

      if (categoryImage) {
        return (
          <Image
            source={categoryImage}
            style={
              styles.filterCategoryImage
            }
            resizeMode="cover"
          />
        );
      }
    }
  }

  /*
   * 3) Remote image remains a fallback for any category that is not
   *    represented by a bundled local asset.
   */
  if (section?.imageUrl) {
    return (
      <Image
        source={{
          uri: section.imageUrl,
        }}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  /*
   * 4) Final root fallback only. This should normally never be reached
   *    for the configured Personal Care categories because every one
   *    has a local image in PERSONAL_CARE_CATEGORY_IMAGES.
   */
  if (isRoot) {
    return (
      <Image
        source={PERSONAL_CARE_CATEGORY_IMAGE}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={
        styles.filterImagePlaceholder
      }
    />
  );
}

/* ============================================================
 * PRODUCT CARD
 * ============================================================
 */

type ProductCardProps = {
  product: CatalogProduct;

  cardWidth: number;

  currencyCode: string;

  quantity: number;

  isStoreClosed: boolean;

  mode: ProductCardMode;

  onAdd: () => void;

  onIncrease: () => void;

  onDecrease: () => void;
};

function ProductCard({
  product,
  cardWidth,
  currencyCode,
  quantity,
  isStoreClosed,
  mode,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  const isOffersMode =
    mode === 'offers';

  const hasOldPrice =
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price;

  return (
    <View
      style={[
        styles.productCard,
        isOffersMode &&
          styles.offersProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.productImageBox,
          isOffersMode &&
            styles.offersProductImageBox,
          {
            height: cardWidth,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            style={
              styles.productImage
            }
            resizeMode="cover"
          />
        ) : (
          <Text
            style={
              styles.productFallback
            }
          >
            {product.icon || '🧴'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={[
              styles.discountBadgeBase,

              isOffersMode
                ? styles.offersDiscountBadge
                : styles.categoryDiscountBadge,
            ]}
          >
            <Text
              style={[
                styles.discountText,

                isOffersMode &&
                  styles.offersDiscountText,
              ]}
              numberOfLines={1}
            >
              {isOffersMode
                ? `وفر ${discount}%`
                : `خصم ${discount}%`}
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={isStoreClosed}
            hitSlop={4}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,

              isOffersMode &&
                styles.offersAddButton,

              isStoreClosed &&
                styles.disabledButton,

              pressed &&
                !isStoreClosed &&
                styles.addButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.addButtonText,

                isOffersMode &&
                  styles.offersAddButtonText,
              ]}
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.quantityPill,

              isOffersMode &&
                styles.offersQuantityPill,
            ]}
          >
            <Pressable
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onDecrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.quantityText
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={isStoreClosed}
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onIncrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.productName,

          isOffersMode &&
            styles.offersProductName,
        ]}
        numberOfLines={
          isOffersMode ? 2 : 3
        }
      >
        {product.name}
      </Text>

      {product.unitLabelAr ? (
        <Text
          style={[
            styles.productUnitLabel,

            isOffersMode &&
              styles.offersProductUnitLabel,
          ]}
          numberOfLines={1}
        >
          {product.unitLabelAr}
        </Text>
      ) : null}

      {isOffersMode ? (
        <View
          style={
            styles.offersPriceRow
          }
        >
          <View
            style={
              styles.offersCurrentPriceUnderline
            }
          >
            <Text
              style={
                styles.offersCurrentPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.price,
                currencyCode,
              )}
            </Text>
          </View>

          {hasOldPrice && (
            <Text
              style={
                styles.offersOldPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      ) : (
        <View
          style={
            styles.priceColumn
          }
        >
          <Text
            style={
              styles.currentPrice
            }
          >
            {formatMoney(
              product.price,
              currencyCode,
            )}
          </Text>

          {hasOldPrice && (
            <Text
              style={
                styles.oldPrice
              }
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ============================================================
 * SCREEN
 * ============================================================
 */

export default function PersonalCareCategoryScreen() {
  const router = useRouter();

  const offersTabsScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedOffersTabsRef =
    useRef(false);

  /*
   * Normal category/subcategory rail.
   *
   * Expo Router may keep this screen mounted when navigating
   * between nested categories. Without explicitly resetting the
   * horizontal position, React Native can preserve the previous
   * ScrollView offset and make the next category open in the middle
   * of its subcategories.
   */
  const filtersScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedFiltersRef =
    useRef(false);

  const {
    width: windowWidth,
  } = useWindowDimensions();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const params =
    useLocalSearchParams<{
      slug?:
        | string
        | string[];

      storeId?:
        | string
        | string[];

      categoryKey?:
        | string
        | string[];

      label?:
        | string
        | string[];
    }>();

  const sectionSlug =
    getSingleParam(
      params.slug,
    ) ?? '';

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    );

  const passedCategoryKey =
    getSingleParam(
      params.categoryKey,
    );

  const passedLabel =
    getSingleParam(
      params.label,
    );

  const isOffersPage =
    normalizeSlug(sectionSlug) ===
    'offers';

  const fallbackCategory =
    getPersonalCareCategoryDefinition(
      sectionSlug,
      passedCategoryKey,
      passedLabel,
    );

  /* ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    catalog,
    setCatalog,
  ] =
    useState<StoreCatalog | null>(
      null,
    );

  const [
    selectedSection,
    setSelectedSection,
  ] =
    useState<CatalogSection | null>(
      null,
    );

  const [
    currencyCode,
    setCurrencyCode,
  ] =
    useState('EGP');

  const [
    selectedFilterKey,
    setSelectedFilterKey,
  ] =
    useState<ProductFilterKey>(
      'all',
    );

  const [
    isSearchVisible,
    setIsSearchVisible,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  /* ==========================================================
   * CART
   * ==========================================================
   */

  const carts =
    useCartStore(
      (state) => state.carts,
    );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const increaseStoreItem =
    useCartStore(
      (state) =>
        state.increaseStoreItem,
    );

  const decreaseStoreItem =
    useCartStore(
      (state) =>
        state.decreaseStoreItem,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  /* ==========================================================
   * LOAD
   * ==========================================================
   */

  async function loadCategory() {
    try {
      setIsLoading(true);

      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      const serviceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      let storeId =
        requestedStoreId;

      if (!storeId) {
        const careStores =
          await listStores({
            categorySlug:
              'personal-care',

            serviceAreaId,
          });

        if (
          careStores.length ===
          0
        ) {
          throw new Error(
            'لا يوجد متجر عناية متاح في منطقتك حالياً.',
          );
        }

        const careStore =
          careStores.find(
            (store) =>
              store.isFeatured &&
              !store.isManuallyClosed,
          ) ??
          careStores.find(
            (store) =>
              !store.isManuallyClosed,
          ) ??
          careStores[0];

        storeId =
          careStore.id;
      }

      const loadedCatalog =
        await getStoreCatalog(
          storeId,
          serviceAreaId,
        );

      /*
       * العروض ليست Category حقيقية.
       *
       * هي صفحة Virtual تجمع المنتجات
       * التي عليها compareAtPrice > price
       * من كل أقسام متجر العناية.
       */
      if (isOffersPage) {
        setCatalog(
          loadedCatalog,
        );

        setSelectedSection(
          null,
        );

        setCurrencyCode(
          bootstrap.settings
            .currency_code ||
            'EGP',
        );

        setSelectedFilterKey(
          'all',
        );

        setSearchQuery('');

        return;
      }

      const section =
        findCatalogSectionByRouteParams(
          loadedCatalog,
          sectionSlug,
          passedCategoryKey,
          passedLabel,
        );

      if (
        !section &&
        !fallbackCategory
      ) {
        throw new Error(
          'لم يتم العثور على فئة العناية المطلوبة.',
        );
      }

      setCatalog(
        loadedCatalog,
      );

      setSelectedSection(
        section,
      );

      setCurrencyCode(
        bootstrap.settings
          .currency_code ||
          'EGP',
      );

      setSelectedFilterKey(
        'all',
      );

      setSearchQuery('');
    } catch (error) {
      setCatalog(null);

      setSelectedSection(
        null,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل قسم العناية.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    hasPositionedOffersTabsRef.current =
      false;

    hasPositionedFiltersRef.current =
      false;

    void loadCategory();
  }, [
    requestedStoreId,
    sectionSlug,
    passedCategoryKey,
    passedLabel,
    savedServiceAreaId,
  ]);

  /* ==========================================================
   * NORMAL CATEGORY CHILDREN
   * ==========================================================
   */

  const childCategories =
    useMemo(() => {
      if (!selectedSection) {
        return [];
      }

      return [
        ...selectedSection.children,
      ].sort(
        (
          first,
          second,
        ) => {
          if (
            first.sortOrder !==
            second.sortOrder
          ) {
            return (
              first.sortOrder -
              second.sortOrder
            );
          }

          return first.name.localeCompare(
            second.name,
            'ar',
          );
        },
      );
    }, [selectedSection]);

  /*
   * We render the normal filter rail using a regular row instead of
   * row-reverse. To keep the Arabic visual order:
   *
   * Right edge:
   *   الكل → أول Subcategory → ...
   *
   * the child categories are reversed only for display.
   */
  const activePersonalCareCategory =
    useMemo(
      () =>
        resolvePersonalCareCategoryDefinition(
          selectedSection,
          fallbackCategory,
        ),
      [
        selectedSection,
        fallbackCategory?.key,
      ],
    );

  const categoryFilterItems =
    useMemo<PersonalCareFilterItem[]>(
      () => {
        const items:
          PersonalCareFilterItem[] = [];

        const matchedChildIds =
          new Set<string>();

        for (
          const definition of
          activePersonalCareCategory?.subcategories ?? []
        ) {
          const matchingSection =
            childCategories.find(
              (child) =>
                sectionMatchesPersonalCareDefinition(
                  child,
                  definition,
                ),
            ) ?? null;

          if (matchingSection) {
            matchedChildIds.add(
              matchingSection.id,
            );
          }

          items.push({
            key:
              matchingSection?.id ??
              `virtual:${definition.key}`,
            label:
              matchingSection?.name ??
              definition.label,
            section:
              matchingSection,
            definition,
          });
        }

        for (
          const child of
          childCategories
        ) {
          if (
            matchedChildIds.has(
              child.id,
            )
          ) {
            continue;
          }

          items.push({
            key: child.id,
            label: child.name,
            section: child,
            definition: null,
          });
        }

        return items;
      },
      [
        activePersonalCareCategory,
        childCategories,
      ],
    );

  const categoryFilterItemsForDisplay =
    useMemo(
      () => [
        ...categoryFilterItems,
      ].reverse(),
      [categoryFilterItems],
    );

  /*
   * Reset the normal subcategory rail whenever the actual category
   * changes. This is important because Expo Router can reuse the same
   * screen instance and preserve the old horizontal ScrollView offset.
   *
   * Two animation frames give React Native enough time to lay out the
   * new rail before we move it to its Arabic "start" (the right edge).
   */
  useEffect(() => {
    if (
      isOffersPage ||
      (!selectedSection &&
        !fallbackCategory)
    ) {
      return;
    }

    hasPositionedFiltersRef.current =
      false;

    requestAnimationFrame(
      () => {
        requestAnimationFrame(
          () => {
            filtersScrollRef.current?.scrollToEnd(
              {
                animated:
                  false,
              },
            );

            hasPositionedFiltersRef.current =
              true;
          },
        );
      },
    );
  }, [
    isOffersPage,
    selectedSection?.id,
    fallbackCategory?.key,
  ]);

  /* ==========================================================
   * OFFER PAGE CATEGORY TABS
   * ==========================================================
   */

  const offerCategoryTabs =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      /*
       * بنعرض كل Main Categories في صفحة العروض،
       * حتى لو Category معينة مفيهاش عروض حالياً.
       *
       * قبل كده كان فيه filter بيخفي أي Category
       * مفيهاش منتج compareAtPrice > price.
       */
      return getOfferPageRootCategories(
        catalog,
      );
    }, [catalog]);

  /*
   * Horizontal ScrollView + row-reverse ممكن يخلي العناصر
   * تبدأ خارج الـviewport على بعض الأجهزة.
   *
   * لذلك نعرض Row عادي، نعكس الـCategories بصرياً،
   * ونضع "الكل" في أقصى اليمين.
   */
  const offerCategoryTabsForDisplay =
    useMemo(
      () => [
        ...offerCategoryTabs,
      ].reverse(),
      [offerCategoryTabs],
    );

  /* ==========================================================
   * PRODUCTS
   * ==========================================================
   */

  const filteredProducts =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      let products:
        CatalogProduct[] = [];

      /*
       * =====================================
       * OFFERS PAGE
       * =====================================
       */
      if (isOffersPage) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getAllCatalogOffers(
              catalog,
            );
        } else {
          const selectedOfferCategory =
            offerCategoryTabs.find(
              (category) =>
                category.id ===
                selectedFilterKey,
            );

          if (
            selectedOfferCategory
          ) {
            products =
              getCatalogSectionOffers(
                selectedOfferCategory,
              );
          }
        }
      }

      /*
       * =====================================
       * NORMAL CATEGORY PAGE
       * =====================================
       */
      else if (selectedSection) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getCatalogSectionProducts(
              selectedSection,
              true,
            );
        } else {
          const selectedItem =
            categoryFilterItems.find(
              (item) =>
                item.key ===
                selectedFilterKey,
            );

          if (selectedItem?.section) {
            products =
              getCatalogSectionProducts(
                selectedItem.section,
                true,
              );
          } else if (
            selectedItem?.definition
          ) {
            products =
              getConfiguredSubcategoryProducts(
                catalog,
                selectedSection,
                selectedItem.definition,
              );
          }
        }
      }

      /*
       * A newly added UI category can be opened before its root
       * CatalogSection is created. In that case, collect matching
       * products from the existing catalog instead of failing the
       * whole route.
       */
      else if (fallbackCategory) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getFallbackCategoryProducts(
              catalog,
              fallbackCategory,
            );
        } else {
          const selectedItem =
            categoryFilterItems.find(
              (item) =>
                item.key ===
                selectedFilterKey,
            );

          if (
            selectedItem?.definition
          ) {
            products =
              getConfiguredSubcategoryProducts(
                catalog,
                null,
                selectedItem.definition,
              );
          }
        }
      }

      /*
       * Search.
       */
      const normalizedQuery =
        normalizeSearchText(
          searchQuery,
        );

      if (normalizedQuery) {
        products =
          products.filter(
            (product) => {
              const searchableText =
                [
                  product.name,
                  product.nameEn,
                  product.description,
                  product.descriptionEn,
                  product.sku,
                  product.barcode,
                  product.unitLabelAr,
                  product.unitLabelEn,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();

              return searchableText.includes(
                normalizedQuery,
              );
            },
          );
      }

      /*
       * Safety:
       *
       * صفحة العروض مستحيل تعرض
       * منتج بدون خصم.
       */
      if (isOffersPage) {
        products =
          products.filter(
            isOfferProduct,
          );
      }

      return deduplicateProducts(
        products,
      );
    }, [
      catalog,
      isOffersPage,
      selectedFilterKey,
      searchQuery,
      selectedSection,
      categoryFilterItems,
      offerCategoryTabs,
      fallbackCategory?.key,
    ]);

  /* ==========================================================
   * LOADING
   * ==========================================================
   */

  if (isLoading) {
    return (
      <ProductGridScreenSkeleton />
    );
  }

  /* ==========================================================
   * ERROR
   * ==========================================================
   */

  if (
    !catalog ||
    errorMessage ||
    (!isOffersPage &&
      !selectedSection &&
      !fallbackCategory)
  ) {
    return (
      <SafeAreaView
        style={styles.stateScreen}
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.stateEmoji
          }
        >
          🧴
        </Text>

        <Text
          style={
            styles.stateTitle
          }
        >
          قسم العناية غير متاح
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل قسم العناية.'}
        </Text>

        <Pressable
          style={
            styles.retryButton
          }
          onPress={() => {
            void loadCategory();
          }}
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.backErrorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backErrorButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /* ==========================================================
   * STORE
   * ==========================================================
   */

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const isStoreClosed =
    currentStore.isManuallyClosed;

  const currentCart =
    carts[currentStore.id] ??
    null;

  const cartItems =
    currentCart?.items ??
    [];

  const currentStoreSubtotal =
    cartItems.reduce(
      (total, item) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  const minimumOrder =
    delivery.minimumOrder;

  const amountRemaining =
    Math.max(
      minimumOrder -
        currentStoreSubtotal,
      0,
    );

  const orderProgress =
    minimumOrder <= 0
      ? currentStoreItemCount >
        0
        ? 1
        : 0
      : Math.min(
          currentStoreSubtotal /
            minimumOrder,
          1,
        );

  /* ==========================================================
   * LAYOUT
   * ==========================================================
   */

  const pageWidth =
    Math.min(
      windowWidth,
      PAGE_MAX_WIDTH,
    );

  const productCardWidth =
    (pageWidth -
      HORIZONTAL_PADDING * 2 -
      PRODUCT_GAP) /
    2;

  /*
   * Navigation can keep the original categoryKey so nested routes
   * continue to resolve correctly. The "الكل" tile, however, must
   * use the exact section currently open on screen, not the parent
   * category that originally opened the flow.
   */
  const categoryKey =
    passedCategoryKey ??
    selectedSection?.id ??
    selectedSection?.slug ??
    '';

  const pageTitle =
    isOffersPage
      ? 'العروض'
      : selectedSection?.name ||
        fallbackCategory?.label ||
        passedLabel ||
        '';

  const shouldShowNormalCartDock =
    !isOffersPage &&
    currentStoreItemCount > 0;

  /* ==========================================================
   * NORMAL CATEGORY NAVIGATION
   * ==========================================================
   */

  function openChildCategory(
    item: PersonalCareFilterItem,
  ) {
    const child =
      item.section;

    if (
      child &&
      child.children.length > 0
    ) {
      router.push({
        pathname:
          '/personal-care-category/[slug]',

        params: {
          slug:
            child.slug,

          storeId:
            currentStore.id,

          categoryKey:
            categoryKey,

          label:
            child.name,
        },
      });

      return;
    }

    setSelectedFilterKey(
      item.key,
    );

    setSearchQuery('');
  }

  /* ==========================================================
   * CART
   * ==========================================================
   */

  function addProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    addItem(
      {
        id:
          currentStore.id,

        name:
          currentStore.name,

        icon:
          currentStore.icon,

        categorySlug:
          currentStore.categorySlug,

        deliveryFee:
          delivery.deliveryFee,

        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id:
          product.id,

        name:
          product.name,

        description:
          product.description,

        price:
          product.price,

        icon:
          product.icon,

        variantId:
          null,

        variantName:
          null,

      },
    );
  }

  function increaseProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const itemExists =
      cartItems.some(
        (item) =>
          item.id ===
            product.id &&
          item.variantId ===
            null,
      );

    if (itemExists) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );

      return;
    }

    addProduct(
      product,
    );
  }

  function decreaseProduct(
    productId: string,
  ) {
    decreaseStoreItem(
      currentStore.id,
      productId,
      null,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
            productId &&
          item.variantId ===
            null,
      )?.quantity ?? 0
    );
  }

  function openCart() {
    if (
      currentStoreItemCount <= 0
    ) {
      return;
    }

    setActiveCart(
      currentStore.id,
    );

    router.push({
      pathname:
        '/cart',

      params: {
        storeId:
          currentStore.id,
      },
    });
  }

  function getCartMessage() {
    if (
      minimumOrder <= 0 ||
      amountRemaining <= 0
    ) {
      return 'الطلب جاهز للإكمال';
    }

    return `أضف ${formatMoney(
      amountRemaining,
      currencyCode,
    )} لإتمام الحد الأدنى للطلب`;
  }

  function getEmptyMessage() {
    if (
      searchQuery.trim()
    ) {
      return 'لم نجد منتجاً مطابقاً لبحثك.';
    }

    if (isOffersPage) {
      if (
        selectedFilterKey !==
        'all'
      ) {
        return 'لا توجد عروض متاحة حالياً داخل هذه الفئة.';
      }

      return 'لا توجد عروض متاحة حالياً.';
    }

    if (
      selectedFilterKey !==
      'all'
    ) {
      return 'لا توجد منتجات متاحة داخل هذا القسم حالياً.';
    }

    return 'لا توجد منتجات متاحة داخل هذه الفئة حالياً.';
  }

  /* ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <SafeAreaView
      style={styles.screen}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        {/* =====================================================
         * HEADER
         * =====================================================
         */}

        <View
          style={
            styles.header
          }
        >
          {isSearchVisible ? (
            <View
              style={
                styles.searchInputContainer
              }
            >
              <Ionicons
                name="search-outline"
                size={18}
                color="#222222"
              />

              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={
                  setSearchQuery
                }
                placeholder={
                  isOffersPage
                    ? 'ابحث في العروض'
                    : 'ابحث في الفئة'
                }
                placeholderTextColor="#999999"
                style={
                  styles.searchInput
                }
                textAlign="right"
              />

              <Pressable
                hitSlop={12}
                onPress={() => {
                  setSearchQuery('');

                  setIsSearchVisible(
                    false,
                  );
                }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="#222222"
                />
              </Pressable>
            </View>
          ) : (
            <>
              {/* Back button stays on the LEFT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() =>
                  router.back()
                }
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color="#202020"
                />
              </Pressable>

              <View
                style={
                  styles.headerTitleGroup
                }
              >
                <Text
                  style={
                    styles.headerTitle
                  }
                  numberOfLines={1}
                >
                  {pageTitle}
                </Text>
              </View>

              {/* Search button stays on the RIGHT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() => {
                  setIsSearchVisible(
                    true,
                  );
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={21}
                  color="#202020"
                />
              </Pressable>
            </>
          )}
        </View>

        {/* =====================================================
         * OFFERS CATEGORY TABS
         * =====================================================
         */}

        {isOffersPage && (
          <View
            style={
              styles.offersTabsContainer
            }
          >
            <ScrollView
              ref={
                offersTabsScrollRef
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              directionalLockEnabled
              contentContainerStyle={
                styles.offersTabsRail
              }
              style={
                styles.offersTabsScroll
              }
              onContentSizeChange={() => {
                if (
                  hasPositionedOffersTabsRef.current
                ) {
                  return;
                }

                hasPositionedOffersTabsRef.current =
                  true;

                requestAnimationFrame(
                  () => {
                    offersTabsScrollRef.current?.scrollToEnd(
                      {
                        animated:
                          false,
                      },
                    );
                  },
                );
              }}
            >
              {offerCategoryTabsForDisplay.map(
                (category) => {
                  const isSelected =
                    selectedFilterKey ===
                    category.id;

                  return (
                    <Pressable
                      key={
                        category.id
                      }
                      style={
                        styles.offersTab
                      }
                      onPress={() => {
                        setSelectedFilterKey(
                          category.id,
                        );

                        setSearchQuery(
                          '',
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.offersTabText,

                          isSelected &&
                            styles.offersTabTextSelected,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          category.name
                        }
                      </Text>

                      {isSelected && (
                        <View
                          style={
                            styles.offersTabUnderline
                          }
                        />
                      )}
                    </Pressable>
                  );
                },
              )}

              <Pressable
                style={
                  styles.offersTab
                }
                onPress={() => {
                  setSelectedFilterKey(
                    'all',
                  );

                  setSearchQuery('');
                }}
              >
                <Text
                  style={[
                    styles.offersTabText,

                    selectedFilterKey ===
                      'all' &&
                      styles.offersTabTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  الكل
                </Text>

                {selectedFilterKey ===
                  'all' && (
                  <View
                    style={
                      styles.offersTabUnderline
                    }
                  />
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* =====================================================
         * CONTENT
         * =====================================================
         */}

        <ScrollView
          style={
            styles.scrollView
          }
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingBottom:
                shouldShowNormalCartDock
                  ? 145
                  : 30,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* ===================================================
           * NORMAL CATEGORY FILTERS
           * ===================================================
           */}

          {!isOffersPage &&
            (selectedSection ||
              fallbackCategory) && (
            <>
              <ScrollView
                ref={
                  filtersScrollRef
                }
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                directionalLockEnabled
                contentContainerStyle={
                  styles.filtersRail
                }
                style={
                  styles.filtersScroll
                }
                onContentSizeChange={() => {
                  /*
                   * When the route changes to another category,
                   * React Native can retain the old x offset.
                   * Position once after the new content is measured.
                   */
                  if (
                    hasPositionedFiltersRef.current
                  ) {
                    return;
                  }

                  requestAnimationFrame(
                    () => {
                      filtersScrollRef.current?.scrollToEnd(
                        {
                          animated:
                            false,
                        },
                      );

                      hasPositionedFiltersRef.current =
                        true;
                    },
                  );
                }}
              >
                {/* CHILD CATEGORIES
                 *
                 * Reversed only for display because this ScrollView
                 * uses a normal row. The visible Arabic order starts:
                 * الكل → أول Subcategory → ثاني Subcategory → ...
                 */}

                {categoryFilterItemsForDisplay.map(
                  (item) => {
                    const isSelected =
                      selectedFilterKey ===
                      item.key;

                    return (
                      <Pressable
                        key={
                          item.key
                        }
                        style={
                          styles.filterItem
                        }
                        onPress={() =>
                          openChildCategory(
                            item,
                          )
                        }
                      >
                        <View
                          style={[
                            styles.filterImageCircle,

                            isSelected &&
                              styles.filterImageCircleSelected,
                          ]}
                        >
                          <CategoryFilterVisual
                            section={
                              item.section
                            }
                            definitionKey={
                              item.definition?.key
                            }
                          />

                          {item.section &&
                            item.section.children.length >
                            0 && (
                            <View
                              style={
                                styles.hasChildrenBadge
                              }
                            >
                              <Ionicons
                                name="chevron-forward"
                                size={
                                  10
                                }
                                color="#FFFFFF"
                              />
                            </View>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.filterLabel,

                            isSelected &&
                              styles.filterLabelSelected,
                          ]}
                          numberOfLines={
                            2
                          }
                        >
                          {
                            item.label
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}


                {/* ALL — rightmost / selected by default */}

                <Pressable
                  style={
                    styles.filterItem
                  }
                  onPress={() => {
                    setSelectedFilterKey(
                      'all',
                    );

                    setSearchQuery(
                      '',
                    );
                  }}
                >
                  <View
                    style={[
                      styles.filterImageCircle,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterImageCircleSelected,
                    ]}
                  >
                    <CategoryFilterVisual
                      section={
                        selectedSection
                      }
                      definitionKey={
                        fallbackCategory?.key
                      }
                      categoryKey={
                        passedCategoryKey ??
                        fallbackCategory?.key ??
                        selectedSection?.slug
                      }
                      isRoot
                    />
                  </View>

                  <Text
                    style={[
                      styles.filterLabel,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    الكل
                  </Text>
                </Pressable>
              </ScrollView>

              <View
                style={
                  styles.sectionDivider
                }
              />
            </>
          )}

          {/* ===================================================
           * CLOSED
           * ===================================================
           */}

          {isStoreClosed && (
            <View
              style={
                styles.closedBox
              }
            >
              <Text
                style={
                  styles.closedText
                }
              >
                {currentStore.manualClosedNote ??
                  'متجر العناية مغلق حالياً'}
              </Text>
            </View>
          )}

          {/* ===================================================
           * NORMAL PAGE RESULTS COUNT
           * ===================================================
           */}

          {!isOffersPage &&
            filteredProducts.length >
              0 && (
              <View
                style={
                  styles.productsHeader
                }
              >
                <Text
                  style={
                    styles.productsCount
                  }
                >
                  {
                    filteredProducts.length
                  }{' '}
                  منتج
                </Text>
              </View>
            )}

          {/* ===================================================
           * PRODUCTS
           * ===================================================
           */}

          {filteredProducts.length >
          0 ? (
            <View
              style={[
                styles.productsGrid,

                isOffersPage &&
                  styles.offersProductsGrid,
              ]}
            >
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    cardWidth={
                      productCardWidth
                    }
                    currencyCode={
                      currencyCode
                    }
                    quantity={getProductQuantity(
                      product.id,
                    )}
                    isStoreClosed={
                      isStoreClosed
                    }
                    mode={
                      isOffersPage
                        ? 'offers'
                        : 'category'
                    }
                    onAdd={() =>
                      addProduct(
                        product,
                      )
                    }
                    onIncrease={() =>
                      increaseProduct(
                        product,
                      )
                    }
                    onDecrease={() =>
                      decreaseProduct(
                        product.id,
                      )
                    }
                  />
                ),
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyStateEmoji
                }
              >
                🛍️
              </Text>

              <Text
                style={
                  styles.emptyStateTitle
                }
              >
                لا توجد منتجات
              </Text>

              <Text
                style={
                  styles.emptyStateDescription
                }
              >
                {getEmptyMessage()}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* =====================================================
         * NORMAL CATEGORY CART
         * =====================================================
         */}

        {shouldShowNormalCartDock && (
          <View
            style={
              styles.cartDock
            }
          >
            <Text
              style={
                styles.cartMessage
              }
              numberOfLines={1}
            >
              {getCartMessage()}
            </Text>

            <View
              style={
                styles.progressTrack
              }
            >
              <View
                style={[
                  styles.progressValue,

                  {
                    width: `${
                      orderProgress *
                      100
                    }%`,
                  },
                ]}
              />
            </View>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.basketButton,

                pressed &&
                  styles.basketButtonPressed,
              ]}
              onPress={
                openCart
              }
            >
              <Text
                style={
                  styles.basketTotal
                }
              >
                {formatMoney(
                  currentStoreSubtotal,
                  currencyCode,
                )}
              </Text>

              <Text
                style={
                  styles.basketButtonTitle
                }
              >
                عرض السلة
              </Text>

              <View
                style={
                  styles.basketCount
                }
              >
                <Text
                  style={
                    styles.basketCountText
                  }
                >
                  {
                    currentStoreItemCount
                  }
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
 * STYLES
 * ============================================================
 */

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        '#FFFFFF',

      flex: 1,
    },

    pageShell: {
      alignSelf:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      maxWidth:
        PAGE_MAX_WIDTH,

      position:
        'relative',

      width: '100%',
    },

    /* ========================================================
     * HEADER
     * ========================================================
     */

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      minHeight: 68,

      paddingHorizontal:
        18,

      paddingVertical:
        10,
    },

    headerCircleButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 24,

      borderWidth: 1,

      height: 48,

      justifyContent:
        'center',

      width: 48,
    },

    headerTitleGroup: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        12,
    },

    headerTitle: {
      color:
        '#171717',

      flexShrink: 1,

      fontSize: 20,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    pressed: {
      backgroundColor:
        '#F6F6F6',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    /* ========================================================
     * SEARCH
     * ========================================================
     */

    searchInputContainer: {
      alignItems:
        'center',

      backgroundColor:
        '#F6F6F6',

      borderColor:
        '#EAEAEA',

      borderRadius: 23,

      borderWidth: 1,

      flex: 1,

      flexDirection:
        'row',

      gap: 7,

      minHeight: 46,

      paddingHorizontal:
        16,
    },

    searchInput: {
      color:
        '#202020',

      flex: 1,

      fontSize: 14,

      minHeight: 44,

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * OFFERS TEXT TABS
     * ========================================================
     */

    offersTabsContainer: {
      backgroundColor:
        '#FFFFFF',

      borderBottomColor:
        '#E8E8E8',

      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    offersTabsScroll: {
      flexGrow: 0,
    },

    offersTabsRail: {
      alignItems:
        'stretch',

      flexDirection:
        'row',

      flexGrow: 1,

      gap: 22,

      justifyContent:
        'flex-end',

      paddingHorizontal:
        18,
    },

    offersTab: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight: 50,

      paddingHorizontal:
        1,

      position:
        'relative',
    },

    offersTabText: {
      color:
        '#777777',

      fontSize: 14,

      fontWeight:
        '400',

      lineHeight: 19,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    offersTabTextSelected: {
      color:
        '#171717',

      fontWeight:
        '700',
    },

    offersTabUnderline: {
      backgroundColor:
        '#202020',

      bottom: 0,

      height: 2,

      left: 0,

      position:
        'absolute',

      right: 0,
    },

    /* ========================================================
     * SCROLL
     * ========================================================
     */

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      backgroundColor:
        '#FFFFFF',
    },

    /* ========================================================
     * NORMAL CATEGORY FILTERS
     * ========================================================
     */

    filtersScroll: {
      flexGrow: 0,
    },

    filtersRail: {
      /*
       * Avoid row-reverse here. On horizontal ScrollViews it can
       * produce inconsistent initial offsets between iOS/Android and
       * when Expo Router reuses the screen.
       *
       * Items are explicitly arranged in the JSX and we scroll to the
       * right edge when a category opens.
       */
      flexDirection:
        'row',

      flexGrow: 1,

      gap: 17,

      justifyContent:
        'flex-end',

      paddingBottom:
        17,

      paddingHorizontal:
        18,

      paddingTop: 7,
    },

    filterItem: {
      alignItems:
        'center',

      width: 79,
    },

    filterImageCircle: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        'transparent',

      borderRadius: 39,

      borderWidth: 2.4,

      height: 78,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',

      width: 78,
    },

    filterImageCircleSelected: {
      borderColor:
        '#202020',
    },

    filterCategoryImage: {
      height: '100%',

      width: '100%',
    },

    filterImagePlaceholder: {
      backgroundColor:
        '#F3F3F3',

      height: '100%',

      width: '100%',
    },

    filterLabel: {
      color:
        '#666666',

      fontSize: 12.5,

      lineHeight: 17,

      marginTop: 6,

      minHeight: 34,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    filterLabelSelected: {
      color:
        '#1D1D1D',

      fontWeight:
        '700',
    },

    hasChildrenBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#202020',

      borderColor:
        '#FFFFFF',

      borderRadius: 9,

      borderWidth: 2,

      bottom: 1,

      height: 18,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 0,

      width: 18,
    },

    sectionDivider: {
      backgroundColor:
        '#F0F0F0',

      elevation: 2,

      height: 7,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.04,

      shadowRadius: 3,
    },

    /* ========================================================
     * CLOSED
     * ========================================================
     */

    closedBox: {
      backgroundColor:
        '#222222',

      borderRadius: 8,

      marginHorizontal:
        16,

      marginTop: 14,

      paddingHorizontal:
        14,

      paddingVertical:
        10,
    },

    closedText: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '600',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCTS HEADER
     * ========================================================
     */

    productsHeader: {
      alignItems:
        'flex-end',

      paddingHorizontal:
        16,

      paddingTop: 15,
    },

    productsCount: {
      color:
        '#8A8A8A',

      fontSize: 12,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCT GRID
     * ========================================================
     */

    productsGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        PRODUCT_GAP,

      paddingHorizontal:
        HORIZONTAL_PADDING,

      paddingTop: 11,
    },

    /*
     * أول Product في صفحة العروض
     * يظهر يمين الشاشة مثل الصورة.
     */
    offersProductsGrid: {
      flexDirection:
        'row-reverse',

      paddingTop: 12,
    },

    productCard: {
      backgroundColor:
        '#FFFFFF',

      marginBottom: 16,
    },

    offersProductCard: {
      marginBottom: 13,
    },

    productImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 20,

      borderWidth: 1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',

      width: '100%',
    },

    offersProductImageBox: {
      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#DEDEDE',

      borderRadius: 20,
    },

    productImage: {
      height: '100%',

      width: '100%',
    },

    productFallback: {
      fontSize: 44,
    },

    /* ========================================================
     * DISCOUNT BADGES
     * ========================================================
     */

    discountBadgeBase: {
      alignItems:
        'center',

      borderRadius: 4,

      justifyContent:
        'center',

      minHeight: 22,

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      position:
        'absolute',

      top: 7,

      zIndex: 5,
    },

    categoryDiscountBadge: {
      backgroundColor:
        '#FFF1B7',

      left: 8,
    },

    offersDiscountBadge: {
      backgroundColor:
        '#C7FF00',

      right: 8,
    },

    discountText: {
      color:
        '#8B6813',

      fontSize: 10,

      fontWeight:
        '700',

      lineHeight: 13,
    },

    offersDiscountText: {
      color:
        '#181818',

      fontSize: 11,

      fontWeight:
        '700',
    },

    /* ========================================================
     * ADD BUTTON
     * ========================================================
     */

    addButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      height: 42,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 42,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      width: 50,

      zIndex: 7,
    },

    offersAddButton: {
      borderRadius: 20,

      bottom: 8,

      height: 40,

      right: 8,

      width: 40,
    },

    addButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale: 0.95,
        },
      ],
    },

    disabledButton: {
      opacity: 0.45,
    },

    addButtonText: {
      color:
        NAVIENTY_NOW_GREEN,

      fontSize: 31,

      fontWeight:
        '300',

      lineHeight: 33,

      marginTop: -3,
    },

    offersAddButtonText: {
      fontSize: 29,

      lineHeight: 31,
    },

    /* ========================================================
     * QUANTITY
     * ========================================================
     */

    quantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      flexDirection:
        'row',

      height: 42,

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      zIndex: 7,
    },

    offersQuantityPill: {
      borderRadius: 20,

      height: 40,
    },

    quantityAction: {
      alignItems:
        'center',

      height: 40,

      justifyContent:
        'center',

      width: 28,
    },

    quantityActionText: {
      color:
        NAVIENTY_NOW_GREEN,

      fontSize: 19,

      fontWeight:
        '500',
    },

    quantityText: {
      color:
        '#202020',

      fontSize: 12,

      fontWeight:
        '700',

      minWidth: 16,

      textAlign:
        'center',
    },

    /* ========================================================
     * PRODUCT TEXT
     * ========================================================
     */

    productName: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '500',

      lineHeight: 19,

      marginTop: 8,

      minHeight: 38,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductName: {
      fontSize: 13.5,

      fontWeight:
        '500',

      lineHeight: 18,

      marginTop: 8,

      minHeight: 36,
    },

    productUnitLabel: {
      color:
        '#999999',

      fontSize: 11.5,

      marginTop: 2,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductUnitLabel: {
      color:
        '#969696',

      fontSize: 11.5,

      minHeight: 15,
    },

    /* ========================================================
     * NORMAL PRICE
     * ========================================================
     */

    priceColumn: {
      alignItems:
        'flex-end',

      marginTop: 7,
    },

    currentPrice: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'right',
    },

    oldPrice: {
      color:
        '#969696',

      fontSize: 11.5,

      marginTop: 3,

      textDecorationLine:
        'line-through',
    },

    /* ========================================================
     * OFFERS PRICE — SAME LOOK AS SCREENSHOT
     * ========================================================
     */

    offersPriceRow: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',

      flexWrap:
        'wrap',

      gap: 5,

      justifyContent:
        'flex-start',

      marginTop: 6,

      minHeight: 20,
    },

    offersCurrentPriceUnderline: {
      borderBottomColor:
        '#C7FF00',

      borderBottomWidth: 2,

      paddingBottom: 0,
    },

    offersCurrentPrice: {
      color:
        '#181818',

      fontSize: 14,

      fontWeight:
        '700',

      lineHeight: 18,

      writingDirection:
        'rtl',
    },

    offersOldPrice: {
      color:
        '#8D8D8D',

      fontSize: 11.5,

      fontWeight:
        '400',

      lineHeight: 18,

      textDecorationLine:
        'line-through',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * EMPTY
     * ========================================================
     */

    emptyState: {
      alignItems:
        'center',

      paddingHorizontal:
        30,

      paddingTop: 70,
    },

    emptyStateEmoji: {
      fontSize: 40,
    },

    emptyStateTitle: {
      color:
        '#202020',

      fontSize: 17,

      fontWeight:
        '700',

      marginTop: 15,
    },

    emptyStateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 7,

      maxWidth: 300,

      textAlign:
        'center',
    },

    /* ========================================================
     * NORMAL CART DOCK
     * ========================================================
     */

    cartDock: {
      backgroundColor:
        '#FFFFFF',

      borderTopColor:
        '#EEEEEE',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      bottom: 0,

      elevation: 12,

      left: 0,

      paddingBottom: 12,

      paddingHorizontal:
        16,

      paddingTop: 11,

      position:
        'absolute',

      right: 0,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: -2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 8,
    },

    cartMessage: {
      color:
        '#242424',

      fontSize: 12.5,

      fontWeight:
        '500',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    progressTrack: {
      backgroundColor:
        '#E7E7E7',

      borderRadius: 4,

      height: 4,

      marginTop: 10,

      overflow:
        'hidden',
    },

    progressValue: {
      backgroundColor:
        '#202020',

      borderRadius: 4,

      height: 4,
    },

    basketButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_GREEN,

      borderRadius: 28,

      flexDirection:
        'row',

      height: 56,

      justifyContent:
        'space-between',

      marginTop: 11,

      paddingHorizontal:
        18,
    },

    basketButtonPressed: {
      opacity: 0.9,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    basketTotal: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      minWidth: 78,
    },

    basketButtonTitle: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '700',
    },

    basketCount: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_GREEN_DARK,

      borderRadius: 21,

      height: 42,

      justifyContent:
        'center',

      width: 42,
    },

    basketCountText: {
      color:
        '#FFFFFF',

      fontSize: 15,

      fontWeight:
        '700',
    },

    /* ========================================================
     * STATE
     * ========================================================
     */

    stateScreen: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    stateEmoji: {
      fontSize: 40,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 18,

      fontWeight:
        '800',

      marginTop: 14,

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 8,

      maxWidth: 330,

      textAlign:
        'center',
    },

    retryButton: {
      backgroundColor:
        '#222222',

      borderRadius: 14,

      marginTop: 20,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        13,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    backErrorButton: {
      borderColor:
        '#E0E0E0',

      borderRadius: 14,

      borderWidth: 1,

      marginTop: 10,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    backErrorButtonText: {
      color:
        '#222222',

      fontSize: 13,

      fontWeight:
        '600',

      textAlign:
        'center',
    },
  });
