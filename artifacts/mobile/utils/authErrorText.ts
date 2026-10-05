import type { useT } from '@/hooks/useTranslation';

type Translations = ReturnType<typeof useT>;

// Clerk's error messages are English-only. Common error codes map to our own
// translated text; anything else keeps Clerk's message for English users and
// falls back to the translated generic message otherwise — an English
// sentence dropped into the Arabic UI reads as broken.
export function authErrorText(err: unknown, fallback: string, t: Translations, language: string): string {
  const e = (err as { errors?: unknown[] } | null)?.errors?.[0] ?? err;
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  switch (code) {
    case 'form_password_incorrect': return t.authErrPasswordIncorrect;
    case 'form_identifier_not_found': return t.authErrAccountNotFound;
    case 'form_code_incorrect':
    case 'verification_failed': return t.authCodeInvalid;
    case 'verification_expired': return t.authErrCodeExpired;
    case 'form_identifier_exists': return t.authErrEmailTaken;
    case 'form_password_pwned': return t.authErrPasswordBreached;
    case 'form_password_length_too_short': return t.authErrPasswordShort;
    case 'too_many_requests': return t.authErrTooMany;
  }
  return language === 'en' && message ? message : fallback;
}
