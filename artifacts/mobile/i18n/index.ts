export type Language = 'en' | 'ar';

const en = {
  // App
  appName: 'INVSTRY',
  appTagline: 'Your Investment Tracker',

  // Tabs
  portfolio: 'Portfolio',
  markets: 'Markets',
  holdings: 'Investments',
  analytics: 'Analytics',
  settings: 'Settings',

  // Home
  totalPortfolioValue: 'Total Portfolio Value',
  allocation: 'Allocation',
  topHoldings: 'TOP INVESTMENTS',
  noInvestmentsYet: 'No investments yet',
  addFromHoldingsTab: 'Add your first investment from the Investments tab',
  liveRates: 'LIVE RATES',

  // Markets
  currency: 'CURRENCY',
  usDollar: 'US Dollar',
  goldSection: 'GOLD',
  silverSection: 'SILVER',
  egxSection: 'EGX STOCKS',
  perGram: 'Per gram',
  perOunce: 'Troy oz · EGP',
  stockCol: 'Stock',
  priceCol: 'Price (EGP)',
  updated: 'Updated',
  live: 'LIVE',

  // Gold karat labels
  karat24label: '24K · Pure',
  karat22label: '22K',
  karat21label: '21K',
  karat18label: '18K',
  goldOzLabel: 'Gold · Troy Oz',

  // Silver labels
  silverGramLabel: 'Silver · Gram',
  silverOzLabel: 'Silver · Troy Oz',

  // Investments (Holdings)
  noHoldings: 'No investments yet',
  tapToAdd: 'Tap + to add your first investment',
  goldGroup: 'GOLD',
  silverGroup: 'SILVER',
  stockGroup: 'EGX STOCKS',
  realEstateGroup: 'REAL ESTATE',

  // Add tab
  addTab: 'Add',

  // Add Investment
  addInvestment: 'Add Investment',
  investmentType: 'Investment Type',
  save: 'Save',
  missingFields: 'Missing fields',
  enterGramsAndPrice: 'Please enter grams and purchase price.',
  enterSharesAndPrice: 'Please enter shares and purchase price.',
  enterPrices: 'Please enter purchase price and current value.',
  notes: 'Notes (optional)',
  addNote: 'Add a note...',
  karat: 'Karat',
  form: 'Form',
  physical: 'Physical',
  digital: 'Digital',
  weightGrams: 'Weight (grams)',
  purchasePricePerGram: 'Purchase Price per Gram (EGP)',
  stockSymbol: 'Stock Symbol',
  customSymbol: 'Or enter custom symbol...',
  numberOfShares: 'Number of Shares',
  purchasePricePerShare: 'Purchase Price per Share (EGP)',
  propertyType: 'Property Type',
  location: 'Location',
  purchasePrice: 'Purchase Price (EGP)',
  currentEstimatedValue: 'Current Estimated Value (EGP)',
  apartment: 'Apartment',
  villa: 'Villa',
  land: 'Land',
  commercial: 'Commercial',

  // Types
  gold: 'Gold',
  silver: 'Silver',
  egxStock: 'EGX Stock',
  realEstate: 'Real Estate',

  // Settings
  appearance: 'APPEARANCE',
  language: 'LANGUAGE',
  about: 'ABOUT',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  english: 'English',
  arabic: 'Arabic',
  version: 'Version',
  madeInEgypt: 'Made in Egypt',
  marketData: 'MARKET DATA',
  autoRefresh: 'Auto-refresh prices',
  refreshInterval: 'Refresh every 2 minutes',
  dataSource: 'Live data: gold-api.com + goldprice.org',

  // Subscription paywall
  subMonth: 'month',
  subYear: 'year',
  subMonthly: 'Monthly',
  subAnnual: 'Annual',
  subSave33: 'SAVE 33%',
  subMostPopular: 'MOST POPULAR',
  subHeroSub: 'Unlock your full financial potential',
  subWhatsIncluded: "WHAT'S INCLUDED",
  subContinueWith: 'Continue with',
  subRestorePurchases: 'Restore Purchases',
  subRestoring: 'Restoring…',
  subTerms: 'Terms',
  subPrivacy: 'Privacy',
  subDisclaimer: 'Subscriptions auto-renew. Cancel anytime in your App Store or Google Play settings.',
  subConfirmTitle: 'Confirm Subscription',
  subSubscribingTo: 'Subscribing to',
  subAt: 'at',
  subSubscribeNow: 'Subscribe Now',
  subCancel: 'Cancel',
  subAutoRenews: 'Auto-renews. Cancel anytime in your App Store / Google Play settings.',
  subUnlimitedInvestments: 'Unlimited investments',
  subAllCalculators: 'All 8 financial calculators',
  subMarketIntelligence: 'Market Intelligence',
  subPortfolioAnalytics: 'Portfolio Analytics',
  subZakat: 'Zakat auto-calculation',
  subAdvancedCharts: 'Advanced performance charts',
  subEgxRealtime: 'EGX real-time data',
  subCsvExport: 'CSV / JSON export',
  subPrioritySupport: 'Priority support',
  subUpgradeTo: 'Upgrade to',
  subFromYearlyPro: 'From 399.99 EGP/year',
  subFromYearlyProPlus: 'From 559.99 EGP/year',

  // Footer
  footerTagline: 'Egypt · Live Market Data · 2024',
};

const ar: typeof en = {
  // App
  appName: 'INVSTRY',
  appTagline: 'متابع استثماراتك',

  // Tabs
  portfolio: 'المحفظة',
  markets: 'الأسواق',
  holdings: 'استثماراتي',
  analytics: 'التحليلات',
  settings: 'الإعدادات',

  // Home
  totalPortfolioValue: 'إجمالي قيمة المحفظة',
  allocation: 'توزيع الأصول',
  topHoldings: 'أهم الاستثمارات',
  noInvestmentsYet: 'لا توجد استثمارات بعد',
  addFromHoldingsTab: 'أضف أول استثمار من تبويب استثماراتي',
  liveRates: 'الأسعار المباشرة',

  // Markets
  currency: 'العملات',
  usDollar: 'الدولار الأمريكي',
  goldSection: 'الذهب',
  silverSection: 'الفضة',
  egxSection: 'البورصة المصرية',
  perGram: 'للجرام',
  perOunce: 'للأوقية · جنيه',
  stockCol: 'السهم',
  priceCol: 'السعر (جنيه)',
  updated: 'آخر تحديث',
  live: 'مباشر',

  // Gold karat labels
  karat24label: '24 قيراط · خالص',
  karat22label: 'عيار 22',
  karat21label: 'عيار 21',
  karat18label: 'عيار 18',
  goldOzLabel: 'ذهب · أوقية',

  // Silver labels
  silverGramLabel: 'فضة · جرام',
  silverOzLabel: 'فضة · أوقية',

  // Investments (Holdings)
  noHoldings: 'لا توجد استثمارات بعد',
  tapToAdd: 'اضغط + لإضافة أول استثمار',
  goldGroup: 'الذهب',
  silverGroup: 'الفضة',
  stockGroup: 'الأسهم',
  realEstateGroup: 'العقارات',

  // Add tab
  addTab: 'إضافة',

  // Add Investment
  addInvestment: 'إضافة استثمار',
  investmentType: 'نوع الاستثمار',
  save: 'حفظ',
  missingFields: 'بيانات ناقصة',
  enterGramsAndPrice: 'الرجاء إدخال الوزن وسعر الشراء.',
  enterSharesAndPrice: 'الرجاء إدخال عدد الأسهم وسعر الشراء.',
  enterPrices: 'الرجاء إدخال سعر الشراء والقيمة الحالية.',
  notes: 'ملاحظات (اختياري)',
  addNote: 'أضف ملاحظة...',
  karat: 'العيار',
  form: 'الشكل',
  physical: 'مادي',
  digital: 'رقمي',
  weightGrams: 'الوزن (جرام)',
  purchasePricePerGram: 'سعر الشراء للجرام (جنيه)',
  stockSymbol: 'رمز السهم',
  customSymbol: 'أو أدخل رمزاً مخصصاً...',
  numberOfShares: 'عدد الأسهم',
  purchasePricePerShare: 'سعر الشراء للسهم (جنيه)',
  propertyType: 'نوع العقار',
  location: 'الموقع',
  purchasePrice: 'سعر الشراء (جنيه)',
  currentEstimatedValue: 'القيمة الحالية المقدرة (جنيه)',
  apartment: 'شقة',
  villa: 'فيلا',
  land: 'أرض',
  commercial: 'تجاري',

  // Types
  gold: 'ذهب',
  silver: 'فضة',
  egxStock: 'أسهم البورصة',
  realEstate: 'عقارات',

  // Settings
  appearance: 'المظهر',
  language: 'اللغة',
  about: 'حول التطبيق',
  light: 'فاتح',
  dark: 'داكن',
  system: 'تلقائي',
  english: 'English',
  arabic: 'العربية',
  version: 'الإصدار',
  madeInEgypt: 'صنع في مصر',
  marketData: 'بيانات السوق',
  autoRefresh: 'تحديث الأسعار تلقائياً',
  refreshInterval: 'تحديث كل دقيقتين',
  dataSource: 'مصدر البيانات: gold-api.com + goldprice.org',

  // Subscription paywall
  subMonth: 'شهر',
  subYear: 'سنة',
  subMonthly: 'شهري',
  subAnnual: 'سنوي',
  subSave33: 'وفر 33%',
  subMostPopular: 'الأكثر شيوعاً',
  subHeroSub: 'افتح إمكاناتك المالية الكاملة',
  subWhatsIncluded: 'ما يتضمنه الاشتراك',
  subContinueWith: 'متابعة مع',
  subRestorePurchases: 'استعادة المشتريات',
  subRestoring: 'جارٍ الاستعادة…',
  subTerms: 'الشروط',
  subPrivacy: 'الخصوصية',
  subDisclaimer: 'يُجدَّد تلقائياً. يمكنك الإلغاء في أي وقت من إعدادات App Store أو Google Play.',
  subConfirmTitle: 'تأكيد الاشتراك',
  subSubscribingTo: 'أنت تشترك في',
  subAt: 'بسعر',
  subSubscribeNow: 'اشترك الآن',
  subCancel: 'إلغاء',
  subAutoRenews: 'يُجدَّد تلقائياً. يمكنك الإلغاء من إعدادات App Store / Google Play.',
  subUnlimitedInvestments: 'استثمارات غير محدودة',
  subAllCalculators: 'جميع الآلات الحاسبة (8)',
  subMarketIntelligence: 'ذكاء السوق',
  subPortfolioAnalytics: 'تحليلات المحفظة',
  subZakat: 'حساب الزكاة التلقائي',
  subAdvancedCharts: 'مخططات أداء متقدمة',
  subEgxRealtime: 'بيانات البورصة الفورية',
  subCsvExport: 'تصدير CSV / JSON',
  subPrioritySupport: 'دعم أولوي',
  subUpgradeTo: 'ترقية إلى',
  subFromYearlyPro: 'من 399.99 جنيه/سنة',
  subFromYearlyProPlus: 'من 559.99 جنيه/سنة',

  // Footer
  footerTagline: 'مصر · بيانات حية · ٢٠٢٤',
};

export const translations = { en, ar };
export type Translations = typeof en;
