// Shared CSS for all monitor pages. Injected once per page by <MonitorShell/>.
export const MONITOR_CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; background: #0f1115; color: #e6e6e6; }
  a { color: #4c8dff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .shell { display: flex; min-height: 100vh; }
  .nav { width: 180px; background: #13161d; border-right: 1px solid #232733; padding: 16px 0; flex-shrink: 0; }
  .nav h1 { font-size: 13px; margin: 0 16px 12px; color: #9aa0aa; text-transform: uppercase; letter-spacing: .05em; }
  .nav a { display: block; padding: 7px 16px; color: #c8ccd4; }
  .nav a.active { background: #1c2330; color: #fff; border-left: 2px solid #4c8dff; }
  .main { flex: 1; padding: 24px; max-width: 1100px; margin-inline: auto; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .topbar h2 { margin: 0; font-size: 18px; }
  .topbar .meta { color: #8a8f98; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .kpi { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 14px; }
  .kpi-value { font-size: 26px; font-weight: 700; }
  .kpi-label { color: #9aa0aa; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .kpi-sub { color: #6f7480; font-size: 11px; margin-top: 2px; }
  .kpi a { color: inherit; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; }
    .shell { flex-direction: column; }
    .nav { width: auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
    .nav a { padding: 4px 10px; border-bottom: 0; }
    .nav h1 { display: none; }
    .main { padding: 12px; }
    .section { padding: 12px; }
    .topbar h2 { font-size: 16px; }
  }
  @media (max-width: 480px) {
    .kpi-value { font-size: 20px; }
    .kpis { gap: 8px; }
    ul.bars li { grid-template-columns: 90px 1fr 44px; }
    .bubble { max-width: 90%; }
  }
  .section { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .section h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #c8ccd4; }
  .empty { color: #6f7480; margin: 0; }
  ul.bars { list-style: none; margin: 0; padding: 0; }
  ul.bars li { display: grid; grid-template-columns: 120px 1fr 64px; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { font-size: 12px; color: #c8ccd4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { background: #232733; border-radius: 4px; height: 10px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; background: #4c8dff; }
  .bar-count { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; min-width: max-content; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #232733; vertical-align: top; }
  th { color: #9aa0aa; font-weight: 600; position: sticky; top: 0; background: #171a21; }
  tr:hover td { background: #1c212b; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .muted { color: #8a8f98; }
  .err-msg { color: #ffb4b4; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .tag-ok { background: #1e3a23; color: #7ee29c; }
  .tag-off { background: #3a1e1e; color: #e29c9c; }
  .tag-run { background: #1e2d3a; color: #7ec4e2; }
  .tag-pend { background: #2a2a1e; color: #e2d27e; }
  .tag-fail { background: #3a1e1e; color: #e29c9c; }
  .tag-done { background: #1e3a23; color: #7ee29c; }
  form.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-bottom: 16px; }
  form.filters label { font-size: 11px; color: #9aa0aa; display: flex; flex-direction: column; gap: 3px; }
  form.filters input, form.filters select { background: #0f1115; border: 1px solid #2a2f3a; color: #e6e6e6; border-radius: 6px; padding: 5px 8px; font-size: 12px; }
  form.filters button { background: #4c8dff; color: #0f1115; border: 0; border-radius: 6px; padding: 6px 12px; font-weight: 600; cursor: pointer; }
  .pager { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 12px; color: #9aa0aa; }
  .thread { display: flex; flex-direction: column; gap: 10px; }
  .bubble { max-width: 78%; padding: 9px 12px; border-radius: 12px; border: 1px solid #232733; }
  .bubble.human { align-self: flex-start; background: #1a2230; }
  .bubble.bot { align-self: flex-end; background: #142b1e; }
  .bubble .who { font-size: 11px; color: #8a8f98; margin-bottom: 3px; }
  .bubble .text { white-space: pre-wrap; word-break: break-word; }
  .fcall { background: #171a21; border: 1px solid #2a2f3a; border-radius: 8px; padding: 8px 12px; }
  .fcall summary { cursor: pointer; font-family: ui-monospace, monospace; font-size: 12px; color: #c8ccd4; }
  .fcall pre { margin: 8px 0 0; font-size: 11px; white-space: pre-wrap; word-break: break-word; color: #b8c0cc; }
  .fcall .label { color: #8a8f98; font-size: 11px; }
`
