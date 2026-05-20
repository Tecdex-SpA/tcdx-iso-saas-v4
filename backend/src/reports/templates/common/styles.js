'use strict';

const basePdfStyles = `
  @page {
    size: A4;
    margin: 14mm 12mm 16mm 12mm;
  }

  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #111827;
    background: #f8fafc;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.42;
  }

  .page {
    min-height: 0;
    background: #f8fafc;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  .section,
  .card,
  .kpi-card,
  .table-row,
  .keep-together {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .hero {
    border-radius: 18px;
    background: linear-gradient(135deg, #071B3A 0%, #0B2F4F 58%, #0B5FFF 130%);
    color: #fff;
    padding: 18px 20px;
    margin-bottom: 12px;
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }
  .brand {
    color: #93c5fd;
    font-weight: 900;
    letter-spacing: .11em;
    text-transform: uppercase;
    font-size: 9px;
  }
  h1, h2, h3, p { margin: 0; }
  h1 { margin-top: 14px; font-size: 25px; line-height: 1.06; letter-spacing: 0; }
  h2 { font-size: 15px; line-height: 1.15; margin-bottom: 7px; color: #0f172a; }
  h3 { font-size: 11px; line-height: 1.2; margin-bottom: 6px; color: #0f172a; }
  .muted { color: #64748b; }
  .hero .muted { color: #cbd5e1; }
  .subtitle { margin-top: 7px; max-width: 130mm; font-size: 10px; color: #dbeafe; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 14px; }
  .meta-item { border: 1px solid rgba(255,255,255,.18); border-radius: 12px; padding: 8px; background: rgba(255,255,255,.08); }
  .meta-item span, .kpi-card span, .trace-item span {
    display: block;
    color: #64748b;
    font-size: 7px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .hero .meta-item span { color: #bfdbfe; }
  .meta-item strong { display: block; margin-top: 3px; font-size: 9px; color: #fff; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .card, .kpi-card {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
    padding: 11px;
  }
  .kpi-card strong { display: block; color: #0B5FFF; font-size: 17px; margin-top: 3px; line-height: 1.1; }
  .section { margin-top: 10px; }
  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 0 0 7px;
    padding-bottom: 5px;
    border-bottom: 1px solid #dbeafe;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    border-radius: 999px;
    padding: 3px 7px;
    font-size: 7px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .badge.danger { color: #991b1b; background: #fee2e2; border: 1px solid #fecaca; }
  .badge.warning { color: #92400e; background: #fef3c7; border: 1px solid #fde68a; }
  .badge.success { color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; }
  .badge.neutral { color: #334155; background: #f1f5f9; border: 1px solid #e2e8f0; }
  .bar { height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin-top: 6px; }
  .bar > i { display: block; height: 100%; border-radius: inherit; background: #0B5FFF; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 5px; }
  th { text-align: left; color: #475569; font-size: 7px; text-transform: uppercase; letter-spacing: .06em; padding: 0 7px 2px; }
  td { background: #fff; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 7px; vertical-align: top; font-size: 8px; }
  td:first-child { border-left: 1px solid #e5e7eb; border-radius: 10px 0 0 10px; }
  td:last-child { border-right: 1px solid #e5e7eb; border-radius: 0 10px 10px 0; }
  .trace-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .trace-item { border: 1px solid #e5e7eb; background: #fff; border-radius: 10px; padding: 7px; }
  .trace-item strong { display: block; margin-top: 2px; font-size: 8px; color: #111827; }
  .footer-note { margin-top: 10px; color: #64748b; font-size: 7px; text-align: center; }
`;

module.exports = {
  basePdfStyles,
};
