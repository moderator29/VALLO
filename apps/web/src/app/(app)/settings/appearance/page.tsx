import type { Metadata } from "next";
import { forAppearance, forLanguage, forMotion } from "@/components/app/account/settings-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { AppearanceCard, LanguageRow } from "@/components/app/account/SettingsGroups";
import { SettingsGroup } from "@/components/app/account/rows";
import { ThemeControl } from "@/components/site/ThemeControl";
import { MotionSettings } from "@/components/app/account/MotionSettings";
import { SettingsLede } from "@/components/app/account/SettingsLede";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.appearance.label };
}

/**
 * Appearance: theme, text size, motion, data saver and the language, all held
 * on this device and applied to it.
 */
export default async function AppearanceSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <PageFrame
      title={t.settings.appearance.label}
      subtitle={t.settings.hub.appearanceSub}
      fallback="/settings"
      width="narrow"
    >
      {/* One child: the lede keeps its 16px foot above the theme. */}
      <div>
      <SettingsLede
        label={t.experienceAccount.settings.lede.what}
        what={t.experienceAccount.settings.lede.appearance.what}
        who={t.experienceAccount.settings.lede.appearance.who}
      />
      {/* THE THEME, first (light mode reintroduced 25 September 2026). The
          same control as the foot of the side navigation, so the choice made
          in either place is the choice shown in both. */}
      <section id="settings-theme" className="mb-block">
        <SettingsGroup label={t.settings.appearance.theme} note={t.experienceSettings.appearance.themeNote}>
          <div className="px-md py-sm">
            <ThemeControl
              labels={{
                group: t.settings.appearance.theme,
                light: t.settings.appearance.themeLight,
                dark: t.settings.appearance.themeDark,
                system: t.settings.appearance.themeSystem,
              }}
            />
          </div>
        </SettingsGroup>
      </section>
      {/* THE MOTION SETTING (Track M): four levels, three switches and a
          preview. It replaced a "Reduce motion" switch that did nothing. */}
      <section id="settings-motion" className="mb-block scroll-mt-28">
        <MotionSettings t={forMotion(t)} />
      </section>
      <section id="settings-appearance" className="scroll-mt-28">
        <AppearanceCard t={forAppearance(t)}>
          <LanguageRow t={forLanguage(t)} current={locale} />
        </AppearanceCard>
      </section>
      </div>
    </PageFrame>
  );
}
