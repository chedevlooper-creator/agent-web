import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = routing.defaultLocale;

  // requestLocale is set by the middleware when localePrefix is "never"
  const detected = await requestLocale;
  if (routing.locales.includes(detected as typeof routing.locales[number])) {
    locale = detected as typeof routing.locales[number];
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
