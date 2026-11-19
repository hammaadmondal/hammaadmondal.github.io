/* All reports, in one place. The home-page slider and the Reports page are both built from this list.
   To publish a new report: add one entry (any order; pages sort by date, newest first).
   type: "Initiation", "IPO view", "Results note", "Sector piece"...  view: rating or view word.
   stats: up to three [label, value] pairs shown on the cards; mark a positive figure with "up". */
window.REPORTS = [
  {
    url: "/reports/anthropic/",
    title: "A great business at a full price",
    company: "Anthropic, PBC", ticker: "ANT", exchange: "Nasdaq", sector: "AI software",
    type: "IPO view", date: "2026-11-19",
    img: "/reports/img/ant_day.png", imgAlt: "ANT first-day trade prices against the $83 IPO price",
    summary: "What the S-1 filings show, how the shares traded on day one, and why $97 already needs about $300bn of revenue by 2030.",
    view: "Neutral",
    stats: [["IPO price", "$83.00"], ["Day-one close", "$97.17"], ["vs IPO", "+17.1%", "up"]],
    pdf: null, model: null
  },
  {
    url: "/reports/ryanair/",
    title: "Paying for a fuel trough that will not last",
    company: "Ryanair Holdings", ticker: "RYA", exchange: "Euronext Dublin", sector: "Airlines",
    type: "Initiation", date: "2026-11-17",
    img: "/reports/img/rya_ff.png", imgAlt: "Ryanair valuation football field against the share price and target",
    summary: "At €25.24 the market implies a long-run operating margin of about 6%. The FY28 fuel squeeze looks like a hedging-timing effect that fares largely absorb.",
    view: "Overweight",
    stats: [["12m target", "€31.81"], ["Price", "€25.24"], ["Upside", "+26.0%", "up"]],
    pdf: "/reports/files/Ryanair_Initiation_17Nov2026.pdf", model: "/reports/files/Ryanair_model_public.xlsx"
  },
  {
    url: "/reports/aib/",
    title: "A high-return bank, priced for it",
    company: "AIB Group", ticker: "A5G", exchange: "Euronext Dublin", sector: "Banks",
    type: "Initiation", date: "2026-11-17",
    img: "/reports/img/aib_ff.png", imgAlt: "AIB Group valuation football field against the share price and target",
    summary: "AIB earns well above its cost of equity and returns almost all of it. At €11.50 the shares imply about 17% sustainable return on tangible equity: attractive income, limited re-rating.",
    view: "Neutral",
    stats: [["12m target", "€12.69"], ["Price", "€11.50"], ["Upside", "+10.4%", "up"]],
    pdf: "/reports/files/AIB_Initiation_17Nov2026.pdf", model: "/reports/files/AIB_Group_model_public.xlsx"
  }
];

window.fmtDate = function (iso) {
  var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], p = iso.split("-");
  return (+p[2]) + " " + m[+p[1] - 1] + " " + p[0];
};
window.sortedReports = function (oldestFirst) {
  return window.REPORTS.slice().sort(function (a, b) {
    return oldestFirst ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });
};
