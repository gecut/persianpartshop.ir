import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { getPayloadClient } from './payload.js'
import { validateSeedTarget } from './_seed-target.js'

interface CategorySeed {
  name: string
  slug: string
  ordering: number
}

interface BrandSeed {
  name: string
  slug: string
}

interface TagSeed {
  name: string
  slug: string
}

interface DimensionSeed {
  name: string
  width: number
  height: number
  slug: string
}

interface CustomerTypeSeed {
  name: string
  slug: string
  markupPercent: number
  description: string
}

const DIMENSIONS: DimensionSeed[] = [
  { name: '100×100', width: 100, height: 100, slug: '100x100' },
  { name: '60×120', width: 60, height: 120, slug: '60x120' },
  { name: '80×160', width: 80, height: 160, slug: '80x160' },
  { name: '60×60', width: 60, height: 60, slug: '60x60' },
  { name: '30×90', width: 30, height: 90, slug: '30x90' },
  { name: '30×60', width: 30, height: 60, slug: '30x60' },
  { name: '20×120', width: 20, height: 120, slug: '20x120' },
  { name: '120×240', width: 120, height: 240, slug: '120x240' },
]

const CUSTOMER_TYPES: CustomerTypeSeed[] = [
  { name: 'عمده‌فروش', slug: 'wholesaler', markupPercent: -10, description: 'پخش‌کنندگان عمده استانی با خرید متراژ بالا' },
  { name: 'فروشگاه همکار', slug: 'store_partner', markupPercent: -5, description: 'فروشگاه‌ها و شوروم‌های همکار' },
  { name: 'خریدار عادی', slug: 'regular', markupPercent: 0, description: 'خریداران عادی و مصرف‌کنندگان نهایی' },
  { name: 'تعمیرکار / مهندس پروژه', slug: 'mechanic', markupPercent: 0, description: 'مهندسان و پیمانکاران ساختمانی' },
]

interface UserSeed {
  phone: string
  fullName: string
  companyName: string
  customerTypeSlug: string
  address: string
}

interface OrderItemSeed {
  productSku: string
  requestedArea: number
}

interface OrderTimelineSeed {
  timestamp: string
  status: string
  title?: string
  description?: string
  actorType?: 'customer' | 'admin' | 'system'
}

interface OrderSeed {
  orderNumber: string
  userPhone: string
  status: 'pending' | 'approve' | 'cancel' | 'cancelled_by_customer' | 'cancelled_by_admin' | 'completed'
  cancelledBy?: 'customer' | 'admin'
  notes?: string
  deliveryAddress: string
  createdAt: string
  items: OrderItemSeed[]
  timeline: OrderTimelineSeed[]
}

interface PlanSeed {
  title: string
  userPhone: string
  type: 'credit_terms' | 'product_discount' | 'informational'
  discountPercent?: number
  status: 'active' | 'draft'
  productSkus: string[]
  content: string
  notes: string
  hasTimer?: boolean
  expiresAt?: string
}

const USERS_SEED: UserSeed[] = [
  {
    phone: '09123456789',
    fullName: 'آرش دهقان',
    companyName: 'شرکت بازرگانی کاشی و پرسلان دهقان (تهران)',
    customerTypeSlug: 'wholesaler',
    address: 'تهران، خیابان ملاصدرا، پلاک ۱۴، بازرگانی دهقان',
  },
  {
    phone: '09131234567',
    fullName: 'مهندس کامران سهرابی',
    companyName: 'شرکت ساختمانی آرمان بنا (اصفهان)',
    customerTypeSlug: 'mechanic',
    address: 'اصفهان، خیابان چهارباغ بالا، برج آسمان، واحد ۴۰۲',
  },
  {
    phone: '09171234567',
    fullName: 'مرتضی رضایی',
    companyName: 'فروشگاه کاشی مدرن (شیراز)',
    customerTypeSlug: 'store_partner',
    address: 'شیراز، بلوار امیرکبیر، جنب مجتمع تجاری ایرانیان',
  },
]

const ORDERS_SEED: OrderSeed[] = [
  {
    orderNumber: 'PP-1405-101',
    userPhone: '09123456789',
    status: 'pending',
    deliveryAddress: 'تهران، پروژه ونک، خیابان ملاصدرا، پلاک ۱۴',
    notes: 'تحویل سریع در پروژه ونک - تخلیه با لیفتراک',
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    items: [
      { productSku: 'PP-CAL-60120-P', requestedArea: 43.2 },
      { productSku: 'PP-CEM-100100-M', requestedArea: 40.0 },
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        status: 'pending',
        title: 'سفارش ثبت شده',
        description: 'سفارش در سامانه ثبت گردید (مهلت ۱۰ دقیقه جهت لغو توسط مشتری فعال است).',
        actorType: 'customer',
      },
    ],
  },
  {
    orderNumber: 'PP-1405-102',
    userPhone: '09123456789',
    status: 'pending',
    deliveryAddress: 'انبار مرکزی بازرگانی دهقان، شوروم اصلی',
    notes: 'تحویل بارگیری عصرگاهی کارخانه',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    items: [
      { productSku: 'PP-MRQ-120240-P', requestedArea: 28.8 },
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        status: 'pending',
        title: 'سفارش ثبت شده',
        description: 'سفارش با موفقیت در سامانه ثبت گردید.',
        actorType: 'customer',
      },
      {
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        status: 'checking',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'مهلت ۱۰ دقیقه‌ای کاربر به پایان رسید و سفارش در صف بررسی واحد بازرگانی قرار گرفت.',
        actorType: 'system',
      },
    ],
  },
  {
    orderNumber: 'PP-1405-103',
    userPhone: '09123456789',
    status: 'approve',
    deliveryAddress: 'پروژه برج باغ نیاوران، تحویل مهندس کارگاه',
    notes: 'حواله رسمی خروج از انبار صادر شد.',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    items: [
      { productSku: 'PP-ONX-80160-P', requestedArea: 51.2 },
      { productSku: 'PP-WOD-20120-R', requestedArea: 36.0 },
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        status: 'pending',
        title: 'سفارش ثبت شده',
        description: 'سفارش توسط خریدار در پلتفرم ثبت شد.',
        actorType: 'customer',
      },
      {
        timestamp: new Date(Date.now() - (2 * 24 * 3600 - 600) * 1000).toISOString(),
        status: 'checking',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'بررسی تخصصی متراژ و کنترل موجودی انبار انجام شد.',
        actorType: 'system',
      },
      {
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        status: 'completed',
        title: 'تکمیل شده',
        description: 'حواله رسمی خروج از انبار صادر و سفارش با موفقیت نهایی گردید.',
        actorType: 'admin',
      },
    ],
  },
  {
    orderNumber: 'PP-1405-104',
    userPhone: '09123456789',
    status: 'cancelled_by_customer',
    cancelledBy: 'customer',
    deliveryAddress: 'انبار شماره ۲ شرکت آرمان بنا، اصفهان',
    notes: 'دلیل لغو کاربر: تغییر در متراژ یا اقلام سفارش',
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    items: [
      { productSku: 'PP-PAN-3090-G', requestedArea: 32.4 },
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        status: 'pending',
        title: 'سفارش ثبت شده',
        description: 'سفارش ثبت گردید.',
        actorType: 'customer',
      },
      {
        timestamp: new Date(Date.now() - (5 * 3600 - 240) * 1000).toISOString(),
        status: 'cancelled_by_customer',
        title: 'لغو توسط کاربر',
        description: 'سفارش در مهلت ۱۰ دقیقه توسط کاربر لغو گردید و موجودی به انبار بازگشت.',
        actorType: 'customer',
      },
    ],
  },
  {
    orderNumber: 'PP-1405-105',
    userPhone: '09123456789',
    status: 'cancelled_by_admin',
    cancelledBy: 'admin',
    deliveryAddress: 'فروشگاه کاشی مدرن، شیراز',
    notes: 'دلیل لغو ادمین: عدم تأیید موجودی انبار کارخانه',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    items: [
      { productSku: 'PP-HEX-3060-G', requestedArea: 28.8 },
    ],
    timeline: [
      {
        timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        status: 'pending',
        title: 'سفارش ثبت شده',
        description: 'ثبت اولیه سفارش در سامانه.',
        actorType: 'customer',
      },
      {
        timestamp: new Date(Date.now() - (12 * 3600 - 600) * 1000).toISOString(),
        status: 'checking',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'سفارش وارد صف بررسی کارشناسان بازرگانی شد.',
        actorType: 'system',
      },
      {
        timestamp: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
        status: 'cancelled_by_admin',
        title: 'لغو توسط ادمین',
        description: 'سفارش توسط مدیریت / واحد بازرگانی به علت عدم تایید موجودی انبار لغو گردید.',
        actorType: 'admin',
      },
    ],
  },
]

const PLANS_SEED: PlanSeed[] = [
  {
    title: 'تخفیف ویژه جشنواره فصلی بازرگانی دهقان',
    userPhone: '09123456789',
    type: 'product_discount',
    discountPercent: 12,
    status: 'active',
    productSkus: ['PP-CAL-60120-P', 'PP-ONX-80160-P', 'PP-MRQ-120240-P'],
    content: 'اعمال ۱۲٪ تخفیف اختصاصی برای خرید عمده پرسلان‌های لوکس کلاکاتا و اونیکس ویژه بازرگانی دهقان',
    notes: 'اعمال ۱۲٪ تخفیف اضافه برای سفارش‌های بیش از ۱۰۰ متر اسلب و پرسلان لوکس',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'طرح ویژه تسویه اعتباری و تسهیلات بازرگانی',
    userPhone: '09123456789',
    type: 'informational',
    status: 'active',
    productSkus: [],
    content: 'امکان خرید اعتباری ۶۰ روزه با ارائه چک صیادی بنفش بدون کارمزد برای پروژه‌های فعال ساختمانی و همکاران گرامی.',
    notes: 'اطلاع‌رسانی شرایط جدید اعتباری',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'اطلاعیه ویژه بارگیری مستقیم اسلب‌های صادراتی',
    userPhone: '09123456789',
    type: 'informational',
    status: 'active',
    productSkus: ['PP-MRQ-120240-P'],
    content: 'پارتی جدید اسلب‌های پرسلان با بسته‌بندی پالت چوبی تقویت‌شده آماده ترخیص و بارگیری مستقیم از کارخانه می‌باشد.',
    notes: 'اعلامیه بارگیری و مهلت محدود ثبت سفارش انبار',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'اعلامیه ورود پارت جدید پرسلان‌های لوکس کلاکاتا پالرمو',
    userPhone: '09123456789',
    type: 'informational',
    status: 'active',
    productSkus: ['PP-CAL-60120-P', 'PP-ONX-80160-P'],
    content: 'محموله جدید پرسلان‌های نانو سوپرپولیش کلاکاتا و اونیکس با کالیبراسیون دقیق وارد انبار مرکزی شد. همکاران گرامی جهت رزرو متراژ پروژه‌ای با واحد فروش هماهنگ فرمایند.',
    notes: 'اطلاع‌رسانی ورود بار پرسلان‌های سوپر پولیش',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'اطلاعیه مهلت ارسال اسناد اعتباری و چک‌های صیادی ماه جاری',
    userPhone: '09123456789',
    type: 'informational',
    status: 'active',
    productSkus: [],
    content: 'پایان مهلت ثبت و تایید چک‌های صیادی بنفش در سامانه صیاد جهت تسویه فاکتورهای اعتباری این دوره، تا پایان این هفته می‌باشد.',
    notes: 'مهلت زمانی تایید چک‌های صیادی',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: 'اطلاعیه زمان‌بندی تحویل کالا در انبار مرکزی',
    userPhone: '09123456789',
    type: 'informational',
    status: 'active',
    productSkus: ['PP-CEM-100100-M', 'PP-WOD-20120-R'],
    content: 'جهت تسریع در فرآیند تحویل کالا به خریداران، پذیرش فاکتورهای پرسلان کف و طرح چوب تا ساعت ۱۸ روز جاری ادامه دارد.',
    notes: 'نوبت‌دهی و زمان‌بندی روزانه',
    hasTimer: true,
    expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000 + 42 * 60 * 1000).toISOString(),
  },
]

interface ProductSeed {
  sku: string
  name: string
  slug: string
  categorySlug: string
  brandSlug: string
  color: string
  grade: 'grade_1' | 'grade_2' | 'grade_3' | 'grade_4'
  tagSlugs: string[]
  width: number
  height: number
  piecesPerCarton: number
  sqmPerCarton: number
  basePricePerSqm: number
  stockCartons: number
  imageFile?: string
}

const CATEGORIES: CategorySeed[] = [
  { name: 'پرسلان کف', slug: 'porcelain-floor', ordering: 1 },
  { name: 'اسلب پرسلان', slug: 'porcelain-slab', ordering: 2 },
  { name: 'دیوار و بدنه لوکس', slug: 'luxury-wall', ordering: 3 },
  { name: 'سرامیک نما و محوطه', slug: 'facade-outdoor', ordering: 4 },
  { name: 'کاشی بین کابینتی و دکوراتیو', slug: 'decorative-kitchen', ordering: 5 },
  { name: 'سرامیک ضد اسید و صنعتی', slug: 'industrial-anti-acid', ordering: 6 },
  { name: 'سرویس و حمام ضد آب', slug: 'bathroom-waterproof', ordering: 7 },
]

const BRANDS: BrandSeed[] = [
  { name: 'کاشی و سرامیک پرسپولیس', slug: 'persepolis-tile' },
  { name: 'کاشی مرجان', slug: 'marjan-tile' },
  { name: 'صنایع کاشی تبریز', slug: 'tabriz-tile' },
  { name: 'کاشی و سرامیک الوند', slug: 'alvand-tile' },
  { name: 'شرکت تکسرام', slug: 'teceram' },
  { name: 'کاشی و سرامیک سینا', slug: 'sina-tile' },
  { name: 'راک سرامیک ایران', slug: 'rak-ceramics' },
  { name: 'کاشی پارس', slug: 'pars-tile' },
]

const TAGS: TagSeed[] = [
  { name: 'پرفروش و محبوب', slug: 'bestseller' },
  { name: 'رکتیفای (بدون بند)', slug: 'rectified' },
  { name: 'نانو سوپر پولیش', slug: 'nano-polished' },
  { name: 'مقاوم در برابر سایش (PEI 4+)', slug: 'abrasion-resistant' },
  { name: 'مقاوم در برابر یخ‌زدگی و رطوبت', slug: 'frost-resistant' },
  { name: 'کالیبره دقیق', slug: 'calibrated' },
  { name: 'پرسلان فول بادی', slug: 'full-body-porcelain' },
  { name: 'مات ابریشمی', slug: 'silk-matte' },
  { name: 'مناسب گرمایش از کف', slug: 'underfloor-heating' },
  { name: 'ضد لغزش (R11)', slug: 'anti-slip-r11' },
]

const PRODUCTS: ProductSeed[] = [
  {
    sku: 'PP-CAL-60120-P',
    name: 'کاشی پرسلان کلاکاتا گلد پالرمو',
    slug: 'calacatta-gold-palermo-60x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'tabriz-tile',
    color: 'سفید با رگه طلایی',
    grade: 'grade_1',
    tagSlugs: ['bestseller', 'nano-polished', 'rectified', 'underfloor-heating'],
    width: 60,
    height: 120,
    piecesPerCarton: 2,
    sqmPerCarton: 1.44,
    basePricePerSqm: 820000,
    stockCartons: 450,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-MRQ-120240-P',
    name: 'اسلب پرسلان مارکوئینا بلک لوکس',
    slug: 'marquina-black-slab-120x240',
    categorySlug: 'porcelain-slab',
    brandSlug: 'rak-ceramics',
    color: 'مشکی رگه‌دار سفید',
    grade: 'grade_1',
    tagSlugs: ['nano-polished', 'full-body-porcelain', 'rectified'],
    width: 120,
    height: 240,
    piecesPerCarton: 1,
    sqmPerCarton: 2.88,
    basePricePerSqm: 1950000,
    stockCartons: 120,
    imageFile: 'tile-marquina-black.jpg',
  },
  {
    sku: 'PP-CEM-100100-M',
    name: 'سرامیک پرسلان بتن اکسپوز شیلی گری',
    slug: 'cement-chile-grey-100x100',
    categorySlug: 'porcelain-floor',
    brandSlug: 'teceram',
    color: 'طوسی بتنی روشن',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'abrasion-resistant', 'underfloor-heating'],
    width: 100,
    height: 100,
    piecesPerCarton: 2,
    sqmPerCarton: 2.0,
    basePricePerSqm: 760000,
    stockCartons: 380,
    imageFile: 'tile-cement-grey.jpg',
  },
  {
    sku: 'PP-WOD-20120-R',
    name: 'سرامیک طرح چوب و پارکت رویال هانی',
    slug: 'royal-honey-wood-parquet-20x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'persepolis-tile',
    color: 'قهوه‌ای روشن عسلی',
    grade: 'grade_1',
    tagSlugs: ['bestseller', 'anti-slip-r11', 'rectified'],
    width: 20,
    height: 120,
    piecesPerCarton: 5,
    sqmPerCarton: 1.2,
    basePricePerSqm: 610000,
    stockCartons: 520,
    imageFile: 'tile-wood-honey.jpg',
  },
  {
    sku: 'PP-ONX-80160-P',
    name: 'اسلب پرسلان اونیکس وایت کریستال',
    slug: 'onyx-white-crystal-slab-80x160',
    categorySlug: 'porcelain-slab',
    brandSlug: 'tabriz-tile',
    color: 'سفید شفاف ابری',
    grade: 'grade_1',
    tagSlugs: ['nano-polished', 'rectified'],
    width: 80,
    height: 160,
    piecesPerCarton: 2,
    sqmPerCarton: 2.56,
    basePricePerSqm: 1480000,
    stockCartons: 200,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-PAN-3090-G',
    name: 'کاشی دیوار لوکس پاندا وایت',
    slug: 'panda-white-luxury-wall-30x90',
    categorySlug: 'luxury-wall',
    brandSlug: 'alvand-tile',
    color: 'سفید با رگه مشکی پهن',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'bestseller'],
    width: 30,
    height: 90,
    piecesPerCarton: 4,
    sqmPerCarton: 1.08,
    basePricePerSqm: 540000,
    stockCartons: 600,
    imageFile: 'tile-marquina-black.jpg',
  },
  {
    sku: 'PP-PLM-60120-M',
    name: 'سرامیک پرسلان پالرمو اسموکی گری',
    slug: 'palermo-smokey-grey-60x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'marjan-tile',
    color: 'دودی طوسی تیره',
    grade: 'grade_2',
    tagSlugs: ['calibrated', 'abrasion-resistant'],
    width: 60,
    height: 120,
    piecesPerCarton: 2,
    sqmPerCarton: 1.44,
    basePricePerSqm: 590000,
    stockCartons: 400,
    imageFile: 'tile-pietra-grey.jpg',
  },
  {
    sku: 'PP-TRV-40120-R',
    name: 'سرامیک نما و محوطه تراورتن کرم سیلور',
    slug: 'travertine-cream-silver-facade-40x120',
    categorySlug: 'facade-outdoor',
    brandSlug: 'persepolis-tile',
    color: 'کرم بژ طرح سنگ',
    grade: 'grade_1',
    tagSlugs: ['frost-resistant', 'anti-slip-r11'],
    width: 40,
    height: 120,
    piecesPerCarton: 3,
    sqmPerCarton: 1.44,
    basePricePerSqm: 520000,
    stockCartons: 700,
    imageFile: 'tile-travertine-beige.jpg',
  },
  {
    sku: 'PP-HEX-3060-G',
    name: 'کاشی بین کابینتی هگزاگون زولیا گلد',
    slug: 'zolia-gold-hexagon-kitchen-30x60',
    categorySlug: 'decorative-kitchen',
    brandSlug: 'alvand-tile',
    color: 'طلایی متالیک و مشکی',
    grade: 'grade_1',
    tagSlugs: ['bestseller', 'rectified'],
    width: 30,
    height: 60,
    piecesPerCarton: 8,
    sqmPerCarton: 1.44,
    basePricePerSqm: 680000,
    stockCartons: 250,
    imageFile: 'tile-marquina-black.jpg',
  },
  {
    sku: 'PP-ACD-3030-M',
    name: 'سرامیک ضد اسید صنعتی پرسلان راک',
    slug: 'industrial-anti-acid-porcelain-30x30',
    categorySlug: 'industrial-anti-acid',
    brandSlug: 'marjan-tile',
    color: 'زرد گرانیتی دانه دار',
    grade: 'grade_1',
    tagSlugs: ['full-body-porcelain', 'abrasion-resistant', 'anti-slip-r11'],
    width: 30,
    height: 30,
    piecesPerCarton: 12,
    sqmPerCarton: 1.08,
    basePricePerSqm: 710000,
    stockCartons: 850,
    imageFile: 'tile-cement-grey.jpg',
  },
  {
    sku: 'PP-EXT-8080-P',
    name: 'سرامیک پرسلان کلکته اکسترا وایت',
    slug: 'extra-white-calacatta-80x80',
    categorySlug: 'porcelain-floor',
    brandSlug: 'teceram',
    color: 'سوپر وایت شفاف',
    grade: 'grade_1',
    tagSlugs: ['nano-polished', 'bestseller', 'underfloor-heating'],
    width: 80,
    height: 80,
    piecesPerCarton: 3,
    sqmPerCarton: 1.92,
    basePricePerSqm: 690000,
    stockCartons: 420,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-STT-3090-P',
    name: 'کاشی دیوار حمام و سرویس استاتوارو لوکس',
    slug: 'statuario-luxury-bath-wall-30x90',
    categorySlug: 'bathroom-waterproof',
    brandSlug: 'tabriz-tile',
    color: 'سفید رگه‌دار فیلی',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'silk-matte'],
    width: 30,
    height: 90,
    piecesPerCarton: 4,
    sqmPerCarton: 1.08,
    basePricePerSqm: 570000,
    stockCartons: 360,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-WLN-20120-M',
    name: 'سرامیک پرسلان طرح چوب گردو ناتورال',
    slug: 'walnut-natural-wood-parquet-20x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'sina-tile',
    color: 'قهوه‌ای تیره گردویی',
    grade: 'grade_1',
    tagSlugs: ['bestseller', 'underfloor-heating', 'rectified'],
    width: 20,
    height: 120,
    piecesPerCarton: 5,
    sqmPerCarton: 1.2,
    basePricePerSqm: 620000,
    stockCartons: 480,
    imageFile: 'tile-wood-walnut.jpg',
  },
  {
    sku: 'PP-PTR-120240-M',
    name: 'اسلب پرسلان پیترا گری اصفهان مات',
    slug: 'pietra-grey-slab-isfehan-120x240',
    categorySlug: 'porcelain-slab',
    brandSlug: 'rak-ceramics',
    color: 'طوسی گرافیتی با خطوط سفید',
    grade: 'grade_1',
    tagSlugs: ['full-body-porcelain', 'rectified', 'silk-matte'],
    width: 120,
    height: 240,
    piecesPerCarton: 1,
    sqmPerCarton: 2.88,
    basePricePerSqm: 1890000,
    stockCartons: 95,
    imageFile: 'tile-pietra-grey.jpg',
  },
  {
    sku: 'PP-ZEU-60120-M',
    name: 'سرامیک کف پرسلان زئوس آنتراسیت',
    slug: 'zeus-anthracite-porcelain-60x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'marjan-tile',
    color: 'دودی ذغالی متالیک',
    grade: 'grade_1',
    tagSlugs: ['abrasion-resistant', 'calibrated', 'underfloor-heating'],
    width: 60,
    height: 120,
    piecesPerCarton: 2,
    sqmPerCarton: 1.44,
    basePricePerSqm: 640000,
    stockCartons: 310,
    imageFile: 'tile-pietra-grey.jpg',
  },
  {
    sku: 'PP-AND-3060-R',
    name: 'سرامیک نما و بالکن آندلس متالیک',
    slug: 'andalus-metallic-facade-balcony-30x60',
    categorySlug: 'facade-outdoor',
    brandSlug: 'persepolis-tile',
    color: 'آجری متالیک زنگار',
    grade: 'grade_2',
    tagSlugs: ['frost-resistant', 'anti-slip-r11'],
    width: 30,
    height: 60,
    piecesPerCarton: 8,
    sqmPerCarton: 1.44,
    basePricePerSqm: 440000,
    stockCartons: 550,
    imageFile: 'tile-travertine-beige.jpg',
  },
  {
    sku: 'PP-DIA-3060-G',
    name: 'کاشی بین کابینتی آینه‌ای دیاموند کروم',
    slug: 'diamond-chrome-mirror-kitchen-30x60',
    categorySlug: 'decorative-kitchen',
    brandSlug: 'pars-tile',
    color: 'نقره‌ای کروم براق',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'bestseller'],
    width: 30,
    height: 60,
    piecesPerCarton: 8,
    sqmPerCarton: 1.44,
    basePricePerSqm: 720000,
    stockCartons: 180,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-QRT-8080-M',
    name: 'سرامیک پرسلان کف کوارتزایت لایت بژ',
    slug: 'quartzite-light-beige-floor-80x80',
    categorySlug: 'porcelain-floor',
    brandSlug: 'alvand-tile',
    color: 'کرم بژ ماسه‌ای',
    grade: 'grade_1',
    tagSlugs: ['calibrated', 'abrasion-resistant', 'bestseller'],
    width: 80,
    height: 80,
    piecesPerCarton: 3,
    sqmPerCarton: 1.92,
    basePricePerSqm: 580000,
    stockCartons: 620,
    imageFile: 'tile-travertine-beige.jpg',
  },
  {
    sku: 'PP-ARM-40120-S',
    name: 'کاشی بدنه سالن و لابی آرمانی برنز',
    slug: 'armani-bronze-luxury-wall-40x120',
    categorySlug: 'luxury-wall',
    brandSlug: 'tabriz-tile',
    color: 'برنز قهوه‌ای متالیک',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'nano-polished'],
    width: 40,
    height: 120,
    piecesPerCarton: 3,
    sqmPerCarton: 1.44,
    basePricePerSqm: 890000,
    stockCartons: 240,
    imageFile: 'tile-pietra-grey.jpg',
  },
  {
    sku: 'PP-NER-6060-P',
    name: 'سرامیک کف پرسلان نرو مارکینا براق',
    slug: 'nero-marquina-polished-floor-60x60',
    categorySlug: 'porcelain-floor',
    brandSlug: 'teceram',
    color: 'مشکی براق با خطوط عنکبوتی',
    grade: 'grade_1',
    tagSlugs: ['nano-polished', 'bestseller'],
    width: 60,
    height: 60,
    piecesPerCarton: 4,
    sqmPerCarton: 1.44,
    basePricePerSqm: 510000,
    stockCartons: 430,
    imageFile: 'tile-marquina-black.jpg',
  },
  {
    sku: 'PP-HRD-6060-R',
    name: 'سرامیک پارکینگ و رمپ پرسلان هارد راک',
    slug: 'hard-rock-parking-ramp-60x60',
    categorySlug: 'facade-outdoor',
    brandSlug: 'marjan-tile',
    color: 'طوسی گرانیتی دانه‌درشت',
    grade: 'grade_1',
    tagSlugs: ['abrasion-resistant', 'anti-slip-r11', 'frost-resistant'],
    width: 60,
    height: 60,
    piecesPerCarton: 4,
    sqmPerCarton: 1.44,
    basePricePerSqm: 495000,
    stockCartons: 750,
    imageFile: 'tile-cement-grey.jpg',
  },
  {
    sku: 'PP-TTN-80160-M',
    name: 'اسلب پرسلان لاپاتیز تیتانیوم سیلور',
    slug: 'titanium-silver-slab-80x160',
    categorySlug: 'porcelain-slab',
    brandSlug: 'rak-ceramics',
    color: 'نقره‌ای متالیک مات',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'silk-matte'],
    width: 80,
    height: 160,
    piecesPerCarton: 2,
    sqmPerCarton: 2.56,
    basePricePerSqm: 1350000,
    stockCartons: 170,
    imageFile: 'tile-cement-grey.jpg',
  },
  {
    sku: 'PP-CWL-3090-G',
    name: 'کاشی دیوار سرویس بهداشتی کلکته گلد لوکس',
    slug: 'calacatta-gold-luxury-bath-wall-30x90',
    categorySlug: 'bathroom-waterproof',
    brandSlug: 'pars-tile',
    color: 'سفید زرین',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'bestseller'],
    width: 30,
    height: 90,
    piecesPerCarton: 4,
    sqmPerCarton: 1.08,
    basePricePerSqm: 530000,
    stockCartons: 390,
    imageFile: 'tile-calacatta-gold.jpg',
  },
  {
    sku: 'PP-EMP-100100-P',
    name: 'سرامیک پرسلان کف بوک‌مچ امپرادور دارک',
    slug: 'emperador-dark-bookmatch-floor-100x100',
    categorySlug: 'porcelain-floor',
    brandSlug: 'tabriz-tile',
    color: 'قهوه‌ای شکلاتی با رگه‌های طلایی',
    grade: 'grade_1',
    tagSlugs: ['nano-polished', 'bestseller', 'underfloor-heating'],
    width: 100,
    height: 100,
    piecesPerCarton: 2,
    sqmPerCarton: 2.0,
    basePricePerSqm: 980000,
    stockCartons: 220,
    imageFile: 'tile-wood-walnut.jpg',
  },
  {
    sku: 'PP-BRK-3060-R',
    name: 'سرامیک پرسلان طرح آجر دکوراتیو هلندی',
    slug: 'dutch-brick-decorative-porcelain-30x60',
    categorySlug: 'decorative-kitchen',
    brandSlug: 'sina-tile',
    color: 'خاکی حنایی رستیک',
    grade: 'grade_1',
    tagSlugs: ['rectified', 'anti-slip-r11'],
    width: 30,
    height: 60,
    piecesPerCarton: 8,
    sqmPerCarton: 1.44,
    basePricePerSqm: 460000,
    stockCartons: 310,
    imageFile: 'tile-travertine-beige.jpg',
  },
  {
    sku: 'PP-TRZ-60120-M',
    name: 'سرامیک پرسلان کف ترازو گرانیتی میلان',
    slug: 'milano-terrazzo-grey-porcelain-60x120',
    categorySlug: 'porcelain-floor',
    brandSlug: 'teceram',
    color: 'طوسی بتنی با سنگریزه‌های چندرنگ',
    grade: 'grade_1',
    tagSlugs: ['full-body-porcelain', 'abrasion-resistant', 'calibrated'],
    width: 60,
    height: 120,
    piecesPerCarton: 2,
    sqmPerCarton: 1.44,
    basePricePerSqm: 740000,
    stockCartons: 360,
    imageFile: 'tile-terrazzo-milano.jpg',
  },
]

export async function runSeed() {
  validateSeedTarget(process.env)
  console.log('🚀 Starting PersianPart 2.0 Database Seeding...')
  const payload = await getPayloadClient()

  // 0. Seed Staff Admins and Machine Service Account
  console.log('👑 Seeding Staff Admins and Machine Service...')
  const ADMINS_SEED = [
    {
      name: 'مدیر کل پرشین‌پارت',
      email: 'admin@persianpart.ir',
      role: 'superadmin',
      password: 'PersianPartAdmin2026!',
      isActive: true,
      enableAPIKey: false,
    },
    {
      name: 'سرویس یکپارچگی API و وب',
      email: 'service@persianpart.ir',
      role: 'service',
      password: 'ServicePassword2026!',
      isActive: true,
      enableAPIKey: true,
      apiKey: process.env.CMS_API_KEY || 'persianpart_dev_api_key_2026',
    },
    {
      name: 'مدیر بازرگانی و فروش',
      email: 'manager@persianpart.ir',
      role: 'manager',
      password: 'ManagerPassword2026!',
      isActive: true,
      enableAPIKey: false,
    },
    {
      name: 'کارشناس پشتیبانی سفارشات',
      email: 'support@persianpart.ir',
      role: 'support',
      password: 'SupportPassword2026!',
      isActive: true,
      enableAPIKey: false,
    },
  ]

  for (const adm of ADMINS_SEED) {
    const existing = await payload.find({
      collection: 'admins',
      where: { email: { equals: adm.email } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const updateData: any = {
        name: adm.name,
        role: adm.role,
        isActive: adm.isActive,
      }
      if (adm.enableAPIKey) {
        updateData.enableAPIKey = true
        updateData.apiKey = adm.apiKey
      }
      await payload.update({
        collection: 'admins',
        id: existing.docs[0].id,
        data: updateData,
      })
    } else {
      await payload.create({
        collection: 'admins',
        data: adm,
      })
    }
  }
  console.log(`✅ ${ADMINS_SEED.length} Admins & Service accounts synchronized.`)

  // 1. Seed Categories
  console.log('📦 Seeding Categories...')
  const categoryMap = new Map<string, number>()
  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    let id: number
    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'categories',
        id,
        data: { name: cat.name, ordering: cat.ordering, isActive: true },
      })
    } else {
      const created = await payload.create({
        collection: 'categories',
        data: { name: cat.name, slug: cat.slug, ordering: cat.ordering, isActive: true },
      })
      id = created.id
    }
    categoryMap.set(cat.slug, id)
  }
  console.log(`✅ ${categoryMap.size} Categories synchronized.`)

  // 2. Seed Brands
  console.log('🏢 Seeding Brands...')
  const brandMap = new Map<string, number>()
  for (const br of BRANDS) {
    const existing = await payload.find({
      collection: 'brands',
      where: { slug: { equals: br.slug } },
      limit: 1,
    })

    let id: number
    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'brands',
        id,
        data: { name: br.name, isActive: true },
      })
    } else {
      const created = await payload.create({
        collection: 'brands',
        data: { name: br.name, slug: br.slug, isActive: true },
      })
      id = created.id
    }
    brandMap.set(br.slug, id)
  }
  console.log(`✅ ${brandMap.size} Brands synchronized.`)

  // 3. Seed Tags
  console.log('🏷️ Seeding Tags...')
  const tagMap = new Map<string, number>()
  for (const t of TAGS) {
    const existing = await payload.find({
      collection: 'tags',
      where: { slug: { equals: t.slug } },
      limit: 1,
    })

    let id: number
    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'tags',
        id,
        data: { name: t.name, isActive: true },
      })
    } else {
      const created = await payload.create({
        collection: 'tags',
        data: { name: t.name, slug: t.slug, isActive: true },
      })
      id = created.id
    }
    tagMap.set(t.slug, id)
  }
  console.log(`✅ ${tagMap.size} Tags synchronized.`)

  // 3.5 Seed Customer Types
  console.log('👥 Seeding Customer Types...')
  const customerTypeMap = new Map<string, number>()
  for (const ct of CUSTOMER_TYPES) {
    const existing = await payload.find({
      collection: 'customer-types',
      where: { slug: { equals: ct.slug } },
      limit: 1,
    })

    let id: number
    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'customer-types',
        id,
        data: { name: ct.name, markupPercent: ct.markupPercent, description: ct.description, isActive: true },
      })
    } else {
      const created = await payload.create({
        collection: 'customer-types',
        data: { name: ct.name, slug: ct.slug, markupPercent: ct.markupPercent, description: ct.description, isActive: true },
      })
      id = created.id
    }
    customerTypeMap.set(ct.slug, id)
  }
  console.log(`✅ ${customerTypeMap.size} Customer Types synchronized.`)

  // 3.6 Seed Dimensions
  console.log('📐 Seeding Dimensions...')
  const dimensionMap = new Map<string, number>()
  for (const dim of DIMENSIONS) {
    const existing = await payload.find({
      collection: 'dimensions',
      where: { slug: { equals: dim.slug } },
      limit: 1,
    })

    let id: number
    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'dimensions',
        id,
        data: { name: dim.name, width: dim.width, height: dim.height, isActive: true },
      })
    } else {
      const created = await payload.create({
        collection: 'dimensions',
        data: { name: dim.name, width: dim.width, height: dim.height, slug: dim.slug, isActive: true },
      })
      id = created.id
    }
    dimensionMap.set(`${dim.width}x${dim.height}`, id)
    dimensionMap.set(dim.slug, id)
  }
  console.log(`✅ ${dimensionMap.size / 2} Dimensions synchronized.`)

  // Ensure all products have their dimensions seeded
  for (const prod of PRODUCTS) {
    const key = `${prod.width}x${prod.height}`
    if (!dimensionMap.has(key)) {
      const name = `${prod.width}×${prod.height}`
      const existing = await payload.find({
        collection: 'dimensions',
        where: { slug: { equals: key } },
        limit: 1,
      })
      let id: number
      if (existing.docs.length > 0) {
        id = existing.docs[0].id
      } else {
        const created = await payload.create({
          collection: 'dimensions',
          data: { name, width: prod.width, height: prod.height, slug: key, isActive: true },
        })
        id = created.id
      }
      dimensionMap.set(key, id)
    }
  }

  // 4. Synchronize Demo Tile Media
  console.log('🖼️ Synchronizing Demo Tile Media...')
  const DEMO_MEDIA_FILES = [
    { filename: 'tile-calacatta-gold.jpg', alt: 'کاشی پرسلان کلاکاتا گلد پالرمو' },
    { filename: 'tile-marquina-black.jpg', alt: 'اسلب پرسلان مارکوئینا بلک لوکس' },
    { filename: 'tile-cement-grey.jpg', alt: 'سرامیک پرسلان بتن اکسپوز شیلی گری' },
    { filename: 'tile-wood-honey.jpg', alt: 'سرامیک طرح چوب و پارکت رویال هانی' },
    { filename: 'tile-travertine-beige.jpg', alt: 'سرامیک نما و محوطه تراورتن کرم سیلور' },
    { filename: 'tile-terrazzo-milano.jpg', alt: 'سرامیک پرسلان کف ترازو گرانیتی میلان' },
    { filename: 'tile-pietra-grey.jpg', alt: 'اسلب پرسلان پیترا گری اصفهان مات' },
    { filename: 'tile-wood-walnut.jpg', alt: 'سرامیک پرسلان طرح چوب گردو ناتورال' },
  ]

  const mediaByFilename = new Map<string, number>()
  const mediaByAlt = new Map<string, number>()
  const existingMedia = await payload.find({
    collection: 'media',
    limit: 100,
  })
  for (const doc of existingMedia.docs) {
    if (doc.filename) {
      mediaByFilename.set(doc.filename, doc.id)
    }
    if ((doc as any).alt) {
      mediaByAlt.set((doc as any).alt, doc.id)
    }
  }

  const candidateMediaDirs = [
    path.resolve(process.cwd(), 'apps/cms/media'),
    path.resolve(process.cwd(), 'media'),
  ]
  const mediaDir = candidateMediaDirs.find((d) => fs.existsSync(d)) || candidateMediaDirs[0]

  for (const item of DEMO_MEDIA_FILES) {
    const existingId = mediaByFilename.get(item.filename) || mediaByAlt.get(item.alt)
    if (!existingId) {
      const diskPath = path.join(mediaDir, item.filename)
      if (fs.existsSync(diskPath)) {
        try {
          const created = await payload.create({
            collection: 'media',
            data: { alt: item.alt },
            filePath: diskPath,
          })
          mediaByFilename.set(item.filename, created.id)
          mediaByAlt.set(item.alt, created.id)
          console.log(`  ✓ Seeded media doc for: ${item.filename} (ID: ${created.id})`)
        } catch (err: any) {
          console.warn(`  ! Could not seed media doc for ${item.filename}:`, err?.message)
        }
      }
    } else {
      mediaByFilename.set(item.filename, existingId)
    }
  }

  const defaultMediaId =
    mediaByFilename.get('tile-calacatta-gold.jpg') ||
    (existingMedia.docs.length > 0 ? existingMedia.docs[0].id : null)
  const secondaryMediaId =
    mediaByFilename.get('tile-cement-grey.jpg') || defaultMediaId

  // 5. Seed Products
  console.log(`💎 Seeding ${PRODUCTS.length} realistic Products with distinct tile textures...`)
  let createdCount = 0
  let updatedCount = 0

  for (const prod of PRODUCTS) {
    const categoryId = categoryMap.get(prod.categorySlug) || null
    const brandId = brandMap.get(prod.brandSlug) || null
    const tagIds = prod.tagSlugs.map((slug) => tagMap.get(slug)).filter((id): id is number => typeof id === 'number')
    const dimensionId = dimensionMap.get(`${prod.width}x${prod.height}`) || null

    const inventorySqm = Math.round(prod.stockCartons * prod.sqmPerCarton * 100) / 100

    const targetMediaId = (prod.imageFile && mediaByFilename.get(prod.imageFile)) || defaultMediaId

    const productData: any = {
      sku: prod.sku,
      name: prod.name,
      slug: prod.slug,
      category: categoryId,
      brand: brandId,
      color: prod.color,
      grade: prod.grade,
      tags: tagIds,
      dimension: dimensionId,
      width: prod.width,
      height: prod.height,
      piecesPerCarton: prod.piecesPerCarton,
      sqmPerCarton: prod.sqmPerCarton,
      basePricePerSqm: prod.basePricePerSqm,
      stockCartons: prod.stockCartons,
      inventorySqm,
      isActive: true,
    }

    if (targetMediaId) {
      productData.cover = targetMediaId
      // Provide a complementary secondary image in gallery if available
      const altMediaId =
        (prod.imageFile === 'tile-calacatta-gold.jpg'
          ? mediaByFilename.get('tile-marquina-black.jpg')
          : mediaByFilename.get('tile-calacatta-gold.jpg')) || secondaryMediaId
      if (altMediaId && altMediaId !== targetMediaId) {
        productData.gallery = [{ image: altMediaId }]
      } else {
        productData.gallery = [{ image: targetMediaId }]
      }
    }

    const existing = await payload.find({
      collection: 'products',
      where: {
        or: [{ sku: { equals: prod.sku } }, { slug: { equals: prod.slug } }],
      },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      // Do not overwrite stockCartons and inventorySqm on re-seed to preserve live order reservations
      const { stockCartons, inventorySqm, ...safeProductData } = productData
      await payload.update({
        collection: 'products',
        id: existing.docs[0].id,
        data: safeProductData,
      })
      updatedCount++
    } else {
      await payload.create({
        collection: 'products',
        data: productData,
      })
      createdCount++
    }
  }

  // 6. Seed B2B Users
  console.log('👤 Seeding B2B Users / Customers...')
  const userMap = new Map<string, number>()
  for (const u of USERS_SEED) {
    const customerTypeId = customerTypeMap.get(u.customerTypeSlug) || Array.from(customerTypeMap.values())[0]
    const existing = await payload.find({
      collection: 'users',
      where: { phone: { equals: u.phone } },
      limit: 1,
    })

    let id: number
    const userData: any = {
      phone: u.phone,
      fullName: u.fullName,
      companyName: u.companyName,
      customerType: customerTypeId,
      status: 'active',
      address: u.address,
    }

    if (existing.docs.length > 0) {
      id = existing.docs[0].id
      await payload.update({
        collection: 'users',
        id,
        data: userData,
      })
    } else {
      const created = await payload.create({
        collection: 'users',
        data: userData,
      })
      id = created.id
    }
    userMap.set(u.phone, id)
  }
  console.log(`✅ ${userMap.size} Users synchronized.`)

  // 7. Seed Orders with rich Timelines
  console.log(`📦 Seeding ${ORDERS_SEED.length} Orders with real typed Timelines...`)
  let ordersCreated = 0
  for (const ord of ORDERS_SEED) {
    const userId = userMap.get(ord.userPhone) || Array.from(userMap.values())[0]

    const itemsData: any[] = []
    let calculatedSubtotal = 0

    for (const it of ord.items) {
      const prodExisting = await payload.find({
        collection: 'products',
        where: { sku: { equals: it.productSku } },
        limit: 1,
      })
      if (prodExisting.docs.length > 0) {
        const prod = prodExisting.docs[0] as any
        const sqmPerCarton = prod.sqmPerCarton || 1.44
        const cartonCount = Math.ceil(it.requestedArea / sqmPerCarton)
        const deliverableArea = Math.round(cartonCount * sqmPerCarton * 100) / 100
        const unitPrice = prod.basePricePerSqm || 600000
        const totalPrice = Math.round(deliverableArea * unitPrice)

        itemsData.push({
          product: prod.id,
          requestedArea: it.requestedArea,
          cartonCount,
          deliverableArea,
          unitPrice,
          totalPrice,
        })
        calculatedSubtotal += totalPrice
      }
    }

    const orderData: any = {
      orderNumber: ord.orderNumber,
      user: userId,
      status: 'pending',
      items: itemsData,
      subtotal: calculatedSubtotal,
      discountAmount: 0,
      taxAmount: Math.round(calculatedSubtotal * 0.1),
      finalTotal: Math.round(calculatedSubtotal * 1.1),
      deliveryAddress: ord.deliveryAddress,
      notes: ord.notes || '',
      createdAt: ord.createdAt,
      timeline: ord.timeline.map((t) => ({
        timestamp: t.timestamp,
        status: t.status,
      })),
    }

    const existing = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: ord.orderNumber } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      // Preserve existing orders without modifying terminal status records
      continue
    } else {
      const created = await payload.create({
        collection: 'orders',
        data: orderData,
      })
      ordersCreated++

      // Transition order according to seed target status
      if (ord.status === 'approve' || ord.status === 'completed') {
        await payload.update({
          collection: 'orders',
          id: created.id,
          data: { status: 'approve' },
        })
        if (ord.status === 'completed') {
          await payload.update({
            collection: 'orders',
            id: created.id,
            data: { status: 'completed' },
          })
        }
      } else if (ord.status === 'cancelled_by_customer' || ord.status === 'cancelled_by_admin' || ord.status === 'cancel') {
        await payload.update({
          collection: 'orders',
          id: created.id,
          data: {
            status: ord.status,
            cancelledBy: ord.cancelledBy || 'admin',
          },
        })
      }
    }
  }
  console.log(`✅ ${ORDERS_SEED.length} Orders with Timelines synchronized.`)

  // 8. Seed Plans
  console.log(`📋 Seeding ${PLANS_SEED.length} commercial Plans...`)
  for (const pl of PLANS_SEED) {
    const userId = userMap.get(pl.userPhone)
    const productIds: number[] = []

    for (const sku of pl.productSkus) {
      const prod = await payload.find({
        collection: 'products',
        where: { sku: { equals: sku } },
        limit: 1,
      })
      if (prod.docs.length > 0) {
        productIds.push(prod.docs[0].id)
      }
    }

    const planData: any = {
      title: pl.title,
      content: pl.content,
      users: userId ? [userId] : [],
    }

    const existing = await payload.find({
      collection: 'plans',
      where: { title: { equals: pl.title } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'plans',
        id: existing.docs[0].id,
        data: planData,
      })
    } else {
      await payload.create({
        collection: 'plans',
        data: planData,
      })
    }
  }
  console.log(`✅ ${PLANS_SEED.length} Plans synchronized.`)

  // 9. Deactivate legacy dummy test products
  try {
    const all = await payload.find({ collection: 'products', limit: 100 })
    const dummies = all.docs.filter((d: any) => d.name?.includes('شومبول') || d.sku?.includes('شومبول'))
    for (const dummy of dummies) {
      await payload.update({
        collection: 'products',
        id: dummy.id,
        data: { isActive: false },
      })
      console.log(`🔒 Deactivated legacy test product #${dummy.id} (${dummy.name})`)
    }
  } catch (err) {
    // ignore
  }

  console.log(`🎉 Seeding complete! (${createdCount} products created, ${userMap.size} users, ${ORDERS_SEED.length} orders with timelines)`)
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv.includes('--run')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed with error:', err)
      process.exit(1)
    })
}
