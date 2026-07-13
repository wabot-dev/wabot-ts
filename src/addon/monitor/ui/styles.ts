// Monitor-specific layout layered on the Wabot design system
// (https://design.wabot.dev/assets/colors_and_type.css, linked in <MonitorShell/>).
// Only what the design system doesn't ship: the shell, KPI grid, bar lists, chat
// thread, table-scroll wrapper, filter rows, pager, and responsive overrides.
// Cards, badges, dots, tables, buttons, inputs, pre, and typography come from
// the design system — don't redeclare them here.
export const MONITOR_CSS = `
  .shell { display: flex; min-height: 100vh; }
  .main { flex: 1; padding: var(--sp-6); max-width: 1100px; margin-inline: auto; min-width: 0; }

  .topbar { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3); margin-bottom: var(--sp-4); flex-wrap: wrap; }
  .topbar h2 { margin: 0; font-size: var(--fs-2xl); }
  .topbar .meta { color: rgb(var(--c-fg-muted)); font-size: var(--fs-sm); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-5); }
  .kpi { display: block; color: inherit; text-decoration: none; }
  .kpi-value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.022em; font-variant-numeric: tabular-nums; }
  .kpi-sub { color: rgb(var(--c-fg-faint)); font-size: var(--fs-xs); margin-top: 2px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); }
  .section { margin-bottom: var(--sp-5); }
  .empty { color: rgb(var(--c-fg-faint)); margin: 0; font-size: var(--fs-sm); }

  ul.bars { list-style: none; margin: 0; padding: 0; }
  ul.bars li { display: grid; grid-template-columns: 120px 1fr 64px; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2); }
  .bar-label { font-size: var(--fs-sm); color: rgb(var(--c-fg-body)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { background: rgb(var(--c-bg-sunken)); border-radius: var(--r-sm); height: 10px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; background: rgb(var(--c-action)); border-radius: var(--r-sm); }
  .bar-count { text-align: right; font-variant-numeric: tabular-nums; font-size: var(--fs-sm); color: rgb(var(--c-fg-muted)); }

  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-scroll table { min-width: max-content; }
  .err-msg { color: rgb(var(--c-danger-fg)); }
  /* .mono opts <a> out of the design system's a:not([class]) link ink — restore it. */
  a.mono { color: rgb(var(--c-brand-ink)); text-decoration: none; }

  form.filters { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: end; margin-bottom: var(--sp-4); }
  form.filters label { font-size: var(--fs-xs); color: rgb(var(--c-fg-muted)); display: flex; flex-direction: column; gap: 3px; }

  .pager { display: flex; gap: var(--sp-3); align-items: center; margin-top: var(--sp-4); font-size: var(--fs-sm); color: rgb(var(--c-fg-muted)); }
  .pager .muted { color: rgb(var(--c-fg-faint)); }

  .thread { display: flex; flex-direction: column; gap: var(--sp-3); }
  .bubble { max-width: 78%; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-xl); }
  .bubble.human { align-self: flex-start; background: rgb(var(--c-bg-sunken)); }
  .bubble.bot { align-self: flex-end; background: rgb(var(--c-bg-contrast)); }
  .bubble .who { font-size: var(--fs-xs); color: rgb(var(--c-fg-muted)); margin-bottom: 3px; }
  .bubble .text { white-space: pre-wrap; word-break: break-word; }

  .fcall { background: rgb(var(--c-bg-sunken)); border-radius: var(--r-md); padding: var(--sp-2) var(--sp-3); }
  .fcall summary { cursor: pointer; font-family: var(--font-mono); font-size: var(--fs-xs); color: rgb(var(--c-fg-body)); }
  .fcall pre { margin: var(--sp-2) 0 0; white-space: pre-wrap; word-break: break-word; }
  .fcall .label { color: rgb(var(--c-fg-muted)); font-size: var(--fs-xs); margin-top: var(--sp-2); }

  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; }
    .shell { flex-direction: column; }
    .sidebar { width: auto; flex-direction: row; flex-wrap: wrap; gap: var(--sp-2); padding: var(--sp-2); }
    .sidebar h6 { display: none; }
    .sidebar nav ul { flex-direction: row; flex-wrap: wrap; gap: var(--sp-1); }
    .sidebar nav a { padding: 3px var(--sp-2); }
    .main { padding: var(--sp-3); }
    .topbar h2 { font-size: var(--fs-xl); }
  }
  @media (max-width: 480px) {
    .kpi-value { font-size: var(--fs-2xl); }
    .kpis { gap: var(--sp-2); }
    ul.bars li { grid-template-columns: 90px 1fr 44px; }
    .bubble { max-width: 90%; }
  }
`
