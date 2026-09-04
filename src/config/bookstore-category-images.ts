import type { ImageSourcePropType } from 'react-native';
/**
 * Bundled local artwork for bookstore categories/subcategories.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Expo/Metro bundles static `require(...)` images with the app, so they render
 * immediately without waiting for a network request.
 *
 * HOW TO ADD AN IMAGE
 * -------------------
 * 1. Put the PNG/WebP file in:
 *    src/assets/images/bookstore-categories/
 *
 * 2. Keep the file name exactly equal to the category slug.
 *
 * 3. Replace `null` below with a static require, for example:
 *
 *    'writing-tools': require(
 *      '../assets/images/bookstore-categories/writing-tools.webp'
 *    ),
 *
 * IMPORTANT
 * ---------
 * Do NOT write require(`../.../${slug}.png`) because Metro requires static paths.
 * Leaving an entry as `null` is safe; the UI will use the fallback emoji.
 */
export const BOOKSTORE_CATEGORY_IMAGES: Record<
  string,
  ImageSourcePropType | null
> = {
  // أقلام وأدوات الكتابة
  'writing-tools': null,
  'writing-tools-ballpoint-pens': null, // أقلام جاف
  'writing-tools-pencils': null, // أقلام رصاص
  'writing-tools-gel-pens': null, // أقلام Gel
  'writing-tools-fineliners': null, // Fineliners
  'writing-tools-ink-pens': null, // أقلام حبر
  'writing-tools-mechanical-pencils': null, // أقلام ميكانيكال
  'writing-tools-pencil-leads': null, // سنون أقلام
  'writing-tools-highlighters': null, // Highlighters
  'writing-tools-markers': null, // Markers
  'writing-tools-permanent-markers': null, // Permanent Markers

  // كراسات ونوت بوك
  'notebooks': null,
  'notebooks-spiral-notebooks': null, // كراسات سلك
  'notebooks-regular-notebooks': null, // كراسات عادية
  'notebooks-notebooks': null, // Notebooks
  'notebooks-notepads': null, // Notepads
  'notebooks-subject-notebooks': null, // Subject Notebooks
  'notebooks-a4-notebooks': null, // دفاتر A4
  'notebooks-a5-notebooks': null, // دفاتر A5
  'notebooks-sketch-books': null, // Sketch Books
  'notebooks-planners': null, // أجندات

  // ورق ومستلزمات الطباعة
  'printing-paper': null,
  'printing-paper-a4-paper': null, // ورق A4
  'printing-paper-a3-paper': null, // ورق A3
  'printing-paper-lined-paper': null, // ورق مسطر
  'printing-paper-graph-paper': null, // ورق مربعات
  'printing-paper-colored-paper': null, // ورق ملون
  'printing-paper-cardstock': null, // Cardstock
  'printing-paper-photo-paper': null, // ورق Photo
  'printing-paper-sticker-paper': null, // ورق Sticker
  'printing-paper-drawing-paper': null, // ورق رسم

  // ملفات وتنظيم الأوراق

  // مستلزمات المذاكرة

  // مساطر وأدوات هندسية
  'geometry-tools': null,
  'geometry-tools-rulers': null, // مساطر
  'geometry-tools-set-squares': null, // مثلثات
  'geometry-tools-protractors': null, // منقلة
  'geometry-tools-compasses': null, // برجل
  'geometry-tools-t-squares': null, // T-Square
  'geometry-tools-scale-rulers': null, // Scale Ruler
  'geometry-tools-french-curves': null, // French Curves
  'geometry-tools-templates': null, // Templates
  'geometry-tools-cutting-mats': null, // Cutting Mat

  // رسم وفنون
  'art-supplies': null,
  'art-supplies-colored-pencils': null, // ألوان خشب
  'art-supplies-felt-tip-pens': null, // ألوان فلوماستر
  'art-supplies-watercolors': null, // ألوان مائية
  'art-supplies-acrylic-colors': null, // Acrylic
  'art-supplies-oil-colors': null, // Oil Colors
  'art-supplies-brushes': null, // Brushes
  'art-supplies-canvas': null, // Canvas
  'art-supplies-sketch-pads': null, // Sketch Pads
  'art-supplies-charcoal': null, // Charcoal
  'art-supplies-pastels': null, // Pastels
  'art-supplies-palettes': null, // Palettes

  // هندسة وعمارة
  'engineering-architecture': null,
  'engineering-architecture-technical-pens': null, // Technical Pens
  'engineering-architecture-mechanical-pencils': null, // Mechanical Pencils
  'engineering-architecture-scale-rulers': null, // Scale Rulers
  'engineering-architecture-drafting-tools': null, // Drafting Tools
  'engineering-architecture-tracing-paper': null, // Tracing Paper
  'engineering-architecture-graph-paper': null, // Graph Paper
  'engineering-architecture-cutting-tools': null, // Cutting Tools
  'engineering-architecture-architecture-sheets': null, // Architecture Sheets

  // قص ولصق وتثبيت





  // مقالم وشنط
  'pencil-cases-bags': null,
  'pencil-cases-bags-pen-pouches': null, // مقالم
  'pencil-cases-bags-pencil-cases': null, // Pencil Cases
  'pencil-cases-bags-laptop-bags': null, // Laptop Bags
  'pencil-cases-bags-backpacks': null, // Backpacks
  'pencil-cases-bags-document-bags': null, // Document Bags
  'pencil-cases-bags-drawing-tubes': null, // Drawing Tubes

  // طباعة وتصوير وتجليد
  'printing-copying-binding': null,
  'printing-copying-binding-black-white-printing': null, // طباعة أبيض وأسود
  'printing-copying-binding-color-printing': null, // طباعة ألوان
  'printing-copying-binding-photocopying': null, // تصوير
  'printing-copying-binding-scanning': null, // Scan
  'printing-copying-binding-spiral-binding': null, // تجليد سلك
  'printing-copying-binding-thermal-binding': null, // تجليد حراري
  'printing-copying-binding-laminating': null, // Laminating
  'printing-copying-binding-project-printing': null, // طباعة Projects

  // إكسسوارات الدراسة الإلكترونية
  'electronic-study-accessories': null,
  'electronic-study-accessories-flash-drives': null, // Flash Drives
  'electronic-study-accessories-mouse': null, // Mouse
  'electronic-study-accessories-mouse-pads': null, // Mouse Pads
  'electronic-study-accessories-keyboards': null, // Keyboards
  'electronic-study-accessories-usb-hubs': null, // USB Hubs
  'electronic-study-accessories-laptop-stands': null, // Laptop Stands
  'electronic-study-accessories-type-c-adapters': null, // Type-C Adapters
  'electronic-study-accessories-cables': null, // Cables

  // سبورات وعروض تقديمية
  'boards-presentation': null,
  'boards-presentation-whiteboards': null, // Whiteboards
  'boards-presentation-whiteboard-markers': null, // Whiteboard Markers
  'boards-presentation-erasers': null, // Erasers
  'boards-presentation-cork-boards': null, // Cork Boards
  'boards-presentation-pins': null, // Pins
  'boards-presentation-presentation-folders': null, // Presentation Folders
  'boards-presentation-flipchart-paper': null, // Flipchart Paper

};

function normalizeBookstoreCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getBookstoreCategoryImage(
  slug: string | null | undefined,
): ImageSourcePropType | null {
  const normalizedSlug =
    normalizeBookstoreCategorySlug(slug);

  return (
    BOOKSTORE_CATEGORY_IMAGES[
      normalizedSlug
    ] ?? null
  );
}

export default BOOKSTORE_CATEGORY_IMAGES;
