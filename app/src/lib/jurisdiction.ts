/**
 * JURISDICTION
 *
 * BlueBox One is road-safety infrastructure, not Kerala software. The Kerala
 * dataset is one *deployment* of it, and everything that is true only of that
 * deployment lives here rather than being spelled into components.
 *
 * The rule this module exists to enforce:
 *
 *   No reusable component may hardcode "KL", "Kerala", "RTO", "Kochi", "IST",
 *   "km/h", "₹" or "Challan".
 *
 * A component asks the jurisdiction how to render a speed, an instant, a
 * currency amount or a notice, and the same screens then work unchanged when
 * the platform is demonstrated in Dubai, London, Singapore or New York.
 *
 * Note on units: telemetry, the speed rule and all stored evidence remain in
 * km/h — that is the device's native unit and changing it would alter the
 * enforcement logic. Imperial jurisdictions convert at the *presentation*
 * boundary only, which is exactly what a real deployment does.
 */

export type SpeedUnit = "km/h" | "mph";
export type DistanceUnit = "km" | "mi";

export interface Jurisdiction {
  id: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  country: string;
  /** State, emirate, province or metropolitan area. */
  region: string;
  /** The body that operates the deployment. */
  authorityName: string;
  authorityShort: string;
  /** Where enforcement notices are issued from, for the notice preview. */
  issuingOffice: string;
  locale: string;
  timezone: string;
  /** Short zone label shown beside clock readings. */
  timezoneLabel: string;
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  currency: string;
  /** What a citizen-facing enforcement notice is called locally. */
  noticeTerm: string;
  noticeTermPlural: string;
  /** Human-readable registration plate pattern, shown in search hints. */
  registrationFormat: string;
  registrationExample: string;
  /** Map home position and zoom for this deployment. */
  center: [number, number];
  zoom: number;
  /** Demonstration jurisdictions must always be labelled as such. */
  environment: "Demonstration" | "Production";
  /** Whether a dataset exists for this jurisdiction in the current build. */
  provisioned: boolean;
}

/**
 * The jurisdiction registry.
 *
 * Only Kerala is provisioned with data in this build. The others are declared
 * deliberately: they are what makes the jurisdiction selector an honest
 * product surface rather than a mock, and they prove the presentation layer
 * has no India-shaped assumptions baked into it — note the two imperial-unit
 * entries and the four distinct plate formats.
 */
export const JURISDICTIONS: Jurisdiction[] = [
  {
    id: "in-kl",
    countryCode: "IN",
    country: "India",
    region: "Kerala",
    authorityName: "Motor Vehicles Department",
    authorityShort: "MVD",
    issuingOffice: "Regional Transport Office, Ernakulam",
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    timezoneLabel: "IST",
    speedUnit: "km/h",
    distanceUnit: "km",
    currency: "INR",
    noticeTerm: "Traffic Challan",
    noticeTermPlural: "Traffic Challans",
    registrationFormat: "SS NN LL NNNN",
    registrationExample: "KL 07 AB 1289",
    center: [10.02, 76.33],
    zoom: 10,
    environment: "Demonstration",
    provisioned: true,
  },
  {
    id: "ae-du",
    countryCode: "AE",
    country: "United Arab Emirates",
    region: "Dubai",
    authorityName: "Roads and Transport Authority",
    authorityShort: "RTA",
    issuingOffice: "RTA Traffic Enforcement, Dubai",
    locale: "en-AE",
    timezone: "Asia/Dubai",
    timezoneLabel: "GST",
    speedUnit: "km/h",
    distanceUnit: "km",
    currency: "AED",
    noticeTerm: "Traffic Fine",
    noticeTermPlural: "Traffic Fines",
    registrationFormat: "C NNNNN",
    registrationExample: "A 41287",
    center: [25.2048, 55.2708],
    zoom: 10,
    environment: "Demonstration",
    provisioned: false,
  },
  {
    id: "gb-lon",
    countryCode: "GB",
    country: "United Kingdom",
    region: "London",
    authorityName: "Transport for London",
    authorityShort: "TfL",
    issuingOffice: "TfL Enforcement Centre, London",
    locale: "en-GB",
    timezone: "Europe/London",
    timezoneLabel: "GMT",
    speedUnit: "mph",
    distanceUnit: "mi",
    currency: "GBP",
    noticeTerm: "Notice of Intended Prosecution",
    noticeTermPlural: "Notices of Intended Prosecution",
    registrationFormat: "LLNN LLL",
    registrationExample: "LN71 ABC",
    center: [51.5072, -0.1276],
    zoom: 10,
    environment: "Demonstration",
    provisioned: false,
  },
  {
    id: "sg-sg",
    countryCode: "SG",
    country: "Singapore",
    region: "Singapore",
    authorityName: "Land Transport Authority",
    authorityShort: "LTA",
    issuingOffice: "LTA Enforcement, Singapore",
    locale: "en-SG",
    timezone: "Asia/Singapore",
    timezoneLabel: "SGT",
    speedUnit: "km/h",
    distanceUnit: "km",
    currency: "SGD",
    noticeTerm: "Traffic Offence Notice",
    noticeTermPlural: "Traffic Offence Notices",
    registrationFormat: "SLL NNNN L",
    registrationExample: "SLA 1234 X",
    center: [1.3521, 103.8198],
    zoom: 11,
    environment: "Demonstration",
    provisioned: false,
  },
  {
    id: "us-ny",
    countryCode: "US",
    country: "United States",
    region: "New York",
    authorityName: "Department of Transportation",
    authorityShort: "DOT",
    issuingOffice: "NYC DOT Enforcement, New York",
    locale: "en-US",
    timezone: "America/New_York",
    timezoneLabel: "ET",
    speedUnit: "mph",
    distanceUnit: "mi",
    currency: "USD",
    noticeTerm: "Notice of Violation",
    noticeTermPlural: "Notices of Violation",
    registrationFormat: "LLL NNNN",
    registrationExample: "JHK 4821",
    center: [40.7128, -74.006],
    zoom: 11,
    environment: "Demonstration",
    provisioned: false,
  },
];

export const DEFAULT_JURISDICTION_ID = "in-kl";

export function getJurisdiction(id: string): Jurisdiction {
  return JURISDICTIONS.find((item) => item.id === id) ?? JURISDICTIONS[0];
}

/** `Kerala, India` — the label used across chrome and headers. */
export function jurisdictionLabel(j: Jurisdiction) {
  return j.region === j.country ? j.country : `${j.region}, ${j.country}`;
}

/* -------------------------------------------------------------------------- */
/* Units                                                                      */
/* -------------------------------------------------------------------------- */

const KM_TO_MI = 0.621371;

/** Convert a stored km/h reading into the jurisdiction's display unit. */
export function toDisplaySpeed(kph: number, j: Jurisdiction) {
  return j.speedUnit === "mph" ? kph * KM_TO_MI : kph;
}

/** Convert a display-unit speed back to the km/h the rule engine works in. */
export function toStoredSpeed(value: number, j: Jurisdiction) {
  return j.speedUnit === "mph" ? value / KM_TO_MI : value;
}

/** A rounded speed reading with no unit — for large instrument numerals. */
export function speedValue(kph: number, j: Jurisdiction) {
  return Math.round(toDisplaySpeed(kph, j));
}

/** A speed with its unit, e.g. `92 km/h` or `57 mph`. */
export function formatSpeed(kph: number, j: Jurisdiction, options?: { decimals?: number }) {
  const value = toDisplaySpeed(kph, j);
  const decimals = options?.decimals ?? 0;
  return `${value.toFixed(decimals)} ${j.speedUnit}`;
}

export function formatDistance(km: number, j: Jurisdiction) {
  const value = j.distanceUnit === "mi" ? km * KM_TO_MI : km;
  return `${value.toLocaleString(j.locale, { maximumFractionDigits: 0 })} ${j.distanceUnit}`;
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Instants render in the jurisdiction's own zone and locale. An officer
 * correlates what they read here against radio traffic and paper records, so
 * an ambiguous or foreign-zone timestamp is worse than a verbose one.
 */
export function formatTime(value: string, j: Jurisdiction, options?: { seconds?: boolean }) {
  return new Intl.DateTimeFormat(j.locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: options?.seconds === false ? undefined : "2-digit",
    hour12: false,
    timeZone: j.timezone,
  }).format(new Date(value));
}

export function formatDate(value: string, j: Jurisdiction) {
  return new Intl.DateTimeFormat(j.locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: j.timezone,
  }).format(new Date(value));
}

export function formatDateTime(value: string, j: Jurisdiction) {
  return `${formatDate(value, j)} · ${formatTime(value, j)}`;
}

/** Timestamped to the millisecond — for evidence records and audit entries. */
export function formatPrecise(value: string, j: Jurisdiction) {
  const date = new Date(value);
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${formatTime(value, j)}.${ms}`;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export function formatCurrency(amount: number, j: Jurisdiction) {
  return new Intl.NumberFormat(j.locale, {
    style: "currency",
    currency: j.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

export function formatNumber(value: number, j: Jurisdiction) {
  return value.toLocaleString(j.locale);
}

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Plates are stored spaced (`KL 01 AB 1234`) but often searched unspaced
 * (`KL01AB1234`). Normalising both sides is what makes registry lookup feel
 * instant regardless of how the officer types it.
 */
export function normalisePlate(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function plateMatches(plate: string, query: string) {
  return normalisePlate(plate).includes(normalisePlate(query));
}
