// A real diagram, not a bullet list pretending to be one — the two flows
// that define the product: data up (alias-protected, aggregated before it's
// ever shared) and value back down (questions, products, token rewards).
export function SystemDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 880 340"
      className="diagramSvg"
      role="img"
      aria-label="Households answer questions and place orders under a private alias. DataPay aggregates responses from at least 50 households before sharing anything. Organizations see only the aggregated signal, and send back questions, products, and token rewards."
    >
      <defs>
        <marker id="arrowJade" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#0E7A5C" />
        </marker>
        <marker id="arrowBrass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#B98F2F" />
        </marker>
      </defs>

      {/* Households */}
      <g>
        <rect x="20" y="90" width="220" height="130" rx="16" className="diagramBox diagramBoxHouseholds" />
        <text x="130" y="128" textAnchor="middle" className="diagramTitle">Households</text>
        <circle cx="70" cy="160" r="5" className="diagramDot" />
        <circle cx="95" cy="172" r="5" className="diagramDot" />
        <circle cx="120" cy="155" r="5" className="diagramDot" />
        <circle cx="145" cy="175" r="5" className="diagramDot" />
        <circle cx="170" cy="160" r="5" className="diagramDot" />
        <circle cx="195" cy="172" r="5" className="diagramDot" />
        <text x="130" y="200" textAnchor="middle" className="diagramCaption">answer · browse · order</text>
      </g>

      {/* DataPay hub */}
      <g>
        <rect x="330" y="55" width="220" height="200" rx="16" className="diagramBox diagramBoxHub" />
        <text x="440" y="90" textAnchor="middle" className="diagramTitle diagramTitleOnDark">DataPay</text>
        <rect x="350" y="108" width="180" height="30" rx="8" className="diagramPill" />
        <text x="440" y="128" textAnchor="middle" className="diagramPillText">Alias vault</text>
        <rect x="350" y="146" width="180" height="30" rx="8" className="diagramPill" />
        <text x="440" y="166" textAnchor="middle" className="diagramPillText">Aggregation (50+ floor)</text>
        <rect x="350" y="184" width="180" height="30" rx="8" className="diagramPill" />
        <text x="440" y="204" textAnchor="middle" className="diagramPillText">Token ledger</text>
      </g>

      {/* Organizations */}
      <g>
        <rect x="640" y="90" width="220" height="130" rx="16" className="diagramBox diagramBoxOrgs" />
        <text x="750" y="128" textAnchor="middle" className="diagramTitle">Organizations</text>
        <rect x="700" y="150" width="20" height="24" className="diagramBar" />
        <rect x="726" y="140" width="20" height="34" className="diagramBar" />
        <rect x="752" y="158" width="20" height="16" className="diagramBar" />
        <rect x="778" y="145" width="20" height="29" className="diagramBar" />
        <text x="750" y="200" textAnchor="middle" className="diagramCaption">questions · products</text>
      </g>

      {/* Data flow, up */}
      <path d="M242 130 L328 130" className="diagramArrow diagramArrowJade" markerEnd="url(#arrowJade)" />
      <text x="285" y="118" textAnchor="middle" className="diagramFlowLabel">alias only</text>

      <path d="M552 100 L638 100" className="diagramArrow diagramArrowJade" markerEnd="url(#arrowJade)" />
      <text x="595" y="88" textAnchor="middle" className="diagramFlowLabel">aggregated signal</text>

      {/* Value flow, back down — routed below the hub box so it never
          crosses its own labels (was cutting through "Token ledger"). */}
      <path
        d="M750 220 L750 285 L130 285 L130 220"
        className="diagramArrow diagramArrowBrass"
        markerEnd="url(#arrowBrass)"
      />
      <text x="440" y="308" textAnchor="middle" className="diagramFlowLabelBrass">
        questions, products &amp; token rewards flow back
      </text>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .diagramSvg { width: 100%; height: auto; max-width: 880px; }
        .diagramBox { fill: #fff; stroke: #E7E4DC; stroke-width: 1.5; }
        .diagramBoxHub { fill: #101418; stroke: #101418; }
        .diagramTitle { font: 700 17px -apple-system, "Segoe UI", sans-serif; fill: #101418; }
        .diagramTitleOnDark { fill: #F6F5F1; }
        .diagramCaption { font: 600 12px -apple-system, "Segoe UI", sans-serif; fill: #8A939B; letter-spacing: 0.02em; }
        .diagramDot { fill: #0E7A5C; opacity: 0.75; }
        .diagramPill { fill: #1A2027; }
        .diagramPillText { font: 600 12.5px -apple-system, "Segoe UI", sans-serif; fill: #E3EFEA; }
        .diagramBar { fill: #B98F2F; opacity: 0.85; }
        .diagramArrow { fill: none; stroke-width: 3; }
        .diagramArrowJade { stroke: #0E7A5C; }
        .diagramArrowBrass { stroke: #B98F2F; stroke-dasharray: 2 6; stroke-linecap: round; }
        .diagramFlowLabel { font: 600 11.5px -apple-system, "Segoe UI", sans-serif; fill: #0E7A5C; }
        .diagramFlowLabelBrass { font: 600 11.5px -apple-system, "Segoe UI", sans-serif; fill: #B98F2F; }
        @media (prefers-color-scheme: dark) {
          .diagramBox { fill: #14161b; stroke: #24282e; }
          .diagramBoxHub { fill: #F6F5F1; stroke: #F6F5F1; }
          .diagramTitle { fill: #F6F5F1; }
          .diagramTitleOnDark { fill: #101418; }
          .diagramPill { fill: #EFEDE6; }
          .diagramPillText { fill: #101418; }
        }
      `,
        }}
      />
    </svg>
  );
}
