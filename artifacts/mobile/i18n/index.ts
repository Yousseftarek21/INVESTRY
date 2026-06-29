export type Language = 'en' | 'ar';

const en = {
  // App
  appName: 'استثمارك',
  appTagline: 'Your Investment',

  // Tabs
  portfolio: 'Portfolio',
  markets: 'Markets',
  holdings: 'Holdings',
  settings: 'Settings',

  // Home
  totalPortfolioValue: 'Total Portfolio Value',
  allocation: 'Allocation',
  topHoldings: 'TOP HOLDINGS',
  noInvestmentsYet: 'No investments yet',
  addFromHoldingsTab: 'Add your first holding from the Holdings tab',
  liveRates: 'LIVE RATES',

  // Markets
  currency: 'CURRENCY',
  usDollar: 'US Dollar',
  goldSection: 'GOLD — عيار',
  silverSection: 'SILVER — فضة',
  egxSection: 'EGX STOCKS — البورصة المصرية',
  perGram: 'Per gram',
  perOunce: 'Troy oz in EGP',
  stockCol: 'Stock',
  priceCol: 'Price (EGP)',
  updated: 'Updated',
  live: 'LIVE',

  // Holdings
  noHoldings: 'No investments yet',
  tapToAdd: 'Tap the + button to add your first investment',
  goldGroup: 'GOLD — ذهب',
  silverGroup: 'SILVER — فضة',
  stockGroup: 'EGX STOCKS — أسهم',
  realEstateGroup: 'REAL ESTATE — عقارات',

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
  karat: 'Karat — العيار',
  form: 'Form',
  physical: 'Physical',
  digital: 'Digital',
  weightGrams: 'Weight (grams)',
  purchasePricePerGram: 'Purchase Price per Gram (EGP)',
  stockSymbol: 'Stock Symbol — EGX',
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
  arabic: 'العربية',
  version: 'Version',
  madeInEgypt: 'Made in Egypt',
  marketData: 'MARKET DATA',
  autoRefresh: 'Auto-refresh prices',
  refreshInterval: 'Refresh every 5 minutes',
  dataSource: 'Live data: Yahoo Finance + goldprice.org',
};

const ar: typeof en = {
  // App
  appName: 'استثمارك',
  appTagline: 'استثمارك في مكان واحد',

  // Tabs
  portfolio: 'المحفظة',
  markets: 'الأسواق',
  holdings: 'أصولي',
  settings: 'الإعدادات',

  // Home
  totalPortfolioValue: 'إجمالي قيمة المحفظة',
  allocation: 'توزيع الأصول',
  topHoldings: 'أهم الأصول',
  noInvestmentsYet: 'لا توجد استثمارات بعد',
  addFromHoldingsTab: 'أضف أول استثمار من تبويب أصولي',
  liveRates: 'الأسعار المباشرة',

  // Markets
  currency: 'العملات',
  usDollar: 'الدولار الأمريكي',
  goldSection: 'الذهب',
  silverSection: 'الفضة',
  egxSection: 'البورصة المصرية EGX',
  perGram: 'للجرام',
  perOunce: 'للأوقية بالجنيه',
  stockCol: 'السهم',
  priceCol: 'السعر (جنيه)',
  updated: 'آخر تحديث',
  live: 'مباشر',

  // Holdings
  noHoldings: 'لا توجد استثمارات بعد',
  tapToAdd: 'اضغط + لإضافة أول استثمار',
  goldGroup: 'الذهب',
  silverGroup: 'الفضة',
  stockGroup: 'الأسهم',
  realEstateGroup: 'العقارات',

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
  stockSymbol: 'رمز السهم — البورصة',
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
  refreshInterval: 'تحديث كل 5 دقائق',
  dataSource: 'مصدر البيانات: Yahoo Finance + goldprice.org',
};

export const translations = { en, ar };
export type Translations = typeof en;
