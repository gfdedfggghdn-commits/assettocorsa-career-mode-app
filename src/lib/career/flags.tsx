/** Maps a free-text nationality (name, 2- or 3-letter code) to an emoji flag. */

const ISO3_TO_ISO2: Record<string, string> = {
  ALB: "AL", ARE: "AE", ARG: "AR", AUS: "AU", AUT: "AT", AZE: "AZ", BEL: "BE", BGR: "BG",
  BHR: "BH", BRA: "BR", CAN: "CA", CHE: "CH", CHL: "CL", CHN: "CN", COL: "CO", CZE: "CZ",
  DEU: "DE", DNK: "DK", ESP: "ES", EST: "EE", FIN: "FI", FRA: "FR", GBR: "GB", GRC: "GR",
  HKG: "HK", HRV: "HR", HUN: "HU", IDN: "ID", IND: "IN", IRL: "IE", ISR: "IL", ITA: "IT",
  JPN: "JP", KOR: "KR", LTU: "LT", LUX: "LU", LVA: "LV", MAR: "MA", MCO: "MC", MEX: "MX",
  MYS: "MY", NLD: "NL", NOR: "NO", NZL: "NZ", PER: "PE", POL: "PL", PRT: "PT", QAT: "QA",
  ROU: "RO", RUS: "RU", SAU: "SA", SGP: "SG", SRB: "RS", SVK: "SK", SVN: "SI", SWE: "SE",
  THA: "TH", TUR: "TR", UKR: "UA", URY: "UY", USA: "US", VEN: "VE", VNM: "VN", ZAF: "ZA",
};

const NAME_TO_ISO2: Record<string, string> = {
  albania: "AL", argentina: "AR", australia: "AU", australian: "AU", austria: "AT", austrian: "AT",
  azerbaijan: "AZ", bahrain: "BH", belgium: "BE", belgian: "BE", brazil: "BR", brazilian: "BR",
  bulgaria: "BG", canada: "CA", canadian: "CA", chile: "CL", china: "CN", chinese: "CN",
  colombia: "CO", croatia: "HR", czechia: "CZ", czechrepublic: "CZ", denmark: "DK", danish: "DK",
  estonia: "EE", finland: "FI", finnish: "FI", france: "FR", french: "FR", germany: "DE",
  german: "DE", greece: "GR", hongkong: "HK", hungary: "HU", hungarian: "HU", india: "IN",
  indian: "IN", indonesia: "ID", ireland: "IE", irish: "IE", israel: "IL", italy: "IT",
  italian: "IT", japan: "JP", japanese: "JP", korea: "KR", southkorea: "KR", latvia: "LV",
  lithuania: "LT", luxembourg: "LU", malaysia: "MY", mexico: "MX", mexican: "MX", monaco: "MC",
  monegasque: "MC", morocco: "MA", netherlands: "NL", dutch: "NL", holland: "NL",
  newzealand: "NZ", norway: "NO", peru: "PE", poland: "PL", polish: "PL", portugal: "PT",
  portuguese: "PT", qatar: "QA", romania: "RO", russia: "RU", russian: "RU", saudiarabia: "SA",
  serbia: "RS", singapore: "SG", slovakia: "SK", slovenia: "SI", southafrica: "ZA", spain: "ES",
  spanish: "ES", sweden: "SE", swedish: "SE", switzerland: "CH", swiss: "CH", thailand: "TH",
  turkey: "TR", ukraine: "UA", unitedarabemirates: "AE", uae: "AE", abudhabi: "AE",
  unitedkingdom: "GB", greatbritain: "GB", britain: "GB", british: "GB",
  unitedstates: "US", usa: "US", american: "US", uruguay: "UY", venezuela: "VE", vietnam: "VN",
};

const clean = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

/** Every ISO region Intl knows (all countries, territories, Antarctica, EU...), keyed by cleaned English name. */
const ALL_REGIONS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const A = 65;
    for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      const name = dn.of(code);
      if (name && name !== code && !/unknown/i.test(name)) out[clean(name)] = code;
    }
  } catch { /* old browser: fall back to the fixed list */ }
  return out;
})();

/** Extra aliases and demonyms not covered by the region names. */
const EXTRA: Record<string, string> = {
  europe: "EU", european: "EU", europeanunion: "EU", antarctic: "AQ", antarctican: "AQ",
  haitian: "HT", botswanan: "BW", greenlandic: "GL", westernsahara: "EH", sahrawi: "EH",
  ivorycoast: "CI", cotedivoire: "CI", czech: "CZ", northkorea: "KP", burma: "MM", swaziland: "SZ",
  macedonia: "MK", vatican: "VA", holysee: "VA", palestine: "PS", taiwan: "TW", kosovo: "XK",
  congo: "CG", drcongo: "CD", democraticrepublicofthecongo: "CD", capeverde: "CV", eastimor: "TL",
  turkiye: "TR", russianfederation: "RU", unitedstatesofamerica: "US", us: "US", uk: "GB",
  argentine: "AR", argentinian: "AR", venezuelan: "VE", colombian: "CO", chilean: "CL", thai: "TH",
  indonesian: "ID", malaysian: "MY", singaporean: "SG", emirati: "AE", saudi: "SA", israeli: "IL",
  luxembourgish: "LU", liechtensteiner: "LI", hungarian: "HU", estonian: "EE", latvian: "LV",
  lithuanian: "LT", ukrainian: "UA", serbian: "RS", croatian: "HR", slovenian: "SI", slovak: "SK",
  bulgarian: "BG", romanian: "RO", greek: "GR", turkish: "TR", moroccan: "MA", southafrican: "ZA",
  newzealander: "NZ", kiwi: "NZ", norwegian: "NO", icelandic: "IS", korean: "KR", vietnamese: "VN",
  filipino: "PH", peruvian: "PE", uruguayan: "UY", paraguayan: "PY", ecuadorian: "EC", cuban: "CU",
  jamaican: "JM", egyptian: "EG", nigerian: "NG", kenyan: "KE", zimbabwean: "ZW", qatari: "QA",
  bahraini: "BH", azerbaijani: "AZ", andorran: "AD", sanmarinese: "SM", maltese: "MT", cypriot: "CY",
};

/** Subdivision flags (emoji tag sequences). */
const SUBDIVISIONS: Record<string, { code: string; tag: string }> = {
  england: { code: "GB-ENG", tag: "gbeng" }, english: { code: "GB-ENG", tag: "gbeng" },
  scotland: { code: "GB-SCT", tag: "gbsct" }, scottish: { code: "GB-SCT", tag: "gbsct" }, scot: { code: "GB-SCT", tag: "gbsct" },
  wales: { code: "GB-WLS", tag: "gbwls" }, welsh: { code: "GB-WLS", tag: "gbwls" },
};

const tagFlag = (tag: string) =>
  "\u{1F3F4}" + [...tag].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("") + "\u{E007F}";


export function countryCode(input: string | undefined | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  const key = clean(raw);
  if (!key) return null;
  if (SUBDIVISIONS[key]) return SUBDIVISIONS[key]!.code;
  if (/^gb(eng|sct|wls)$/.test(key)) return `GB-${key.slice(2).toUpperCase()}`;
  if (key.length === 2) return key.toUpperCase();
  if (key.length === 3 && ISO3_TO_ISO2[key.toUpperCase()]) return ISO3_TO_ISO2[key.toUpperCase()]!;
  return NAME_TO_ISO2[key] ?? EXTRA[key] ?? ALL_REGIONS[key] ?? null;
}

/** Regional-indicator emoji flag, or null when the country is not recognised. */
export function flagEmoji(input: string | undefined | null): string | null {
  const code = countryCode(input);
  if (code?.startsWith("GB-")) return tagFlag(code.replace("-", "").toLowerCase());
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function Flag({ nationality, className }: { nationality?: string | null; className?: string }) {
  const emoji = flagEmoji(nationality);
  return (
    <span
      title={nationality ?? undefined}
      aria-label={nationality ?? "unknown nationality"}
      className={`inline-block w-6 shrink-0 text-center leading-none ${className ?? ""}`}
    >
      {emoji ?? "—"}
    </span>
  );
}
