export type CategoryId =
  | 'restaurants'
  | 'supermarket'
  | 'pharmacy';

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  section: string;
};

export type Store = {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  icon: string;
  deliveryTime: string;
  deliveryFee: number;
  minimumOrder: number;
  rating: number;
  products: Product[];
};

export type Category = {
  id: CategoryId;
  title: string;
  subtitle: string;
  icon: string;
};

export const categoriesData: Record<CategoryId, Category> = {
  restaurants: {
    id: 'restaurants',
    title: 'المطاعم',
    subtitle: 'اختر المطعم الذي تريد الطلب منه',
    icon: '🍔',
  },

  supermarket: {
    id: 'supermarket',
    title: 'السوبرماركت',
    subtitle: 'كل احتياجات البيت في طلب واحد',
    icon: '🛒',
  },

  pharmacy: {
    id: 'pharmacy',
    title: 'الصيدليات',
    subtitle: 'منتجات الصيدلية والعناية الشخصية',
    icon: '💊',
  },
};

export const storesData: Record<string, Store> = {
  'restaurant-1': {
    id: 'restaurant-1',
    categoryId: 'restaurants',
    name: 'مطعم تجريبي',
    description: 'وجبات وسندوتشات داخل الهضبة',
    icon: '🍗',
    deliveryTime: '30–45 دقيقة',
    deliveryFee: 20,
    minimumOrder: 60,
    rating: 4.7,
    products: [
      {
        id: 'chicken-meal',
        name: 'وجبة فراخ',
        description: 'قطعة فراخ مع أرز وسلطة وخبز',
        price: 120,
        icon: '🍗',
        section: 'الوجبات',
      },
      {
        id: 'kofta-meal',
        name: 'وجبة كفتة',
        description: 'كفتة مشوية مع أرز وسلطة',
        price: 135,
        icon: '🍖',
        section: 'الوجبات',
      },
      {
        id: 'chicken-sandwich',
        name: 'ساندوتش فراخ',
        description: 'فراخ متبلة مع صوص وخضروات',
        price: 70,
        icon: '🥪',
        section: 'السندوتشات',
      },
      {
        id: 'fries',
        name: 'بطاطس مقلية',
        description: 'بطاطس مقرمشة بالحجم المتوسط',
        price: 35,
        icon: '🍟',
        section: 'الإضافات',
      },
      {
        id: 'cola',
        name: 'مشروب غازي',
        description: 'كانز مشروب غازي 330 مل',
        price: 20,
        icon: '🥤',
        section: 'المشروبات',
      },
    ],
  },

  'restaurant-2': {
    id: 'restaurant-2',
    categoryId: 'restaurants',
    name: 'مطعم تجريبي 2',
    description: 'بيتزا ومخبوزات داخل الهضبة',
    icon: '🍕',
    deliveryTime: '35–50 دقيقة',
    deliveryFee: 25,
    minimumOrder: 80,
    rating: 4.5,
    products: [
      {
        id: 'margherita-pizza',
        name: 'بيتزا مارجريتا',
        description: 'صوص طماطم وجبنة موتزاريلا',
        price: 110,
        icon: '🍕',
        section: 'البيتزا',
      },
      {
        id: 'chicken-pizza',
        name: 'بيتزا فراخ',
        description: 'فراخ متبلة وجبنة وخضروات',
        price: 145,
        icon: '🍕',
        section: 'البيتزا',
      },
      {
        id: 'cheese-pastry',
        name: 'فطيرة جبنة',
        description: 'فطيرة طازجة محشوة بالجبنة',
        price: 75,
        icon: '🥐',
        section: 'المخبوزات',
      },
      {
        id: 'juice',
        name: 'عصير',
        description: 'عصير بارد حسب المتاح',
        price: 30,
        icon: '🧃',
        section: 'المشروبات',
      },
    ],
  },

  'supermarket-1': {
    id: 'supermarket-1',
    categoryId: 'supermarket',
    name: 'سوبرماركت تجريبي',
    description: 'بقالة ومشروبات واحتياجات يومية',
    icon: '🏪',
    deliveryTime: '20–35 دقيقة',
    deliveryFee: 15,
    minimumOrder: 50,
    rating: 4.8,
    products: [
      {
        id: 'water',
        name: 'مياه معدنية',
        description: 'زجاجة مياه معدنية 1.5 لتر',
        price: 12,
        icon: '💧',
        section: 'المشروبات',
      },
      {
        id: 'milk',
        name: 'لبن',
        description: 'عبوة لبن كامل الدسم 1 لتر',
        price: 45,
        icon: '🥛',
        section: 'الألبان',
      },
      {
        id: 'bread',
        name: 'خبز',
        description: 'عبوة خبز طازج',
        price: 20,
        icon: '🍞',
        section: 'المخبوزات',
      },
      {
        id: 'chips',
        name: 'شيبسي',
        description: 'كيس شيبسي بالحجم الكبير',
        price: 25,
        icon: '🥔',
        section: 'التسالي',
      },
      {
        id: 'tissues',
        name: 'مناديل',
        description: 'علبة مناديل ورقية',
        price: 35,
        icon: '🧻',
        section: 'احتياجات المنزل',
      },
    ],
  },

  'supermarket-2': {
    id: 'supermarket-2',
    categoryId: 'supermarket',
    name: 'ماركت تجريبي 2',
    description: 'منتجات غذائية ومنزلية',
    icon: '🥫',
    deliveryTime: '25–40 دقيقة',
    deliveryFee: 18,
    minimumOrder: 60,
    rating: 4.6,
    products: [
      {
        id: 'rice',
        name: 'أرز',
        description: 'كيس أرز أبيض 1 كجم',
        price: 38,
        icon: '🍚',
        section: 'البقالة',
      },
      {
        id: 'pasta',
        name: 'مكرونة',
        description: 'كيس مكرونة 400 جرام',
        price: 22,
        icon: '🍝',
        section: 'البقالة',
      },
      {
        id: 'tomato-sauce',
        name: 'صلصة طماطم',
        description: 'عبوة صلصة طماطم',
        price: 18,
        icon: '🥫',
        section: 'البقالة',
      },
      {
        id: 'detergent',
        name: 'منظف أطباق',
        description: 'عبوة منظف أطباق',
        price: 42,
        icon: '🧴',
        section: 'احتياجات المنزل',
      },
    ],
  },

  'pharmacy-1': {
    id: 'pharmacy-1',
    categoryId: 'pharmacy',
    name: 'صيدلية تجريبية',
    description: 'منتجات العناية الشخصية والصيدلية',
    icon: '⚕️',
    deliveryTime: '20–35 دقيقة',
    deliveryFee: 20,
    minimumOrder: 50,
    rating: 4.9,
    products: [
      {
        id: 'hand-wash',
        name: 'غسول يدين',
        description: 'غسول يومي لليدين',
        price: 65,
        icon: '🧴',
        section: 'العناية الشخصية',
      },
      {
        id: 'toothpaste',
        name: 'معجون أسنان',
        description: 'معجون أسنان للاستخدام اليومي',
        price: 55,
        icon: '🪥',
        section: 'العناية الشخصية',
      },
      {
        id: 'shampoo',
        name: 'شامبو',
        description: 'شامبو للعناية اليومية بالشعر',
        price: 95,
        icon: '🧴',
        section: 'العناية بالشعر',
      },
      {
        id: 'tissues-pharmacy',
        name: 'مناديل مبللة',
        description: 'عبوة مناديل مبللة',
        price: 45,
        icon: '🧻',
        section: 'الاحتياجات اليومية',
      },
    ],
  },
};

export function isCategoryId(
  value: string,
): value is CategoryId {
  return value in categoriesData;
}

export function getCategoryById(
  categoryId: CategoryId,
): Category {
  return categoriesData[categoryId];
}

export function getStoresByCategoryId(
  categoryId: CategoryId,
): Store[] {
  return Object.values(storesData).filter(
    (store) => store.categoryId === categoryId,
  );
}

export function getStoreById(
  storeId: string,
): Store | undefined {
  return storesData[storeId];
}

export function getProductById(
  storeId: string,
  productId: string,
): Product | undefined {
  const store = getStoreById(storeId);

  return store?.products.find(
    (product) => product.id === productId,
  );
}