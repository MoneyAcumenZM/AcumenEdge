import cardPattern from '@/assets/card-pattern.svg';
import circleLogo from '@/assets/circle-logo-new.svg';
import aeciLogo from '@/assets/logos/aeci.webp';
import airtelLogo from '@/assets/logos/airtel.webp';
import bataLogo from '@/assets/logos/bata.webp';
import batLogo from '@/assets/logos/bat.webp';
import cecLogo from '@/assets/logos/cec.webp';
import cecaLogo from '@/assets/logos/copperbelt_energy.webp';
import chilangaLogo from '@/assets/logos/chilanga.webp';
import dotcomLogo from '@/assets/logos/dotcom.webp';
import madisonLogo from '@/assets/logos/madison.webp';
import zamefaLogo from '@/assets/logos/zamefa.webp';
import natbrewLogo from '@/assets/logos/natbrew.webp';
import pumaLogo from '@/assets/logos/puma.webp';
import reizLogo from '@/assets/logos/reiz.webp';
import shopriteLogo from '@/assets/logos/shoprite.webp';
import stanchartLogo from '@/assets/logos/stanchart.webp';
import zambeefLogo from '@/assets/logos/zambeef.webp';
import zambrewLogo from '@/assets/logos/zambian_breweries.webp';
import zafficoLogo from '@/assets/logos/zaffico.webp';
import zamsugarLogo from '@/assets/logos/zambia_sugar.webp';
import zamreLogo from '@/assets/logos/zamre.webp';
import zanacoLogo from '@/assets/logos/zanaco.webp';
import zccmLogo from '@/assets/logos/zccm.webp';
import pamodziLogo from '@/assets/logos/pamodzi.webp';

const logoMap: Record<string, string> = {
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

// Preload all logos into browser cache immediately
const logoCache = new Map<string, HTMLImageElement>();

function preloadAllLogos() {
  [cardPattern, circleLogo].forEach(src => {
    if (!logoCache.has(src)) {
      const img = new Image();
      img.src = src;
      logoCache.set(src, img);
    }
  });
  Object.entries(logoMap).forEach(([ticker, src]) => {
    if (logoCache.has(ticker)) return;
    const img = new Image();
    img.src = src;
    logoCache.set(ticker, img);
  });
}

preloadAllLogos();

export function getStockLogo(ticker: string): string | null {
  return logoMap[ticker] || null;
}

export function isLogoPreloaded(ticker: string): boolean {
  const img = logoCache.get(ticker);
  return img?.complete ?? false;
}

export default logoMap;
