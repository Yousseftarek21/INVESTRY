// Server-sent push copy in the user's app language. The app tells the server
// its language through PUT /api/push/preferences (users.language); anything
// else, including a user who hasn't opened the updated app yet, gets English.
export type PushLang = "en" | "ar";

export const pushLang = (language: string | null | undefined): PushLang => (language === "ar" ? "ar" : "en");

export function fmtAmount(n: number): string {
  return n.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

// Short figure for a push body ("245.3k"), matching utils/formatNumber.ts in the app.
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2).replace(/\.?0+$/, "")}k`;
  return n.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

interface Push { title: string; body: string }

export const loanDueTomorrow = (lang: PushLang, name: string, amount: string | null, leftAfter: string | null, cur: string): Push =>
  lang === "ar"
    ? {
        title: `قسط ${name} مستحق غدًا`,
        body: (amount ? `${amount} ${cur} مستحقة غدًا` : "دفعتك مستحقة غدًا") + (leftAfter ? ` · المتبقي بعدها ${leftAfter} ${cur}` : "") + ".",
      }
    : {
        title: `${name} payment due tomorrow`,
        body: (amount ? `${amount} ${cur} is due tomorrow` : "Your payment is due tomorrow") + (leftAfter ? ` · ${leftAfter} ${cur} left after this` : "") + ".",
      };

export const rentalCheckIn = (lang: PushLang, guest: string | undefined, unit: string): Push =>
  lang === "ar"
    ? { title: "تسجيل وصول غدًا", body: `${guest ? `يصل ${guest}` : "يصل ضيف"} إلى ${unit} غدًا.` }
    : { title: "Check-in tomorrow", body: `${guest ? `${guest} checks in` : "A guest checks in"} at ${unit} tomorrow.` };

export const rentDueToday = (lang: PushLang, tenant: string | undefined, amount: string, cur: string, unit: string): Push =>
  lang === "ar"
    ? { title: "الإيجار مستحق اليوم", body: `إيجار ${tenant || "المستأجر"} (${amount} ${cur}) عن ${unit} مستحق اليوم.` }
    : { title: "Rent due today", body: `${tenant || "Your tenant"}'s rent of ${amount} ${cur} for ${unit} is due today.` };

export const rentOverdue = (lang: PushLang, tenant: string | undefined, unit: string, days: number): Push =>
  lang === "ar"
    ? { title: "إيجار متأخر", body: `إيجار ${tenant || "المستأجر"} عن ${unit} كان مستحقًا منذ ${days} أيام ولم يُسجَّل كمدفوع.` }
    : { title: "Rent overdue", body: `${tenant || "Your tenant"}'s rent for ${unit} was due ${days} days ago and isn't marked paid.` };

export const leaseEnding = (lang: PushLang, tenant: string | undefined, unit: string, daysLeft: number): Push =>
  lang === "ar"
    ? {
        title: "العقد ينتهي قريبًا",
        body: `عقد ${tenant || "المستأجر"} في ${unit} ينتهي ${daysLeft === 0 ? "اليوم" : daysLeft === 1 ? "غدًا" : `خلال ${daysLeft} أيام`}.`,
      }
    : {
        title: "Contract ending soon",
        body: `${tenant || "Your tenant"}'s contract for ${unit} ends ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}.`,
      };

export const pendingIncomeReminder = (lang: PushLang, name: string | undefined, amount: string, cur: string, expected: string, isToday: boolean): Push =>
  lang === "ar"
    ? {
        title: "تذكير بدفعة منتظرة",
        body: `${name ? `${name}: ` : ""}دفعة ${amount} ${cur} كانت متوقعة ${isToday ? "اليوم" : `يوم ${expected}`} — هل وصلت؟ راجع الدخل.`,
      }
    : {
        title: "Pending payment reminder",
        body: `${name ? `${name}: ` : ""}${amount} ${cur} was expected ${isToday ? "today" : `on ${expected}`} — did it arrive? Check Income.`,
      };

/** Daily/weekly portfolio recap. period: "day" | "week". */
export function portfolioRecap(lang: PushLang, period: "day" | "week", current: number, baseline: number): Push {
  const pct = ((current - baseline) / baseline) * 100;
  const now = fmtCompact(current);
  if (lang === "ar") {
    const title = period === "day" ? "صباح الخير" : "ملخص أسبوعك";
    const when = period === "day" ? "اليوم" : "هذا الأسبوع";
    if (Math.abs(pct) < 0.05) return { title, body: `محفظتك ثابتة ${when} عند ${now} EGP.` };
    return { title, body: `محفظتك ${pct >= 0 ? "ارتفعت" : "انخفضت"} ${Math.abs(pct).toFixed(1)}% ${when}، وقيمتها الآن ${now} EGP.` };
  }
  const title = period === "day" ? "Good Morning" : "Your Week in Review";
  const when = period === "day" ? "today" : "this week";
  if (Math.abs(pct) < 0.05) return { title, body: `Your portfolio held steady ${when}, at ${now} EGP.` };
  return { title, body: `Your portfolio is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% ${when}, now at ${now} EGP.` };
}

/** Appended to the weekly recap when the user pays loans monthly (EGP). */
export const loanMonthLine = (lang: PushLang, monthlyEgp: number): string =>
  lang === "ar"
    ? ` أقساط القروض هذا الشهر: ${fmtCompact(monthlyEgp)} EGP.`
    : ` Loan payments this month: ${fmtCompact(monthlyEgp)} EGP.`;
