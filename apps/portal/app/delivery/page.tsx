import { DeliveryApp } from "./DeliveryApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DataPay · Delivery",
};

export default function DeliveryPage(): JSX.Element {
  return (
    <>
      <DeliveryApp />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Its own visual world, on purpose. This is used one-handed at a
           doorstep by someone who is not ops — large targets, short lines,
           nothing to navigate. It shares the brand and nothing else. */
        .dWrap {
          min-height: 100vh;
          background: var(--porcelain2);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .dWrapList {
          display: block;
          max-width: 560px;
          margin: 0 auto;
          padding: 20px 18px 64px;
          background: var(--porcelain2);
        }

        .dCard {
          width: 100%;
          max-width: 380px;
          background: var(--surface);
          border: 1px solid var(--edge);
          border-radius: var(--r-xl);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dTitle { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; margin: 12px 0 0; }
        .dSub { color: var(--text-2); font-size: 14.5px; margin: 0 0 8px; line-height: 1.5; }

        .dForm { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
        .dField { display: flex; flex-direction: column; gap: 6px; }
        .dField span { font-size: 13px; font-weight: 600; color: var(--text-2); }
        .dField input {
          padding: 14px 14px;
          font-size: 16px; /* 16px or iOS zooms the page on focus */
          border-radius: var(--r-md);
          border: 1px solid var(--edge-strong);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
        }
        .dField input:focus-visible { outline: 2px solid var(--jade); outline-offset: 1px; }

        .dBtn {
          margin-top: 6px;
          padding: 15px 20px;
          border: none;
          border-radius: var(--r-md);
          background: var(--jade);
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
        }
        .dBtn:disabled { opacity: 0.6; }

        .dError {
          background: var(--danger-soft);
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--r-md);
          padding: 12px 14px;
          font-size: 14px;
          margin: 10px 0;
        }

        .dHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .dHello { font-weight: 700; font-size: 17px; margin: 0; }
        .dZone { color: var(--text-2); font-size: 13.5px; margin: 2px 0 0; }
        .dRefresh {
          border: 1px solid var(--edge-strong);
          background: var(--surface);
          color: var(--text);
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }

        .dCount { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; margin: 0 0 14px; }
        .dEmpty { color: var(--text-2); font-size: 14.5px; line-height: 1.6; }

        .dJob {
          background: var(--surface);
          border: 1px solid var(--edge);
          border-radius: var(--r-lg);
          padding: 18px;
          margin-bottom: 12px;
        }
        .dJobName { font-size: 16.5px; font-weight: 700; margin: 0; line-height: 1.35; }
        .dJobUnit { font-weight: 500; color: var(--text-2); }
        .dJobMeta { font-size: 13.5px; color: var(--text-2); margin: 5px 0 0; }
        .dJobToken { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; }
        .dJobTokenLabel { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
        .dJobToken code {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.1em;
          background: var(--porcelain2);
          border: 1px solid var(--edge-strong);
          border-radius: var(--r-sm);
          padding: 5px 11px;
        }

        .dFootnote { font-size: 12.5px; color: var(--text-3); line-height: 1.55; margin-top: 26px; }
      `,
        }}
      />
    </>
  );
}
