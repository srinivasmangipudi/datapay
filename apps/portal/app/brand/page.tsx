import { DataPayLogo, DataPayMark, DataPayWordmark } from "../components/DataPayLogo";
import { PublicNav } from "../components/PublicNav";
import { getLang } from "../lib/language";

export const dynamic = "force-dynamic";

/**
 * The brand page: one place that shows what DataPay actually looks like.
 *
 * Written because the wordmark had quietly drifted — three navs rendered a
 * plain "DataPay" with no brass and no lean while the hero lockup right below
 * them had both, and the brass itself existed as two different hexes depending
 * on which file you were in. A living page beats a PDF nobody opens: every
 * swatch and lockup below is the real component or the real token, so it can
 * only ever show what is genuinely shipping.
 */

interface Swatch {
  name: string;
  token: string;
  hex: string;
  use: string;
  onDark?: boolean;
}

const CORE: Swatch[] = [
  { name: "Ink", token: "--ink", hex: "#12151A", use: "Body text, the wordmark's “Data”, the mark's left arc." },
  { name: "Porcelain", token: "--porcelain", hex: "#FBFAF7", use: "Page ground. Never pure white." },
  { name: "Jade", token: "--jade", hex: "#0E7A5C", use: "Primary action, links, the mark's centre block." },
  { name: "Jade bright", token: "--jade-bright", hex: "#12946F", use: "The same, on dark surfaces." },
  { name: "Brass", token: "--brass", hex: "#A67C21", use: "Value and money ONLY, plus the wordmark's “Pay”. Never body text." },
  { name: "Brass bright", token: "--brass-bright", hex: "#D4AA45", use: "Value and money, on dark surfaces.", onDark: true },
  { name: "Mist", token: "--mist", hex: "#8C939C", use: "Secondary labels, taglines, quiet metadata." },
];

const STATE: Swatch[] = [
  { name: "Danger", token: "--danger", hex: "#9C3C34", use: "Destructive actions, errors, the undeliverable-order strip." },
  { name: "Danger soft", token: "--danger-soft", hex: "#F8EFEC", use: "Error banner grounds." },
  { name: "Jade soft", token: "--jade-soft", hex: "#E7F0EC", use: "Success banner grounds, quiet jade fills." },
  { name: "Edge", token: "--edge", hex: "rgba(18,21,26,0.09)", use: "Every hairline. Surfaces separate by edge, not shadow." },
];

function SwatchGrid({ items }: { items: Swatch[] }): JSX.Element {
  return (
    <div className="swatches">
      {items.map((s) => (
        <div className="swatch" key={s.token}>
          <span
            className={`chip ${s.onDark ? "chipOnDark" : ""}`}
            style={{ background: s.hex }}
            aria-hidden="true"
          />
          <span className="swatchName">{s.name}</span>
          <code className="swatchToken">var({s.token})</code>
          <code className="swatchHex">{s.hex}</code>
          <span className="swatchUse">{s.use}</span>
        </div>
      ))}
    </div>
  );
}

export default async function BrandPage(): Promise<JSX.Element> {
  const lang = getLang();

  return (
    <>
      <PublicNav lang={lang} />
      <main className="page brandPage">
        <header className="pageHead">
          <p className="eyebrow">DataPay · Brand</p>
          <h1>Design language</h1>
          <p className="lede">
            Everything on this page is rendered by the same components and tokens the product
            ships, so it cannot drift from what is actually live. If a lockup here looks wrong, the
            product is wrong.
          </p>
        </header>

        <section className="section">
          <h2>The mark</h2>
          <p className="lede">
            Two arcs and a block. The left arc is ink, the right is brass, the centre block is
            jade — the same three roles the palette uses everywhere else.
          </p>
          <div className="specimenRow">
            <div className="specimen">
              <DataPayMark size={96} />
              <span className="specimenLabel">Light</span>
            </div>
            <div className="specimen specimenDark">
              <DataPayMark size={96} dark />
              <span className="specimenLabel">Dark</span>
            </div>
            <div className="specimen">
              <DataPayMark size={24} />
              <span className="specimenLabel">24px — nav minimum</span>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>The wordmark</h2>
          <p className="lede">
            <strong>“Data” in ink, “Pay” in brass, leaning −9°.</strong> Never flat, never
            monochrome, never all one colour. Use <code>DataPayWordmark</code> rather than typing
            the letters — every place that hand-rolled it drifted.
          </p>
          <div className="specimenRow">
            <div className="specimen">
              <span style={{ fontSize: 34 }}>
                <DataPayWordmark />
              </span>
              <span className="specimenLabel">Correct</span>
            </div>
            <div className="specimen specimenWrong">
              <span style={{ fontSize: 34, fontWeight: 800 }}>DataPay</span>
              <span className="specimenLabel">Wrong — flat, no brass, no lean</span>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Full lockup</h2>
          <p className="lede">
            Mark plus wordmark, with an optional tagline in the mono face. This is the form for
            page heroes and sign-in screens; navs use the mark and wordmark without a tagline.
          </p>
          <div className="specimenRow">
            <div className="specimen">
              <DataPayLogo size={44} tagline="Your data is your asset" />
            </div>
            <div className="specimen specimenDark">
              <DataPayLogo size={44} dark tagline="Your data is your asset" />
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Colour</h2>
          <p className="lede">
            Brass is the one with a rule attached: it means <em>value</em>. Token balances, prices,
            money. Using it as a general accent is the fastest way to make the palette meaningless.
          </p>
          <h3 className="subhead">Core</h3>
          <SwatchGrid items={CORE} />
          <h3 className="subhead">State</h3>
          <SwatchGrid items={STATE} />
        </section>

        <section className="section">
          <h2>Typography</h2>
          <div className="typeSpecimen">
            <p className="typeMeta">
              Cabinet Grotesk · Extrabold · <code>var(--font-display)</code>
            </p>
            <p className="typeDisplay">Real household demand</p>
            <p className="typeUse">Headings only. Tight tracking, never below 800 weight.</p>
          </div>
          <div className="typeSpecimen">
            <p className="typeMeta">
              Switzer · 400/500/600 · <code>var(--font-body)</code>
            </p>
            <p className="typeBody">
              Answer a few short questions a day and earn tokens. Free, and always anonymous.
            </p>
            <p className="typeUse">Body, labels, buttons. The workhorse.</p>
          </div>
          <div className="typeSpecimen">
            <p className="typeMeta">
              Spline Sans Mono · 400–600 · <code>var(--font-mono)</code>
            </p>
            <p className="typeMono">HOUSEHOLD DEMAND, COLLECTIVISED · ₹1,24,500 · 12,480</p>
            <p className="typeUse">
              Eyebrows, and every figure that reads down a column. Tabular figures line up row to
              row; display-size numbers keep proportional figures instead.
            </p>
          </div>
        </section>

        <section className="section">
          <h2>Rules</h2>
          <ul className="rules">
            <li>
              <strong>Brass means money.</strong> Value, prices, token counts, and the “Pay” in the
              wordmark. Nothing else.
            </li>
            <li>
              <strong>Surfaces separate by hairline, not shadow.</strong> One ambient shadow exists
              and it is reserved for genuinely floating objects.
            </li>
            <li>
              <strong>The ground is porcelain, not white.</strong> Pure white belongs to cards.
            </li>
            <li>
              <strong>Never re-type the wordmark.</strong> Import the component. Three navs proved
              why.
            </li>
            <li>
              <strong>Dark mode is chosen, not inverted.</strong> Each token has a declared dark
              value; nothing is flipped automatically.
            </li>
          </ul>
        </section>

        <section className="section">
          <h2>Assets</h2>
          <p className="lede">
            For decks, partner sites and press. The SVGs are the same files the product serves.
          </p>
          <ul className="assetList">
            <li>
              <a href="/mark-primary.svg" download>
                Mark — SVG
              </a>
              <span className="assetNote">Square, scales to any size.</span>
            </li>
            <li>
              <a href="/logo-tagline-asset.svg" download>
                Lockup with tagline — SVG
              </a>
              <span className="assetNote">Mark, wordmark and tagline together.</span>
            </li>
            <li>
              <a href="/og-image.png" download>
                Social image — PNG
              </a>
              <span className="assetNote">1200×630, for link previews.</span>
            </li>
          </ul>
        </section>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .brandPage .subhead { margin-top: 28px; }
        .specimenRow { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 22px; }
        .specimen {
          flex: 1 1 240px; display: flex; flex-direction: column; gap: 14px;
          align-items: flex-start; justify-content: center;
          padding: 28px; border: 1px solid var(--edge); border-radius: var(--r-lg);
          background: var(--surface); min-height: 168px;
        }
        .specimenDark { background: #101418; border-color: #24282e; }
        .specimenDark .specimenLabel { color: #9b9a94; }
        .specimenWrong { border-style: dashed; border-color: var(--danger); }
        .specimenWrong .specimenLabel { color: var(--danger); }
        .specimenLabel { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); }

        .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-top: 18px; }
        .swatch { display: flex; flex-direction: column; gap: 5px; padding: 16px; border: 1px solid var(--edge); border-radius: var(--r-md); background: var(--surface); }
        .chip { display: block; height: 46px; border-radius: var(--r-sm); border: 1px solid var(--edge); margin-bottom: 6px; }
        /* A light-on-light swatch would vanish against the card. */
        .chipOnDark { background-clip: padding-box; box-shadow: inset 0 0 0 6px #101418; }
        .swatchName { font-weight: 700; font-size: 14.5px; }
        .swatchToken, .swatchHex { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-3); }
        .swatchUse { font-size: 12.5px; line-height: 1.5; color: var(--text-2); margin-top: 3px; }

        .typeSpecimen { padding: 24px 0; border-top: 1px solid var(--edge); }
        .typeMeta { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--jade); margin: 0 0 10px; }
        .typeDisplay { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.035em; line-height: 1.05; margin: 0; }
        .typeBody { font-family: var(--font-body); font-size: 18px; line-height: 1.6; margin: 0; max-width: 54ch; }
        .typeMono { font-family: var(--font-mono); font-size: 15px; letter-spacing: 0.04em; margin: 0; }
        .typeUse { font-size: 13px; color: var(--text-2); margin: 10px 0 0; max-width: 62ch; line-height: 1.55; }

        .rules { margin: 18px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
        .rules li { font-size: 14.5px; line-height: 1.6; color: var(--text-2); }
        .rules strong { color: var(--text); }

        .assetList { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .assetList li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; padding: 14px 16px; border: 1px solid var(--edge); border-radius: var(--r-md); background: var(--surface); }
        .assetList a { color: var(--jade); font-weight: 600; text-decoration: none; }
        .assetList a:hover { text-decoration: underline; }
        .assetNote { font-size: 12.5px; color: var(--text-3); }
      `,
        }}
      />
    </>
  );
}
