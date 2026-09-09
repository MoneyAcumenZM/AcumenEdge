/**
 * Centralized image preloader and cache.
 * All stock logos and app logos are preloaded during splash screen
 * and served from browser memory cache thereafter.
 */

import aeciLogo from '@/assets/logos/aeci.webp';
import airtelLogo from '@/assets/logos/airtel.webp';
import batLogo from '@/assets/logos/bat.webp';
import bataLogo from '@/assets/logos/bata.webp';
import cecLogo from '@/assets/logos/cec.webp';
import cecaLogo from '@/assets/logos/copperbelt_energy.webp';
import chilangaLogo from '@/assets/logos/chilanga.webp';
import dotcomLogo from '@/assets/logos/dotcom.webp';
import madisonLogo from '@/assets/logos/madison.webp';
import natbrewLogo from '@/assets/logos/natbrew.webp';
import pamodziLogo from '@/assets/logos/pamodzi.webp';
import pumaLogo from '@/assets/logos/puma.webp';
import reizLogo from '@/assets/logos/reiz.webp';
import shopriteLogo from '@/assets/logos/shoprite.webp';
import stanchartLogo from '@/assets/logos/stanchart.webp';
import zafficoLogo from '@/assets/logos/zaffico.webp';
import zambeefLogo from '@/assets/logos/zambeef.webp';
import zamsugarLogo from '@/assets/logos/zambia_sugar.webp';
import zambrewLogo from '@/assets/logos/zambian_breweries.webp';
import zamefaLogo from '@/assets/logos/zamefa.webp';
import zamreLogo from '@/assets/logos/zamre.webp';
import zanacoLogo from '@/assets/logos/zanaco.webp';
import zccmLogo from '@/assets/logos/zccm.webp';
import moneyAcumenLogo from '@/assets/money-acumen-logo.webp';
import luseLogo from '@/assets/luse-logo.webp';
import cardPattern from '@/assets/card-pattern.svg';
import circleLogo from '@/assets/circle-logo-new.svg';

const imageCache = new Map<string, HTMLImageElement>();

const ALL_IMAGES: Record<string, string> = {
  // App logos
  MAA_LOGO: moneyAcumenLogo,
  MAA_ICON: moneyAcumenLogo,
  LUSE_LOGO: luseLogo,
  CARD_PATTERN: cardPattern,
  CIRCLE_LOGO: circleLogo,
  // Stock logos
  AECI: aeciLogo,
  AIRTEL: airtelLogo,
  ATEL: airtelLogo,
  BATA: bataLogo,
  BATZ: batLogo,
  CEC: cecLogo,
  CECZ: cecLogo,
  CECA: cecaLogo,
  CHIL: chilangaLogo,
  DCMS: dotcomLogo,
  DCZM: dotcomLogo,
  MAFS: madisonLogo,
  NATBREW: natbrewLogo,
  NATB: natbrewLogo,
  PUMA: pumaLogo,
  PMDZ: pamodziLogo,
  REIZ: reizLogo,
  REIZUSD: reizLogo,
  SHOPRITE: shopriteLogo,
  SHOP: shopriteLogo,
  SCBL: stanchartLogo,
  ZAMBEEF: zambeefLogo,
  ZMBF: zambeefLogo,
  ZMFA: zamefaLogo,
  ZABR: zambrewLogo,
  ZFCO: zafficoLogo,
  ZSUG: zamsugarLogo,
  ZMRE: zamreLogo,
  ZANACO: zanacoLogo,
  ZNCO: zanacoLogo,
  ZCCM: zccmLogo,
  'ZCCM-IH': zccmLogo,
};

export async function preloadAllImages(): Promise<void> {
  const uniqueSrcs = new Set(Object.values(ALL_IMAGES));
  await Promise.all(
    Array.from(uniqueSrcs).map(
      (src) =>
        new Promise<void>((resolve) => {
          if (imageCache.has(src)) {
            resolve();
            return;
          }
          const img = new Image();
          img.onload = () => {
            imageCache.set(src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        })
    )
  );
}

export function getImage(key: string): string {
  return ALL_IMAGES[key] || '';
}

export function isImagePreloaded(key: string): boolean {
  const src = ALL_IMAGES[key];
  if (!src) return false;
  const img = imageCache.get(src);
  return img?.complete ?? false;
}

export { ALL_IMAGES };
export default ALL_IMAGES;
