import { notFound } from "next/navigation";
import { PublicNav } from "../../components/PublicNav";
import { getLang } from "../../lib/language";
import { getStoreCatalog } from "./core-api";

export const dynamic = "force-dynamic";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const T = {
  en: {
    eyebrow: "Organization catalog",
    empty: "No products listed yet.",
    outOfStock: "Out of stock",
  },
  kn: {
    eyebrow: "ಸಂಸ್ಥೆಯ ಉತ್ಪನ್ನ ಪಟ್ಟಿ",
    empty: "ಇನ್ನೂ ಯಾವುದೇ ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿಲ್ಲ.",
    outOfStock: "ಸ್ಟಾಕ್ ಇಲ್ಲ",
  },
} as const;

export default async function StorePage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const lang = getLang();
  const t = T[lang];
  const catalog = await getStoreCatalog(params.slug);
  if (!catalog) notFound();

  return (
    <>
      <PublicNav lang={lang} />
      <main className="storePage">
        <header className="storeHeader">
          <p className="storeEyebrow">{t.eyebrow}</p>
          <h1>{catalog.organization.name}</h1>
        </header>

        {catalog.products.length === 0 ? (
          <p className="storeEmpty">{t.empty}</p>
        ) : (
          <div className="storeGrid">
            {catalog.products.map((p) => (
              <div className="storeCard" key={p.id}>
                <div className="storePhoto">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.nameEn} />
                  ) : (
                    <span className="storePhotoPlaceholder" />
                  )}
                </div>
                <div className="storeCardBody">
                  {p.categoryName && <span className="storeCategory">{p.categoryName}</span>}
                  <h3>{p.nameEn}</h3>
                  {lang === "kn" && p.nameKn && <p className="storeNameKn">{p.nameKn}</p>}
                  {p.unitSpec && <p className="storeUnit">{p.unitSpec}</p>}
                  {p.descriptionEn && <p className="storeDescription">{p.descriptionEn}</p>}
                  <div className="storePriceRow">
                    <span className="storeSalePrice">{formatPaise(p.salePricePaise)}</span>
                    {p.marketPricePaise > p.salePricePaise && (
                      <span className="storeMarketPrice">{formatPaise(p.marketPricePaise)}</span>
                    )}
                  </div>
                  <p className="storeQty">
                    {p.quantityAvailable > 0 ? `${p.quantityAvailable} available` : t.outOfStock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <style
          dangerouslySetInnerHTML={{
            __html: `
          .storePage { --sp-bg: #F6F5F1; --sp-surface: #fff; --sp-border: #E7E4DC; --sp-ink: #101418; --sp-subtle: #5B6672; --sp-mist: #8A939B; --sp-jade: #0E7A5C;
            background: var(--sp-bg); color: var(--sp-ink); min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          }
          .storeHeader { max-width: 1080px; margin: 0 auto; padding: 48px 24px 24px; }
          .storeEyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; font-weight: 700; color: var(--sp-jade); margin: 0 0 8px; }
          .storeHeader h1 { font-size: 2rem; margin: 0; letter-spacing: -0.01em; }
          .storeEmpty { max-width: 1080px; margin: 0 auto; padding: 0 24px 64px; color: var(--sp-mist); }
          .storeGrid { max-width: 1080px; margin: 0 auto; padding: 8px 24px 64px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
          .storeCard { background: var(--sp-surface); border: 1px solid var(--sp-border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
          .storePhoto { width: 100%; aspect-ratio: 4 / 3; background: var(--sp-bg); }
          .storePhoto img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .storePhotoPlaceholder { display: block; width: 100%; height: 100%; }
          .storeCardBody { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
          .storeCategory { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sp-jade); }
          .storeCardBody h3 { font-size: 15.5px; margin: 2px 0 0; }
          .storeNameKn { font-size: 13px; color: var(--sp-subtle); margin: 0; }
          .storeUnit { font-size: 12px; color: var(--sp-mist); margin: 0; }
          .storeDescription { font-size: 13px; color: var(--sp-subtle); line-height: 1.55; margin: 6px 0 0; }
          .storePriceRow { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; }
          .storeSalePrice { font-size: 17px; font-weight: 700; color: var(--sp-jade); }
          .storeMarketPrice { font-size: 12.5px; color: var(--sp-mist); text-decoration: line-through; }
          .storeQty { font-size: 11.5px; color: var(--sp-mist); margin: 4px 0 0; }

          @media (prefers-color-scheme: dark) {
            .storePage { --sp-bg: #101418; --sp-surface: #14161b; --sp-border: #24282e; --sp-ink: #F6F5F1; --sp-subtle: #c3c2b7; --sp-mist: #9b9a94; --sp-jade: #12946F; }
          }
        `,
          }}
        />
      </main>
    </>
  );
}
