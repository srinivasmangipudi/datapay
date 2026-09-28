import { DataPayLogo } from "./components/DataPayLogo";
import { PublicNav } from "./components/PublicNav";
import { getCatalogPreview } from "./lib/catalog-preview";
import { getPrivacyFloor } from "./lib/privacy-floor";
import type { Lang } from "./lib/language";
import { SystemDiagram } from "./SystemDiagram";

/** The open-testing listing. Same package name as apps/mobile's applicationId —
    if that ever changes, this link dies silently, so they change together. */
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=org.datapay.mobile";

/**
 * Deep-substitutes "{floor}" through a content tree, preserving its shape.
 * The generic keeps every caller's exact type, so `t.buySteps[0].title` still
 * typechecks as a string after passing through.
 */
function fillFloor<T>(value: T, floor: number): T {
  if (typeof value === "string") {
    return value.replaceAll("{floor}", String(floor)) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => fillFloor(v, floor)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = fillFloor(v, floor);
    return out as T;
  }
  return value;
}

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** A phone showing the Pulse question card — an illustration of the real
    flow (question, three intent answers, token reward), not a screenshot. */
function PhoneMock({ lang }: { lang: Lang }): JSX.Element {
  const t = CONTENT[lang].phone;
  return (
    <div className="mkPhoneWrap" aria-hidden="true">
      <div className="mkPhoneGlow" />
      <div className="mkPhone">
        <div className="mkPhoneScreen">
          <div className="mkPhoneTop">
            <span className="mkPhoneBrand">DataPay</span>
            <span className="mkPhoneTokens">◈ 128</span>
          </div>
          <p className="mkPhoneEyebrow">{t.eyebrow}</p>
          <div className="mkPhoneCard">
            <p className="mkPhoneQ">{t.question}</p>
            <div className="mkPhoneChips">
              <span className="mkPhoneChip mkPhoneChipOn">{t.yes}</span>
              <span className="mkPhoneChip">{t.maybe}</span>
              <span className="mkPhoneChip">{t.no}</span>
            </div>
          </div>
          <div className="mkPhoneReward">
            <span className="mkPhoneRewardIcon">◈</span>
            <span>{t.reward}</span>
          </div>
          <div className="mkPhoneNote">{t.note}</div>
        </div>
      </div>
    </div>
  );
}

function AppleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <mask id="mkAppleBite">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <circle cx="16.6" cy="9.2" r="3.6" fill="black" />
      </mask>
      <g mask="url(#mkAppleBite)">
        <circle cx="9" cy="13.6" r="6" fill="currentColor" />
        <circle cx="15" cy="13.6" r="6" fill="currentColor" />
      </g>
      <rect x="11.2" y="2.4" width="1.6" height="4.4" rx="0.8" fill="currentColor" />
      <ellipse cx="15.6" cy="4.4" rx="2.6" ry="1.4" transform="rotate(-35 15.6 4.4)" fill="currentColor" />
    </svg>
  );
}

function AndroidIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M5.5 3.4c-.4-.2-.9-.2-1.2.1-.4.2-.6.6-.6 1v15c0 .4.2.8.6 1 .3.3.8.3 1.2.1l12.6-8.5c.3-.2.5-.6.5-.9 0-.4-.2-.7-.5-.9L5.5 3.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--mk-jade-tint)" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        fill="none"
        stroke="var(--mk-jade)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = [
  <path
    key="1"
    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="2"
    d="M12 2l8 3.5v5c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-5L12 2z"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="3"
    d="M4 19V9M11 19V4M18 19v-7"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="4"
    d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
];

// Kannada strings below are a first machine-assisted draft, same posture as
// apps/mobile/src/i18n/strings.ts's own header comment: a starting point,
// not a finished translation — worth a native-speaker review before being
// treated as final copy. The SVG system diagram's own internal labels stay
// English-only for now; translating fixed-width SVG text risks visual
// overflow that needs per-language layout verification this pass didn't do.
const CONTENT = {
  en: {
    tagline: "Your data is your asset",
    heroTitle: "Real household demand, direct from real households",
    heroLede:
      "DataPay turns a few daily questions from local households into honest, aggregated demand signals — and gives organizations a direct channel to that same community: run priced survey questions, or list your own products for households to browse and reserve.",
    ctaSignup: "Sign up your organization",
    ctaHowItWorks: "See how it works",
    getApp: "Get the DataPay app",
    doorHousehold: "For households",
    doorHouseholdBody:
      "When your village wants the same thing, you buy it together — better quality at a better price than any one household gets alone. Answer a few short questions a day to make that happen, and earn tokens while you do.",
    doorHouseholdNote: "Everything happens in the app — there is nothing to sign up for here.",
    doorOrg: "For organizations",
    doorOrgBody:
      "Reach real, verified local demand. List products, ask your own questions, see aggregated answers.",
    doorOrgNote: "Business accounts only. Households don't need one.",
    comingSoon: "Coming soon",
    openBeta: "Open beta",
    betaNote: "DataPay is in open beta. Everything here is real — real questions, real catalogs, real tokens — but expect rough edges, and tell us when you find one.",
    heroKicker: "Household demand, collectivised",
    phone: {
      eyebrow: "Today's question",
      question: "Are you planning to buy a solar light in the next 3 months?",
      yes: "Yes",
      maybe: "Maybe",
      no: "No",
      reward: "+2 tokens for answering",
      note: "Answers leave as an alias — never your name or number.",
    },
    trust: [
      { stat: null, label: "households minimum before any number is published" },
      { stat: "0", label: "names, numbers or addresses ever shared with a brand" },
      { stat: "100%", label: "of demand data published as aggregates only" },
    ],
    buyEyebrow: "The part that pays off immediately",
    buyTitle: "Buy together, pay less, get better quality",
    buyLede:
      "A single household has no bargaining power. A hundred households wanting the same 5kg of rice do. DataPay finds where that demand overlaps and takes it to suppliers as one order — so the price drops and the quality goes up, for everyone in it.",
    buySteps: [
      {
        title: "You answer, honestly",
        body: "A few seconds a day. What your household actually buys and needs — no names attached, ever.",
      },
      {
        title: "Your village's demand adds up",
        body: "Answers combine into one real, verified order that a supplier genuinely wants to serve well.",
      },
      {
        title: "Everyone gets the better price",
        body: "The collective price, not the corner-shop price — and you keep the tokens you earned getting there.",
      },
    ],
    catalogEyebrow: "Live on DataPay",
    catalogTitle: "Real products, listed by real organizations",
    catalogLede:
      "Not a mockup — this is the live catalog from an organization on DataPay right now, at the prices households actually see.",
    catalogCta: "Browse the full catalog →",
    catalogBy: "Listed by",
    howEyebrow: "How it works",
    howTitle: "From a household's answer to a real business decision",
    steps: [
      { title: "Answer & browse", text: "A few daily questions, a token reward for each — plus a real product catalog to browse and reserve." },
      { title: "Aggregated privately", text: "Every answer is tied to a private alias only — never a name or phone number an organization could see." },
      { title: "Real signals surface", text: "A number only ever publishes once at least {floor} households stand behind it — never one household alone." },
      { title: "Organizations respond", text: "Ask priced questions, or list products directly — households browse and reserve, no middleman." },
    ],
    benefitsEyebrow: "Why DataPay",
    benefitsTitle: "Real benefits, for everyone in the loop",
    benefitsHouseholds: "For households",
    benefitsOrganizations: "For organizations",
    householdBenefits: [
      { title: "Earn tokens for answering", text: "Small, real rewards for a few minutes a day — no strings attached." },
      { title: "Better prices, locally", text: "Combined demand gives your area real bargaining power with suppliers." },
      { title: "A real say in what's stocked", text: "Organizations see what your community actually needs, not what a distributor assumes." },
      { title: "Browse and reserve real products", text: "A genuine catalog, fair pricing, no in-app payment required." },
      { title: "Total privacy", text: "Only ever a private alias leaves the vault — never your name, phone, or exact location." },
      { title: "You're always in control", text: "Turn off any category of data sharing, any time." },
    ],
    orgBenefits: [
      { title: "Real demand, not guesses", text: "Every number is a genuine aggregated signal from real households — never a survey panel or estimate." },
      { title: "Ask your own questions", text: "Set a token reward and get direct answers from the community that matters to you." },
      { title: "Sell directly", text: "List your catalog and let households browse and reserve — no distributor markup." },
      { title: "Privacy-safe by design", text: "You never see a household's identity — only anonymized cohorts above the published minimum." },
      { title: "Fast to start", text: "No SDK, no integration work — sign up, get approved, and you're live." },
      { title: "Full control over spend", text: "You set your own reward per question — you only pay for what you ask." },
    ],
    benefitsEcosystem: "For the market",
    ecosystemBenefits: [
      { title: "Make what people actually want", text: "Producers see real demand before they commit a season or a production run — not after." },
      { title: "Less waste", text: "Stock matched to real local demand means less spoilage, fewer unsold runs, fewer dead products." },
      { title: "Shorter chains", text: "Producers reach households directly, so fewer intermediaries take a cut of the same rupee." },
      { title: "Advertising that isn't guesswork", text: "Reaching people who already declared the need beats broadcasting to everyone who didn't." },
      { title: "Innovation aimed at real gaps", text: "Unmet demand shows up as a visible signal, not a hunch someone has to fund on faith." },
      { title: "A market that self-corrects", text: "When demand is visible and honest, supply moves toward it — instead of pushing what's already made." },
    ],
    systemEyebrow: "The system",
    systemTitle: "Two flows, always — data up, value back down",
    systemLede: "Households never deal with organizations directly, and organizations never see a household directly. DataPay sits in between, on purpose.",
    orgsEyebrow: "For organizations",
    orgsTitle: "A direct channel to real local demand",
    cards: [
      { title: "Ask real households real questions", text: "Set your own token reward per question. Every submission is reviewed before it reaches anyone — never auto-published." },
      { title: "List your own products", text: "Point at a spreadsheet or add items by hand; households browse and reserve directly. Fulfillment happens outside the app — no in-app payment to set up." },
      { title: "See real demand, not guesses", text: "Aggregated signals only ever publish once at least {floor} households stand behind a number — never one household's data alone." },
    ],
    protectionEyebrow: "Data protection",
    protectionTitle: "Privacy isn't a policy here — it's the architecture",
    protectionItems: [
      { title: "Private alias, always.", text: "Organizations only ever see an alias — never a name, phone number, or address." },
      { title: "Cohort floor of {floor}.", text: "No number publishes until at least {floor} households stand behind it." },
      { title: "No raw location stored.", text: "Approximate area only, used to match the nearest zone — never exact coordinates." },
      { title: "You control sharing.", text: "Every category of data sharing can be turned off, any time, in the app." },
    ],
    protectionLink: "Read the full privacy policy →",
    aboutEyebrow: "About",
    aboutTitle: "Built for households first",
    aboutLede:
      "DataPay started from a simple idea: the data that already describes what a community needs is valuable, and the household generating it should be the one who benefits — in tokens, in better local availability, and in never being sold as a name and a phone number.",
    aboutLink: "More about DataPay →",
    finalTitle: "Ready to reach real local demand?",
    ctaRegistry: "See the public demand registry",
    footerLinks: {
      about: "About",
      privacy: "Privacy",
      delete: "Delete account",
      childSafety: "Child safety",
      registry: "Demand registry",
      orgLogin: "Organization login",
      contact: "Contact",
      brand: "Brand & assets",
      android: "Android app",
      ios: "iOS — coming soon",
    },
  },
  kn: {
    tagline: "ನಿಮ್ಮ ಡೇಟಾ ನಿಮ್ಮ ಆಸ್ತಿ",
    heroTitle: "ನಿಜವಾದ ಮನೆಗಳ ನಿಜವಾದ ಬೇಡಿಕೆ, ನೇರವಾಗಿ ನಿಮಗೆ",
    heroLede:
      "DataPay ಸ್ಥಳೀಯ ಮನೆಗಳ ಕೆಲವು ದೈನಂದಿನ ಪ್ರಶ್ನೆಗಳನ್ನು ಪ್ರಾಮಾಣಿಕ, ಒಟ್ಟುಗೂಡಿಸಿದ ಬೇಡಿಕೆ ಸಂಕೇತಗಳಾಗಿ ಪರಿವರ್ತಿಸುತ್ತದೆ — ಮತ್ತು ಅದೇ ಸಮುದಾಯಕ್ಕೆ ಸಂಸ್ಥೆಗಳಿಗೆ ನೇರ ಮಾರ್ಗವನ್ನು ನೀಡುತ್ತದೆ: ಬೆಲೆ ನಿಗದಿತ ಸಮೀಕ್ಷೆ ಪ್ರಶ್ನೆಗಳನ್ನು ನಡೆಸಿ, ಅಥವಾ ಮನೆಗಳು ವೀಕ್ಷಿಸಲು ಮತ್ತು ಕಾಯ್ದಿರಿಸಲು ನಿಮ್ಮ ಸ್ವಂತ ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ.",
    ctaSignup: "ನಿಮ್ಮ ಸಂಸ್ಥೆಯನ್ನು ಸೈನ್ ಅಪ್ ಮಾಡಿ",
    ctaHowItWorks: "ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂದು ನೋಡಿ",
    getApp: "DataPay ಆ್ಯಪ್ ಪಡೆಯಿರಿ",
    doorHousehold: "ಮನೆಗಳಿಗಾಗಿ",
    doorHouseholdBody:
      "ನಿಮ್ಮ ಊರಿನವರೆಲ್ಲ ಒಂದೇ ವಸ್ತು ಬಯಸಿದಾಗ, ಒಟ್ಟಿಗೆ ಖರೀದಿಸಿ — ಒಬ್ಬರೇ ಖರೀದಿಸುವುದಕ್ಕಿಂತ ಉತ್ತಮ ಗುಣಮಟ್ಟ, ಕಡಿಮೆ ಬೆಲೆ. ದಿನಕ್ಕೆ ಕೆಲವು ಸಣ್ಣ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ ಮತ್ತು ಟೋಕನ್‌ಗಳನ್ನು ಗಳಿಸಿ.",
    doorHouseholdNote: "ಎಲ್ಲವೂ ಆ್ಯಪ್‌ನಲ್ಲಿ ನಡೆಯುತ್ತದೆ — ಇಲ್ಲಿ ಸೈನ್ ಅಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.",
    doorOrg: "ಸಂಸ್ಥೆಗಳಿಗಾಗಿ",
    doorOrgBody:
      "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಯನ್ನು ತಲುಪಿ. ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ, ನಿಮ್ಮದೇ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.",
    doorOrgNote: "ವ್ಯಾಪಾರ ಖಾತೆಗಳಿಗೆ ಮಾತ್ರ. ಮನೆಗಳಿಗೆ ಇದರ ಅಗತ್ಯವಿಲ್ಲ.",
    comingSoon: "ಶೀಘ್ರದಲ್ಲಿ ಬರಲಿದೆ",
    openBeta: "ಓಪನ್ ಬೀಟಾ",
    betaNote: "DataPay ಓಪನ್ ಬೀಟಾದಲ್ಲಿದೆ. ಇಲ್ಲಿರುವುದೆಲ್ಲವೂ ನಿಜ — ನಿಜವಾದ ಪ್ರಶ್ನೆಗಳು, ನಿಜವಾದ ಪಟ್ಟಿಗಳು, ನಿಜವಾದ ಟೋಕನ್‌ಗಳು — ಆದರೆ ಕೆಲವು ಸಣ್ಣ ದೋಷಗಳಿರಬಹುದು; ಕಂಡರೆ ನಮಗೆ ತಿಳಿಸಿ.",
    heroKicker: "ಮನೆಗಳ ಬೇಡಿಕೆ, ಒಟ್ಟಾಗಿ",
    phone: {
      eyebrow: "ಇಂದಿನ ಪ್ರಶ್ನೆ",
      question: "ಮುಂದಿನ 3 ತಿಂಗಳಲ್ಲಿ ಸೋಲಾರ್ ಲೈಟ್ ಖರೀದಿಸುವ ಯೋಜನೆ ಇದೆಯೇ?",
      yes: "ಹೌದು",
      maybe: "ಬಹುಶಃ",
      no: "ಇಲ್ಲ",
      reward: "ಉತ್ತರಿಸಿದ್ದಕ್ಕೆ +2 ಟೋಕನ್",
      note: "ಉತ್ತರಗಳು ಅಲಿಯಾಸ್ ಆಗಿ ಹೋಗುತ್ತವೆ — ನಿಮ್ಮ ಹೆಸರು ಅಥವಾ ಸಂಖ್ಯೆ ಎಂದಿಗೂ ಅಲ್ಲ.",
    },
    trust: [
      { stat: null, label: "ಯಾವುದೇ ಸಂಖ್ಯೆ ಪ್ರಕಟವಾಗುವ ಮೊದಲು ಕನಿಷ್ಠ ಇಷ್ಟು ಮನೆಗಳು" },
      { stat: "0", label: "ಬ್ರ್ಯಾಂಡ್‌ಗೆ ಹಂಚಿಕೊಂಡ ಹೆಸರು, ಸಂಖ್ಯೆ ಅಥವಾ ವಿಳಾಸ" },
      { stat: "100%", label: "ಬೇಡಿಕೆ ಡೇಟಾ ಒಟ್ಟುಗೂಡಿಸಿದ ರೂಪದಲ್ಲಿ ಮಾತ್ರ ಪ್ರಕಟ" },
    ],
    buyEyebrow: "ತಕ್ಷಣವೇ ಪ್ರಯೋಜನ ಸಿಗುವ ಭಾಗ",
    buyTitle: "ಒಟ್ಟಿಗೆ ಖರೀದಿಸಿ, ಕಡಿಮೆ ಪಾವತಿಸಿ, ಉತ್ತಮ ಗುಣಮಟ್ಟ ಪಡೆಯಿರಿ",
    buyLede:
      "ಒಂದೇ ಮನೆಗೆ ಚೌಕಾಸಿ ಶಕ್ತಿ ಇಲ್ಲ. ಆದರೆ ಒಂದೇ 5 ಕೆಜಿ ಅಕ್ಕಿ ಬಯಸುವ ನೂರು ಮನೆಗಳಿಗೆ ಇದೆ. DataPay ಆ ಬೇಡಿಕೆಯನ್ನು ಒಟ್ಟುಗೂಡಿಸಿ ಒಂದೇ ಆರ್ಡರ್ ಆಗಿ ಪೂರೈಕೆದಾರರಿಗೆ ಕೊಂಡೊಯ್ಯುತ್ತದೆ — ಬೆಲೆ ಕಡಿಮೆಯಾಗುತ್ತದೆ, ಗುಣಮಟ್ಟ ಹೆಚ್ಚಾಗುತ್ತದೆ.",
    buySteps: [
      {
        title: "ನೀವು ಪ್ರಾಮಾಣಿಕವಾಗಿ ಉತ್ತರಿಸಿ",
        body: "ದಿನಕ್ಕೆ ಕೆಲವು ಸೆಕೆಂಡುಗಳು. ನಿಮ್ಮ ಮನೆ ನಿಜವಾಗಿ ಏನು ಖರೀದಿಸುತ್ತದೆ — ಹೆಸರು ಎಂದಿಗೂ ಸೇರಿಸುವುದಿಲ್ಲ.",
      },
      {
        title: "ನಿಮ್ಮ ಊರಿನ ಬೇಡಿಕೆ ಸೇರುತ್ತದೆ",
        body: "ಉತ್ತರಗಳು ಒಂದೇ ನಿಜವಾದ ಆರ್ಡರ್ ಆಗಿ ಸೇರುತ್ತವೆ, ಪೂರೈಕೆದಾರರು ಚೆನ್ನಾಗಿ ಸೇವೆ ಸಲ್ಲಿಸಲು ಬಯಸುತ್ತಾರೆ.",
      },
      {
        title: "ಎಲ್ಲರಿಗೂ ಉತ್ತಮ ಬೆಲೆ",
        body: "ಅಂಗಡಿ ಬೆಲೆ ಅಲ್ಲ, ಸಾಮೂಹಿಕ ಬೆಲೆ — ಮತ್ತು ಗಳಿಸಿದ ಟೋಕನ್‌ಗಳು ನಿಮ್ಮಲ್ಲೇ ಉಳಿಯುತ್ತವೆ.",
      },
    ],
    catalogEyebrow: "DataPay ನಲ್ಲಿ ಲೈವ್",
    catalogTitle: "ನಿಜವಾದ ಸಂಸ್ಥೆಗಳು ಪಟ್ಟಿ ಮಾಡಿದ ನಿಜವಾದ ಉತ್ಪನ್ನಗಳು",
    catalogLede:
      "ಇದು ಮಾದರಿಯಲ್ಲ — ಇದು ಈಗ DataPay ನಲ್ಲಿರುವ ಒಂದು ಸಂಸ್ಥೆಯ ನಿಜವಾದ ಪಟ್ಟಿ, ಮನೆಗಳು ನೋಡುವ ಅದೇ ಬೆಲೆಗಳಲ್ಲಿ.",
    catalogCta: "ಸಂಪೂರ್ಣ ಪಟ್ಟಿಯನ್ನು ನೋಡಿ →",
    catalogBy: "ಪಟ್ಟಿ ಮಾಡಿದವರು",
    howEyebrow: "ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    howTitle: "ಒಂದು ಮನೆಯ ಉತ್ತರದಿಂದ ನಿಜವಾದ ವ್ಯಾಪಾರ ನಿರ್ಧಾರದವರೆಗೆ",
    steps: [
      { title: "ಉತ್ತರಿಸಿ ಮತ್ತು ಬ್ರೌಸ್ ಮಾಡಿ", text: "ಕೆಲವು ದೈನಂದಿನ ಪ್ರಶ್ನೆಗಳು, ಪ್ರತಿಯೊಂದಕ್ಕೂ ಟೋಕನ್ ಬಹುಮಾನ — ಜೊತೆಗೆ ಬ್ರೌಸ್ ಮಾಡಲು ಮತ್ತು ಕಾಯ್ದಿರಿಸಲು ನಿಜವಾದ ಉತ್ಪನ್ನ ಪಟ್ಟಿ." },
      { title: "ಖಾಸಗಿಯಾಗಿ ಒಟ್ಟುಗೂಡಿಸಲಾಗಿದೆ", text: "ಪ್ರತಿ ಉತ್ತರವು ಖಾಸಗಿ ಅಲಿಯಾಸ್‌ಗೆ ಮಾತ್ರ ಸಂಬಂಧಿಸಿದೆ — ಸಂಸ್ಥೆಯು ನೋಡಬಹುದಾದ ಹೆಸರು ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "ನಿಜವಾದ ಸಂಕೇತಗಳು ಹೊರಹೊಮ್ಮುತ್ತವೆ", text: "ಕನಿಷ್ಠ {floor} ಮನೆಗಳು ಬೆಂಬಲಿಸಿದ ನಂತರವೇ ಒಂದು ಸಂಖ್ಯೆ ಪ್ರಕಟವಾಗುತ್ತದೆ — ಎಂದಿಗೂ ಒಂದೇ ಮನೆ ಅಲ್ಲ." },
      { title: "ಸಂಸ್ಥೆಗಳು ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತವೆ", text: "ಬೆಲೆ ನಿಗದಿತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ, ಅಥವಾ ಉತ್ಪನ್ನಗಳನ್ನು ನೇರವಾಗಿ ಪಟ್ಟಿ ಮಾಡಿ — ಮನೆಗಳು ಬ್ರೌಸ್ ಮಾಡಿ ಕಾಯ್ದಿರಿಸುತ್ತವೆ, ಯಾವುದೇ ಮಧ್ಯವರ್ತಿ ಇಲ್ಲ." },
    ],
    benefitsEyebrow: "DataPay ಏಕೆ",
    benefitsTitle: "ಪ್ರತಿಯೊಬ್ಬರಿಗೂ ನಿಜವಾದ ಪ್ರಯೋಜನಗಳು",
    benefitsHouseholds: "ಮನೆಗಳಿಗಾಗಿ",
    benefitsOrganizations: "ಸಂಸ್ಥೆಗಳಿಗಾಗಿ",
    householdBenefits: [
      { title: "ಉತ್ತರಿಸಿದ್ದಕ್ಕೆ ಟೋಕನ್ ಗಳಿಸಿ", text: "ದಿನಕ್ಕೆ ಕೆಲವು ನಿಮಿಷಗಳಿಗೆ ಸಣ್ಣ, ನಿಜವಾದ ಬಹುಮಾನಗಳು — ಯಾವುದೇ ಷರತ್ತುಗಳಿಲ್ಲ." },
      { title: "ಸ್ಥಳೀಯವಾಗಿ ಉತ್ತಮ ಬೆಲೆಗಳು", text: "ಒಟ್ಟುಗೂಡಿದ ಬೇಡಿಕೆ ನಿಮ್ಮ ಪ್ರದೇಶಕ್ಕೆ ಪೂರೈಕೆದಾರರೊಂದಿಗೆ ನಿಜವಾದ ಚೌಕಾಸಿ ಶಕ್ತಿಯನ್ನು ನೀಡುತ್ತದೆ." },
      { title: "ಏನು ದಾಸ್ತಾನು ಇಡಬೇಕು ಎಂಬುದರಲ್ಲಿ ನಿಜವಾದ ಧ್ವನಿ", text: "ವಿತರಕರು ಊಹಿಸುವುದನ್ನಲ್ಲ, ನಿಮ್ಮ ಸಮುದಾಯಕ್ಕೆ ನಿಜವಾಗಿ ಏನು ಬೇಕು ಎಂಬುದನ್ನು ಸಂಸ್ಥೆಗಳು ನೋಡುತ್ತವೆ." },
      { title: "ನಿಜವಾದ ಉತ್ಪನ್ನಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ ಮತ್ತು ಕಾಯ್ದಿರಿಸಿ", text: "ನಿಜವಾದ ಪಟ್ಟಿ, ನ್ಯಾಯಯುತ ಬೆಲೆ, ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಪಾವತಿಯ ಅಗತ್ಯವಿಲ್ಲ." },
      { title: "ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆ", text: "ವಾಲ್ಟ್‌ನಿಂದ ಖಾಸಗಿ ಅಲಿಯಾಸ್ ಮಾತ್ರ ಹೊರಬರುತ್ತದೆ — ನಿಮ್ಮ ಹೆಸರು, ಫೋನ್, ಅಥವಾ ನಿಖರ ಸ್ಥಳ ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "ನೀವು ಯಾವಾಗಲೂ ನಿಯಂತ್ರಣದಲ್ಲಿರುತ್ತೀರಿ", text: "ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಯಾವುದೇ ವರ್ಗದ ಡೇಟಾ ಹಂಚಿಕೆಯನ್ನು ಆಫ್ ಮಾಡಿ." },
    ],
    orgBenefits: [
      { title: "ಊಹೆಗಳಲ್ಲ, ನಿಜವಾದ ಬೇಡಿಕೆ", text: "ಪ್ರತಿ ಸಂಖ್ಯೆಯೂ ನಿಜವಾದ ಮನೆಗಳಿಂದ ನಿಜವಾದ ಒಟ್ಟುಗೂಡಿಸಿದ ಸಂಕೇತ — ಎಂದಿಗೂ ಸಮೀಕ್ಷಾ ಪ್ಯಾನಲ್ ಅಥವಾ ಅಂದಾಜು ಅಲ್ಲ." },
      { title: "ನಿಮ್ಮ ಸ್ವಂತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ", text: "ಟೋಕನ್ ಬಹುಮಾನವನ್ನು ನಿಗದಿಪಡಿಸಿ ಮತ್ತು ನಿಮಗೆ ಮುಖ್ಯವಾದ ಸಮುದಾಯದಿಂದ ನೇರ ಉತ್ತರಗಳನ್ನು ಪಡೆಯಿರಿ." },
      { title: "ನೇರವಾಗಿ ಮಾರಾಟ ಮಾಡಿ", text: "ನಿಮ್ಮ ಪಟ್ಟಿಯನ್ನು ಪಟ್ಟಿ ಮಾಡಿ ಮತ್ತು ಮನೆಗಳು ಬ್ರೌಸ್ ಮಾಡಿ ಕಾಯ್ದಿರಿಸಲಿ — ವಿತರಕರ ಮಾರ್ಕ್‌ಅಪ್ ಇಲ್ಲ." },
      { title: "ವಿನ್ಯಾಸದಿಂದಲೇ ಗೌಪ್ಯತೆ-ಸುರಕ್ಷಿತ", text: "ನೀವು ಎಂದಿಗೂ ಮನೆಯ ಗುರುತನ್ನು ನೋಡುವುದಿಲ್ಲ — ಪ್ರಕಟಿತ ಕನಿಷ್ಠ ಮಿತಿಗಿಂತ ಹೆಚ್ಚಿನ ಅನಾಮಧೇಯ ಗುಂಪುಗಳು ಮಾತ್ರ." },
      { title: "ಪ್ರಾರಂಭಿಸಲು ವೇಗವಾಗಿದೆ", text: "ಯಾವುದೇ SDK ಇಲ್ಲ, ಯಾವುದೇ ಸಂಯೋಜನೆ ಕೆಲಸವಿಲ್ಲ — ಸೈನ್ ಅಪ್ ಮಾಡಿ, ಅನುಮೋದನೆ ಪಡೆಯಿರಿ, ಮತ್ತು ನೀವು ಲೈವ್ ಆಗಿರುತ್ತೀರಿ." },
      { title: "ಖರ್ಚಿನ ಮೇಲೆ ಸಂಪೂರ್ಣ ನಿಯಂತ್ರಣ", text: "ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ನಿಮ್ಮ ಸ್ವಂತ ಬಹುಮಾನವನ್ನು ನೀವೇ ನಿಗದಿಪಡಿಸುತ್ತೀರಿ — ನೀವು ಕೇಳಿದ್ದಕ್ಕೆ ಮಾತ್ರ ಪಾವತಿಸುತ್ತೀರಿ." },
    ],
    benefitsEcosystem: "ಮಾರುಕಟ್ಟೆಗಾಗಿ",
    ecosystemBenefits: [
      { title: "ಜನರಿಗೆ ನಿಜವಾಗಿ ಬೇಕಾದದ್ದನ್ನು ತಯಾರಿಸಿ", text: "ಉತ್ಪಾದಕರು ಒಂದು ಋತು ಅಥವಾ ಉತ್ಪಾದನೆಗೆ ಬದ್ಧರಾಗುವ ಮೊದಲೇ ನಿಜವಾದ ಬೇಡಿಕೆಯನ್ನು ನೋಡುತ್ತಾರೆ." },
      { title: "ಕಡಿಮೆ ವ್ಯರ್ಥ", text: "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಗೆ ಹೊಂದಿಕೆಯಾದ ದಾಸ್ತಾನು ಎಂದರೆ ಕಡಿಮೆ ಹಾಳಾಗುವಿಕೆ, ಕಡಿಮೆ ಮಾರಾಟವಾಗದ ಸರಕು." },
      { title: "ಚಿಕ್ಕ ಸರಪಳಿಗಳು", text: "ಉತ್ಪಾದಕರು ಮನೆಗಳನ್ನು ನೇರವಾಗಿ ತಲುಪುತ್ತಾರೆ — ಮಧ್ಯವರ್ತಿಗಳ ಪಾಲು ಕಡಿಮೆ." },
      { title: "ಊಹೆಯಲ್ಲದ ಜಾಹೀರಾತು", text: "ಈಗಾಗಲೇ ಅಗತ್ಯವನ್ನು ತಿಳಿಸಿದವರನ್ನು ತಲುಪುವುದು ಎಲ್ಲರಿಗೂ ಪ್ರಸಾರ ಮಾಡುವುದಕ್ಕಿಂತ ಉತ್ತಮ." },
      { title: "ನಿಜವಾದ ಕೊರತೆಗಳಿಗೆ ಆವಿಷ್ಕಾರ", text: "ಪೂರೈಸದ ಬೇಡಿಕೆ ಗೋಚರ ಸಂಕೇತವಾಗಿ ಕಾಣಿಸುತ್ತದೆ, ಕೇವಲ ಊಹೆಯಾಗಿ ಅಲ್ಲ." },
      { title: "ತನ್ನನ್ನು ತಾನೇ ಸರಿಪಡಿಸುವ ಮಾರುಕಟ್ಟೆ", text: "ಬೇಡಿಕೆ ಗೋಚರ ಮತ್ತು ಪ್ರಾಮಾಣಿಕವಾದಾಗ, ಪೂರೈಕೆ ಅದರತ್ತ ಚಲಿಸುತ್ತದೆ." },
    ],
    systemEyebrow: "ವ್ಯವಸ್ಥೆ",
    systemTitle: "ಎರಡು ಹರಿವುಗಳು, ಯಾವಾಗಲೂ — ಡೇಟಾ ಮೇಲಕ್ಕೆ, ಮೌಲ್ಯ ಕೆಳಗೆ",
    systemLede: "ಮನೆಗಳು ಎಂದಿಗೂ ಸಂಸ್ಥೆಗಳೊಂದಿಗೆ ನೇರವಾಗಿ ವ್ಯವಹರಿಸುವುದಿಲ್ಲ, ಮತ್ತು ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಮನೆಯನ್ನು ನೇರವಾಗಿ ನೋಡುವುದಿಲ್ಲ. DataPay ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ನಡುವೆ ಇರುತ್ತದೆ.",
    orgsEyebrow: "ಸಂಸ್ಥೆಗಳಿಗಾಗಿ",
    orgsTitle: "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಗೆ ನೇರ ಮಾರ್ಗ",
    cards: [
      { title: "ನಿಜವಾದ ಮನೆಗಳಿಗೆ ನಿಜವಾದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ", text: "ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ನಿಮ್ಮ ಸ್ವಂತ ಟೋಕನ್ ಬಹುಮಾನವನ್ನು ನಿಗದಿಪಡಿಸಿ. ಪ್ರತಿ ಸಲ್ಲಿಕೆಯನ್ನು ಯಾರಿಗಾದರೂ ತಲುಪುವ ಮೊದಲು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ — ಎಂದಿಗೂ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಕಟವಾಗುವುದಿಲ್ಲ." },
      { title: "ನಿಮ್ಮ ಸ್ವಂತ ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ", text: "ಸ್ಪ್ರೆಡ್‌ಶೀಟ್ ಲಿಂಕ್ ನೀಡಿ ಅಥವಾ ಕೈಯಿಂದ ಐಟಂಗಳನ್ನು ಸೇರಿಸಿ; ಮನೆಗಳು ನೇರವಾಗಿ ಬ್ರೌಸ್ ಮಾಡಿ ಕಾಯ್ದಿರಿಸುತ್ತವೆ. ಪೂರೈಕೆ ಅಪ್ಲಿಕೇಶನ್‌ನ ಹೊರಗೆ ನಡೆಯುತ್ತದೆ — ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಪಾವತಿ ಸೆಟಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ." },
      { title: "ಊಹೆಗಳಲ್ಲ, ನಿಜವಾದ ಬೇಡಿಕೆಯನ್ನು ನೋಡಿ", text: "ಒಟ್ಟುಗೂಡಿಸಿದ ಸಂಕೇತಗಳು ಕನಿಷ್ಠ {floor} ಮನೆಗಳು ಒಂದು ಸಂಖ್ಯೆಯನ್ನು ಬೆಂಬಲಿಸಿದಾಗ ಮಾತ್ರ ಪ್ರಕಟವಾಗುತ್ತವೆ — ಎಂದಿಗೂ ಒಂದೇ ಮನೆಯ ಡೇಟಾ ಅಲ್ಲ." },
    ],
    protectionEyebrow: "ಡೇಟಾ ಸಂರಕ್ಷಣೆ",
    protectionTitle: "ಗೌಪ್ಯತೆ ಇಲ್ಲಿ ಕೇವಲ ನೀತಿಯಲ್ಲ — ಅದು ವಿನ್ಯಾಸವೇ ಆಗಿದೆ",
    protectionItems: [
      { title: "ಯಾವಾಗಲೂ ಖಾಸಗಿ ಅಲಿಯಾಸ್.", text: "ಸಂಸ್ಥೆಗಳು ಅಲಿಯಾಸ್ ಅನ್ನು ಮಾತ್ರ ನೋಡುತ್ತವೆ — ಹೆಸರು, ಫೋನ್ ಸಂಖ್ಯೆ ಅಥವಾ ವಿಳಾಸ ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "{floor}ರ ಕನಿಷ್ಠ ಗುಂಪು ಮಿತಿ.", text: "ಕನಿಷ್ಠ {floor} ಮನೆಗಳು ಬೆಂಬಲಿಸುವವರೆಗೆ ಯಾವುದೇ ಸಂಖ್ಯೆ ಪ್ರಕಟವಾಗುವುದಿಲ್ಲ." },
      { title: "ನಿಖರ ಸ್ಥಳವನ್ನು ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.", text: "ಅಂದಾಜು ಪ್ರದೇಶ ಮಾತ್ರ, ಹತ್ತಿರದ ವಲಯವನ್ನು ಹೊಂದಿಸಲು ಬಳಸಲಾಗುತ್ತದೆ — ನಿಖರ ನಿರ್ದೇಶಾಂಕಗಳು ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "ಹಂಚಿಕೆಯನ್ನು ನೀವೇ ನಿಯಂತ್ರಿಸುತ್ತೀರಿ.", text: "ಡೇಟಾ ಹಂಚಿಕೆಯ ಪ್ರತಿಯೊಂದು ವರ್ಗವನ್ನು ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಆಫ್ ಮಾಡಬಹುದು." },
    ],
    protectionLink: "ಸಂಪೂರ್ಣ ಗೌಪ್ಯತಾ ನೀತಿಯನ್ನು ಓದಿ →",
    aboutEyebrow: "ನಮ್ಮ ಬಗ್ಗೆ",
    aboutTitle: "ಮೊದಲು ಮನೆಗಳಿಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ",
    aboutLede:
      "DataPay ಒಂದು ಸರಳ ಆಲೋಚನೆಯಿಂದ ಪ್ರಾರಂಭವಾಯಿತು: ಒಂದು ಸಮುದಾಯಕ್ಕೆ ಏನು ಬೇಕು ಎಂಬುದನ್ನು ಈಗಾಗಲೇ ವಿವರಿಸುವ ಡೇಟಾ ಮೌಲ್ಯಯುತವಾಗಿದೆ, ಮತ್ತು ಅದನ್ನು ಉತ್ಪಾದಿಸುವ ಮನೆಯೇ ಅದರ ಲಾಭ ಪಡೆಯಬೇಕು — ಟೋಕನ್‌ಗಳಲ್ಲಿ, ಉತ್ತಮ ಸ್ಥಳೀಯ ಲಭ್ಯತೆಯಲ್ಲಿ, ಮತ್ತು ಹೆಸರು ಮತ್ತು ಫೋನ್ ಸಂಖ್ಯೆಯಾಗಿ ಎಂದಿಗೂ ಮಾರಾಟವಾಗದಿರುವುದರಲ್ಲಿ.",
    aboutLink: "DataPay ಬಗ್ಗೆ ಇನ್ನಷ್ಟು →",
    finalTitle: "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಯನ್ನು ತಲುಪಲು ಸಿದ್ಧರಿದ್ದೀರಾ?",
    ctaRegistry: "ಸಾರ್ವಜನಿಕ ಬೇಡಿಕೆ ನೋಂದಣಿಯನ್ನು ನೋಡಿ",
    footerLinks: {
      about: "ನಮ್ಮ ಬಗ್ಗೆ",
      privacy: "ಗೌಪ್ಯತೆ",
      delete: "ಖಾತೆ ಅಳಿಸಿ",
      childSafety: "ಮಕ್ಕಳ ಸುರಕ್ಷತೆ",
      registry: "ಬೇಡಿಕೆ ನೋಂದಣಿ",
      orgLogin: "ಸಂಸ್ಥೆ ಲಾಗಿನ್",
      contact: "ಸಂಪರ್ಕಿಸಿ",
      brand: "ಬ್ರಾಂಡ್ ಮತ್ತು ಸ್ವತ್ತುಗಳು",
      android: "ಆ್ಯಂಡ್ರಾಯ್ಡ್ ಆ್ಯಪ್",
      ios: "iOS — ಶೀಘ್ರದಲ್ಲಿ ಬರಲಿದೆ",
    },
  },
} as const;

export async function MarketingHome({ lang }: { lang: Lang }): Promise<JSX.Element> {
  const [catalog, privacy] = await Promise.all([
    getCatalogPreview("prakruti-plus"),
    getPrivacyFloor(),
  ]);
  // Every "{floor}" in the copy becomes the floor the running deployment
  // actually enforces. Done once over the whole tree rather than at each
  // render site, because there are six of these across two languages and the
  // failure mode of missing one is a privacy claim on the homepage that the
  // code does not honour (SPEC.md §11).
  const t = fillFloor(CONTENT[lang], privacy.floor);

  return (
    <>
      <PublicNav lang={lang} />
      <main className="mkPage">
        <section className="mkHeroBand">
          <div className="mkHero">
            <div className="mkHeroCopy">
              <span className="mkLogoLight">
                <DataPayLogo size={40} tagline={t.tagline} />
              </span>
              <span className="mkLogoDark">
                <DataPayLogo size={40} dark tagline={t.tagline} />
              </span>
              <span className="mkHeroKicker">{t.heroKicker}</span>
              <h1>{t.heroTitle}</h1>
              <p className="mkLede">{t.heroLede}</p>

              <a href="#how-it-works" className="mkCtaSecondary mkCtaHow">
                {t.ctaHowItWorks}
              </a>
            </div>

            <PhoneMock lang={lang} />
          </div>

          <div className="mkTrustStrip">
            {/* stat: null means "fill from live config" — the cohort minimum is
                whatever the running deployment actually enforces, so the claim
                can't drift from the code the way a literal "50" did. */}
            {t.trust.map((item) => (
              <div className="mkTrustItem" key={item.label}>
                <span className="mkTrustStat">{item.stat ?? String(privacy.floor)}</span>
                <span className="mkTrustLabel">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* A FULL-WIDTH band, not a grid inside the hero's left column. Nested
            two-up inside an already-half-width column gave each door ~230px:
            the badges stacked, the shorter card stretched to a dead gap, and
            the secondary link was orphaned underneath. Naming the audience
            above each path was right; cramming it beside the phone was not. */}
        <section className="mkDoorsBand">
          <div className="mkDoors">
            <div className="mkDoor">
              <span className="mkDoorTag">{t.doorHousehold}</span>
              <p className="mkDoorBody">{t.doorHouseholdBody}</p>
              <div className="mkBadgeRow">
                <a
                  className="mkBadge mkBadgeLive"
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Google Play — ${t.openBeta}`}
                >
                  <AndroidIcon />
                  <span className="mkBadgeText">
                    <small>{t.openBeta}</small>
                    <strong>Google Play</strong>
                  </span>
                </a>
                <div className="mkBadge" aria-label={`App Store — ${t.comingSoon}`}>
                  <AppleIcon />
                  <span className="mkBadgeText">
                    <small>{t.comingSoon}</small>
                    <strong>App Store</strong>
                  </span>
                </div>
              </div>
              <p className="mkDoorNote">{t.doorHouseholdNote}</p>
            </div>

            <div className="mkDoor mkDoorOrg">
              <span className="mkDoorTag">{t.doorOrg}</span>
              <p className="mkDoorBody">{t.doorOrgBody}</p>
              <a href="/org/signup" className="mkCtaPrimary">
                {t.ctaSignup}
              </a>
              <p className="mkDoorNote">{t.doorOrgNote}</p>
            </div>
          </div>
        </section>


        {/* The collective buy is the concrete, immediate thing a household
            gets — no waiting, no token redemption, no trust required. It was
            buried under the token story, which is the part that pays off
            later. This says it plainly and up front. */}
        <section className="mkSection mkSectionBuy">
          <p className="mkEyebrow">{t.buyEyebrow}</p>
          <h2>{t.buyTitle}</h2>
          <p className="mkSectionLede">{t.buyLede}</p>
          <div className="mkBuySteps">
            {t.buySteps.map((step, i) => (
              <div className="mkBuyStep" key={step.title}>
                <span className="mkBuyStepNum">{i + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {catalog && (
          <section className="mkSection mkSectionCatalog">
            <p className="mkEyebrow">{t.catalogEyebrow}</p>
            <h2>{t.catalogTitle}</h2>
            <p className="mkSectionLede">{t.catalogLede}</p>
            <div className="mkShelf">
              {catalog.products.map((p) => (
                <a className="mkShelfCard" key={p.id} href={`/store/${catalog.orgSlug}`}>
                  <span className="mkShelfPhoto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photoUrl ?? ""} alt={p.nameEn} loading="lazy" />
                  </span>
                  <span className="mkShelfBody">
                    <span className="mkShelfName">{p.nameEn}</span>
                    <span className="mkShelfPrices">
                      <span className="mkShelfPrice">{formatRupees(p.salePricePaise)}</span>
                      {p.marketPricePaise > p.salePricePaise && (
                        <span className="mkShelfWas">{formatRupees(p.marketPricePaise)}</span>
                      )}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            <p className="mkShelfFoot">
              <span className="mkShelfBy">
                {t.catalogBy} <strong>{catalog.orgName}</strong>
              </span>
              <a href={`/store/${catalog.orgSlug}`}>{t.catalogCta}</a>
            </p>
          </section>
        )}

        <section id="how-it-works" className="mkSection">
          <p className="mkEyebrow">{t.howEyebrow}</p>
          <h2>{t.howTitle}</h2>
          <div className="mkSteps">
            {t.steps.map((s, i) => (
              <div className="mkStep" key={s.title}>
                <span className="mkStepNum">{i + 1}</span>
                <svg className="mkStepIcon" viewBox="0 0 24 24" width="26" height="26">
                  {ICONS[i]}
                </svg>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkSection mkSectionBenefits">
          <p className="mkEyebrow">{t.benefitsEyebrow}</p>
          <h2>{t.benefitsTitle}</h2>
          <div className="mkBenefitsGrid">
            <div className="mkBenefitsCol">
              <h3 className="mkBenefitsColHeading">{t.benefitsHouseholds}</h3>
              <ul className="mkBenefitsList">
                {t.householdBenefits.map((b) => (
                  <li key={b.title}>
                    <CheckIcon />
                    <span>
                      <strong>{b.title}.</strong> {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkBenefitsCol">
              <h3 className="mkBenefitsColHeading">{t.benefitsOrganizations}</h3>
              <ul className="mkBenefitsList">
                {t.orgBenefits.map((b) => (
                  <li key={b.title}>
                    <CheckIcon />
                    <span>
                      <strong>{b.title}.</strong> {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {/* The third beneficiary is the market itself — the argument that
                honest demand signal makes supply, waste and even advertising
                less wasteful for everyone, including people who never join. */}
            <div className="mkBenefitsCol">
              <h3 className="mkBenefitsColHeading">{t.benefitsEcosystem}</h3>
              <ul className="mkBenefitsList">
                {t.ecosystemBenefits.map((b) => (
                  <li key={b.title}>
                    <CheckIcon />
                    <span>
                      <strong>{b.title}.</strong> {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mkSection mkSectionDiagram">
          <p className="mkEyebrow">{t.systemEyebrow}</p>
          <h2>{t.systemTitle}</h2>
          <p className="mkSectionLede">{t.systemLede}</p>
          <div className="mkDiagramWrap">
            <SystemDiagram floor={privacy.floor} />
          </div>
        </section>

        <section id="for-organizations" className="mkSection">
          <p className="mkEyebrow">{t.orgsEyebrow}</p>
          <h2>{t.orgsTitle}</h2>
          <div className="mkCards">
            {t.cards.map((c) => (
              <div className="mkCard" key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <a href="/org/signup" className="mkCtaPrimary mkCtaInline">
            {t.ctaSignup}
          </a>
        </section>

        {/* Full-bleed tint, but the content inside rides the same 1200px column
            as every other section — an explicit inner wrapper rather than a
            `> *` rule, which lost a specificity fight with `.mkSection h2`. */}
        <section className="mkSection mkSectionProtection">
          <div className="mkProtectionInner">
            <p className="mkEyebrow">{t.protectionEyebrow}</p>
            <h2>{t.protectionTitle}</h2>
            <div className="mkProtectionGrid">
              {t.protectionItems.map((p) => (
                <div className="mkProtectionItem" key={p.title}>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
            <p className="mkProtectionLink">
              <a href="/privacy">{t.protectionLink}</a>
            </p>
          </div>
        </section>

        <section className="mkSection mkSectionAbout">
          <p className="mkEyebrow">{t.aboutEyebrow}</p>
          <h2>{t.aboutTitle}</h2>
          <p className="mkSectionLede">
            {t.aboutLede} <a href="/about">{t.aboutLink}</a>
          </p>
        </section>

        <section className="mkSection mkSectionFinalCta">
          <h2>{t.finalTitle}</h2>
          <div className="mkCtaRow">
            <a href="/org/signup" className="mkCtaPrimary">
              {t.ctaSignup}
            </a>
            <a href="/registry" className="mkCtaSecondary">
              {t.ctaRegistry}
            </a>
          </div>
        </section>

        <footer className="mkFooter">
          <div className="mkFooterBrand">
            <span className="mkLogoLight">
              <DataPayLogo size={28} tagline={t.tagline} />
            </span>
            <span className="mkLogoDark">
              <DataPayLogo size={28} dark tagline={t.tagline} />
            </span>
          </div>
          <div className="mkFooterLinks">
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
              {t.footerLinks.android}
            </a>
            {/* Not a link on purpose — there is no iOS build to point at, and a
                footer link that goes nowhere is worse than plain text. */}
            <span className="mkFooterMuted">{t.footerLinks.ios}</span>
            <a href="/about">{t.footerLinks.about}</a>
            <a href="/privacy">{t.footerLinks.privacy}</a>
            <a href="/delete-account">{t.footerLinks.delete}</a>
            <a href="/child-safety">{t.footerLinks.childSafety}</a>
            <a href="/registry">{t.footerLinks.registry}</a>
            <a href="/brand">{t.footerLinks.brand}</a>
            <a href="/org/login">{t.footerLinks.orgLogin}</a>
            <a href="mailto:srinivas@socratus.org">{t.footerLinks.contact}</a>
          </div>
        </footer>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .mkPage {
          --mk-bg: #FBFAF7; --mk-surface: #FFFFFF; --mk-sunken: #F3F1EB;
          --mk-border: rgba(18,21,26,0.09); --mk-border-strong: rgba(18,21,26,0.16);
          --mk-ink: #12151A; --mk-subtle: #585F68; --mk-mist: #8C939C;
          --mk-jade: #0E7A5C; --mk-jade-deep: #0B6249; --mk-jade-tint: #E7F0EC; --mk-brass: #A67C21;
          background: var(--mk-bg); color: var(--mk-ink);
          font-family: "Switzer", system-ui, sans-serif;
        }
        .mkPage h1, .mkPage h2, .mkPage h3 { font-family: "Cabinet Grotesk", system-ui, sans-serif; font-weight: 800; }
        /* ---- Hero band ---------------------------------------------------
           Two columns, left-aligned: the old hero was a centered column of
           text that gave the page nothing to look at above the fold. */
        .mkHeroBand {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(1100px 520px at 12% -8%, var(--mk-jade-tint) 0%, transparent 62%),
            radial-gradient(760px 420px at 88% 8%, #f6eeda 0%, transparent 60%);
          border-bottom: 1px solid var(--mk-border);
        }
        .mkHero {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: clamp(64px, 8vw, 104px) var(--gutter) clamp(48px, 5vw, 72px);
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 56px;
          align-items: center;
        }
        .mkHeroCopy { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
        .mkHeroKicker {
          display: inline-block; font-family: "Spline Sans Mono", monospace;
          font-size: 11px; font-weight: 500; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--mk-jade);
          background: var(--mk-surface); border: 1px solid var(--mk-border);
          border-radius: 999px; padding: 7px 14px;
        }
        .mkHero h1 { font-size: clamp(2.75rem, 5.4vw, 4.25rem); line-height: 1.02; margin: 0; letter-spacing: -0.045em; }
        .mkLede { font-size: 17px; line-height: 1.65; color: var(--mk-subtle); max-width: 520px; margin: 0; }
        .mkCtaRow { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }

        /* ---- Phone illustration ------------------------------------------ */
        .mkPhoneWrap { position: relative; display: flex; justify-content: center; }
        .mkPhoneGlow {
          position: absolute; width: 320px; height: 320px; border-radius: 999px;
          background: var(--mk-jade); opacity: 0.1; filter: blur(60px);
        }
        .mkPhone {
          position: relative; width: 278px; aspect-ratio: 9 / 13.4;
          background: #0c0f12; border-radius: 40px; padding: 9px;
          box-shadow: 0 30px 70px rgba(16, 20, 24, 0.28), 0 2px 0 rgba(255,255,255,0.12) inset;
        }
        .mkPhoneScreen {
          height: 100%; border-radius: 32px; background: #F6F5F1; padding: 20px 16px;
          display: flex; flex-direction: column; gap: 14px; overflow: hidden;
        }
        .mkPhoneTop { display: flex; align-items: center; justify-content: space-between; }
        .mkPhoneBrand { font-size: 13.5px; font-weight: 800; color: #101418; letter-spacing: -0.01em; }
        .mkPhoneTokens {
          font-size: 12px; font-weight: 700; color: var(--mk-brass);
          background: #faf1dd; border-radius: 999px; padding: 4px 10px;
        }
        .mkPhoneEyebrow {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
          color: #8A939B; margin: 4px 0 0;
        }
        .mkPhoneCard {
          background: #fff; border: 1px solid #E7E4DC; border-radius: 18px; padding: 16px 15px;
          box-shadow: 0 2px 8px rgba(16,20,24,0.05);
        }
        .mkPhoneQ { font-size: 14.5px; line-height: 1.4; font-weight: 700; color: #101418; margin: 0 0 14px; }
        .mkPhoneChips { display: flex; flex-direction: column; gap: 7px; }
        .mkPhoneChip {
          font-size: 12.5px; font-weight: 600; color: #5B6672;
          border: 1px solid #E7E4DC; border-radius: 10px; padding: 9px 12px; background: #fff;
        }
        .mkPhoneChipOn { background: var(--mk-jade); border-color: var(--mk-jade); color: #fff; }
        .mkPhoneReward {
          display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700;
          color: #0B6249; background: #E3EFEA; border-radius: 12px; padding: 10px 13px;
        }
        .mkPhoneRewardIcon { font-size: 13px; }
        .mkPhoneNote { font-size: 10.5px; line-height: 1.45; color: #8A939B; margin-top: 2px; }

        /* ---- Trust strip -------------------------------------------------- */
        .mkTrustStrip {
          position: relative; z-index: 1;
          max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter) clamp(56px, 7vw, 88px);
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .mkTrustItem {
          display: flex; align-items: baseline; gap: 12px;
          border-left: 2px solid var(--mk-jade); padding-left: 16px;
        }
        .mkTrustStat { font-family: "Cabinet Grotesk", sans-serif; font-size: clamp(2rem, 3vw, 2.6rem); font-weight: 700; letter-spacing: -0.03em; color: var(--mk-ink); line-height: 1; }
        .mkTrustLabel { font-size: 13px; line-height: 1.45; color: var(--mk-subtle); }

        /* ---- Live catalog shelf ------------------------------------------- */
        .mkShelf { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 28px; }
        .mkShelfCard {
          display: flex; flex-direction: column; text-decoration: none; color: inherit;
          background: var(--mk-surface); border: 1px solid var(--mk-border);
          border-radius: 12px; overflow: hidden; transition: border-color 0.18s ease, background 0.18s ease;
        }
        .mkShelfCard:hover { border-color: var(--mk-border-strong); background: var(--mk-sunken); }
        /* The ratio has to live on the <img>, not the wrapper: height:100%
           against an auto-height parent resolves to auto, so each photo sized
           itself from its own intrinsic height and the shelf came out ragged. */
        .mkShelfPhoto { display: block; flex: none; width: 100%; overflow: hidden; background: #0c0f12; }
        .mkShelfPhoto img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
        .mkShelfBody { display: flex; flex-direction: column; gap: 7px; padding: 14px 15px 16px; }
        .mkShelfName { font-size: 13.5px; font-weight: 700; line-height: 1.35; }
        .mkShelfPrices { display: flex; align-items: baseline; gap: 8px; }
        .mkShelfPrice { font-family: "Spline Sans Mono", monospace; font-size: 15px; font-weight: 500; color: var(--mk-jade); font-variant-numeric: tabular-nums; }
        .mkShelfWas { font-family: "Spline Sans Mono", monospace; font-size: 12px; color: var(--mk-mist); text-decoration: line-through; }
        .mkShelfFoot {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 20px; font-size: 14px; color: var(--mk-subtle);
        }
        .mkShelfFoot a { color: var(--mk-jade); font-weight: 700; text-decoration: none; }
        .mkCtaPrimary { background: var(--mk-jade); color: #fff; padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 14.5px; text-decoration: none; }
        .mkCtaPrimary:hover { background: var(--mk-jade-deep); }
        .mkCtaSecondary { border: 1px solid var(--mk-border); color: var(--mk-ink); padding: 13px 24px; border-radius: 999px; font-weight: 600; font-size: 14.5px; text-decoration: none; }
        .mkCtaInline { display: inline-block; margin-top: 8px; }

        /* Two audience doors, side by side and visibly separate so neither
           reads as a step in the other's flow. They stack on a phone. */
        .mkBuySteps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 8px; }
        .mkBuyStep { display: flex; flex-direction: column; gap: 8px; padding: 22px; border: 1px solid var(--mk-border); border-radius: 16px; background: var(--mk-surface); }
        .mkBuyStepNum { font-family: "Spline Sans Mono", monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; color: var(--mk-jade); }
        .mkBuyStep strong { font-size: 16px; line-height: 1.3; color: var(--mk-ink); }
        .mkBuyStep p { font-size: 14px; line-height: 1.55; color: var(--mk-subtle); margin: 0; }
        @media (max-width: 860px) { .mkBuySteps { grid-template-columns: 1fr; } }

        /* The band spans the page, so each door gets real width — badges sit
           in a row and neither card has to stretch to fill dead space. */
        /* Same rhythm as .mkSection — it had zero TOP padding, which jammed
           the cards against the band above it. A section's vertical padding is
           symmetric; this is a continuation of the hero rather than a new
           section, so it takes ~70% of the gap and no border of its own. */
        .mkDoorsBand {
          max-width: 1200px;
          margin: 0 auto;
          padding: clamp(56px, 6.3vw, 92px) var(--gutter);
        }
        .mkDoors { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
        .mkDoor {
          display: flex; flex-direction: column; align-items: flex-start; gap: 14px;
          padding: 28px 30px; border: 1px solid var(--mk-border); border-radius: 18px;
          background: var(--mk-surface);
        }
        /* Pins the fine print to the bottom of whichever card is shorter, so
           the two line up instead of one ending in a gap. */
        .mkDoorNote { margin-top: auto; padding-top: 4px; }
        .mkDoorOrg { border-color: var(--mk-jade); }
        .mkDoorTag {
          font-family: "Spline Sans Mono", monospace; font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--mk-jade);
        }
        .mkDoorBody { font-size: 15px; line-height: 1.6; color: var(--mk-ink); margin: 0; max-width: 46ch; }
        .mkDoorNote { font-size: 12.5px; line-height: 1.5; color: var(--mk-mist); margin-bottom: 0; }
        .mkDoor .mkBadgeRow { display: flex; flex-direction: row; flex-wrap: wrap; gap: 10px; }
        .mkCtaHow { align-self: flex-start; }
        @media (max-width: 820px) { .mkDoors { grid-template-columns: 1fr; } }

        .mkAppBadges { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 20px; }
        .mkAppBadgesLabel { font-family: "Spline Sans Mono", monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mk-mist); }
        .mkBadgeRow { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .mkBadge { display: flex; align-items: center; gap: 9px; border: 1px dashed var(--mk-border); border-radius: 12px; padding: 8px 14px; color: var(--mk-subtle); background: var(--mk-surface); opacity: 0.85; }
        .mkBadgeText { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
        .mkBadgeText small { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--mk-mist); }
        .mkBadgeText strong { font-size: 14px; font-weight: 700; color: var(--mk-ink); }
        /* The Android build is real and installable; iOS isn't, so only this
           one loses the dashed "not yet" treatment. */
        .mkBadgeLive { border-style: solid; border-color: var(--mk-jade); opacity: 1; text-decoration: none; transition: border-color 120ms ease, background 120ms ease; }
        .mkBadgeLive .mkBadgeText small { color: var(--mk-jade); }
        a.mkBadgeLive:hover { background: var(--mk-surface-2, var(--mk-surface)); border-color: var(--mk-ink); }
        a.mkBadgeLive:focus-visible { outline: 2px solid var(--mk-jade); outline-offset: 2px; }
        .mkBetaNote { font-size: 12.5px; line-height: 1.5; color: var(--mk-mist); max-width: 46ch; margin: 12px 0 0; }

        .mkSection { max-width: 1200px; margin: 0 auto; padding: var(--section-y) var(--gutter); border-top: 1px solid var(--mk-border); }
        .mkEyebrow { font-family: "Spline Sans Mono", monospace; text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; font-weight: 500; color: var(--mk-jade); margin: 0 0 14px; }
        .mkSection h2 { font-size: clamp(1.75rem, 3vw, 2.5rem); margin: 0 0 18px; letter-spacing: -0.035em; line-height: 1.08; max-width: 18ch; }
        .mkSectionLede { color: var(--mk-subtle); font-size: 16px; line-height: 1.7; max-width: 62ch; margin: 0 0 8px; }
        .mkSectionLede a { color: var(--mk-jade); font-weight: 600; }

        .mkSteps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 32px; }
        .mkStep { position: relative; background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 16px; padding: 24px 18px; }
        .mkStepNum { position: absolute; top: 16px; right: 18px; font-size: 12px; font-weight: 700; color: var(--mk-mist); }
        .mkStepIcon { color: var(--mk-jade); margin-bottom: 12px; }
        .mkStep h3 { font-size: 15px; margin: 0 0 8px; }
        .mkStep p { font-size: 13.5px; line-height: 1.6; color: var(--mk-subtle); margin: 0; }

        .mkDiagramWrap { margin-top: 32px; background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 14px; padding: clamp(24px, 4vw, 48px); overflow-x: auto; }

        .mkBenefitsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; align-items: start; }
        @media (max-width: 1080px) { .mkBenefitsGrid { grid-template-columns: 1fr 1fr; } }
        .mkBenefitsCol { background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 18px; padding: 26px 24px; }
        .mkBenefitsColHeading { font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mk-jade); margin: 0 0 18px; }
        .mkBenefitsList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
        .mkBenefitsList li { display: flex; align-items: flex-start; gap: 10px; }
        .mkBenefitsList li svg { flex-shrink: 0; margin-top: 2px; }
        .mkBenefitsList li span { font-size: 13.5px; line-height: 1.6; color: var(--mk-subtle); }
        .mkBenefitsList li strong { color: var(--mk-ink); font-weight: 700; }

        .mkCards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
        .mkCard { background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 16px; padding: 24px; }
        .mkCard h3 { font-size: 15.5px; margin: 0 0 10px; }
        .mkCard p { font-size: 13.5px; line-height: 1.65; color: var(--mk-subtle); margin: 0; }

        .mkSectionProtection {
          background: var(--mk-jade-tint); border-top: none; border-bottom: 1px solid var(--mk-border);
          max-width: none; margin: 0; padding: var(--section-y) 0;
        }
        .mkProtectionInner { max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter); }
        .mkProtectionGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px 56px; margin-top: 32px; max-width: 1200px; }
        .mkProtectionItem { display: flex; flex-direction: column; gap: 4px; }
        .mkProtectionItem strong { font-size: 14.5px; color: var(--mk-ink); }
        .mkProtectionItem span { font-size: 13.5px; color: var(--mk-subtle); line-height: 1.6; }
        .mkProtectionLink { margin-top: 24px; }
        .mkProtectionLink a { color: var(--mk-jade-deep); font-weight: 700; font-size: 14px; text-decoration: none; }

        .mkSectionFinalCta h2 { margin: 0 0 26px; max-width: 16ch; }

        .mkFooter { max-width: 1200px; margin: 0 auto; padding: 48px var(--gutter) 72px; border-top: 1px solid var(--mk-border); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; }
        .mkFooterLinks { display: flex; flex-wrap: wrap; gap: 20px; }
        .mkFooterLinks a { color: var(--mk-mist); text-decoration: none; font-size: 13px; font-weight: 600; }
        .mkFooterLinks a:hover { color: var(--mk-ink); }
        .mkFooterMuted { color: var(--mk-mist); font-size: 13px; font-weight: 600; opacity: 0.6; }

        @media (max-width: 980px) {
          .mkHero { grid-template-columns: 1fr; gap: 40px; padding: 48px 24px 40px; }
          .mkHeroCopy { align-items: center; text-align: center; }
          .mkLede { max-width: none; }
          .mkCtaRow, .mkAppBadges { justify-content: center; align-self: center; }
          .mkHero h1 { font-size: 2.5rem; }
          .mkShelf { grid-template-columns: repeat(2, 1fr); }
          .mkTrustStrip { grid-template-columns: 1fr; gap: 16px; padding: 0 24px 44px; }
        }
        @media (max-width: 820px) {
          .mkSteps { grid-template-columns: repeat(2, 1fr); }
          .mkCards { grid-template-columns: 1fr; }
          .mkProtectionGrid { grid-template-columns: 1fr; }
          .mkBenefitsGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .mkSteps { grid-template-columns: 1fr; }
          .mkShelf { grid-template-columns: 1fr; }
          .mkHero h1 { font-size: 2rem; }
        }

        /* DataPayLogo's text colors are set via inline style (ink/brass
           picked by its own "dark" prop, not CSS) — inline styles always
           beat stylesheet rules, so a page-level dark-mode media query can't
           override them after the fact. Rendering both variants and
           toggling which is visible is the only reliable fix without
           changing the shared component. */
        .mkLogoDark { display: none; }
        @media (prefers-color-scheme: dark) {
          .mkPage { --mk-bg: #101418; --mk-surface: #14161b; --mk-border: #24282e; --mk-ink: #F6F5F1; --mk-subtle: #c3c2b7; --mk-mist: #9b9a94; --mk-jade: #12946F; --mk-jade-deep: #0E7A5C; --mk-jade-tint: #14211c; --mk-brass: #D4AA45; }
          .mkLogoLight { display: none; }
          .mkLogoDark { display: inline-flex; }
          .mkHeroBand {
            background:
              radial-gradient(1100px 520px at 12% -8%, #14211c 0%, transparent 62%),
              radial-gradient(760px 420px at 88% 8%, #221c0f 0%, transparent 60%);
          }
          /* The phone screen keeps its light UI in both themes — it depicts the
             app, which has its own paper background, not this page's surface. */
          .mkPhone { box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55); }
        }
      `,
        }}
      />
    </>
  );
}
