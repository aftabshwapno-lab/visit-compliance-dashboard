const columns = [
  ["status", "Status"],
  ["officer", "Officer"],
  ["totalPlannedFullMonth", "Total Planned Visits (Full Month)"],
  ["totalPlannedTillDate", "Total Planned Visits (Till Date)"],
  ["acceptedResponses", "Accepted Responses"],
  ["plannedDateResponses", "Planned-Date Responses"],
  ["otherUnplannedResponses", "Other / Unplanned Responses"],
  ["distinctPlannedVisitsCompleted", "Distinct Planned Visits Completed"],
  ["remainingVisits", "Remaining Visits (No Response)"],
  ["neverVisitedOutlets", "Never Visited Outlets (Till Date)"],
  ["completionPct", "Completion %"]
];
const state = { data: null, status: "All statuses", officer: "All officers", search: "", sortKey: "status", sortDir: 1, activeDetailTab: "planned" };
const $ = id => document.getElementById(id);
const numberFmt = new Intl.NumberFormat("en-US");
function fmtDate(iso) { return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric", timeZone:"UTC" }); }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function pct(v) { return v == null || Number.isNaN(Number(v)) ? "—" : `${Number(v).toFixed(1)}%`; }
function completionStyle(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 80) return "background:#8fdb76;color:#133a18";
  if (n >= 60) return "background:#c4e68d;color:#294111";
  if (n >= 40) return "background:#f0e77a;color:#544c09";
  if (n >= 20) return "background:#f6bd72;color:#5d3510";
  return "background:#ef8d72;color:#5f1f12";
}
function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return state.data.officers.filter(r => {
    if (state.status !== "All statuses" && r.status !== state.status) return false;
    if (state.officer !== "All officers" && r.officer !== state.officer) return false;
    if (q && !r.officer.toLowerCase().includes(q)) return false;
    return true;
  });
}
function sortedRows(rows) {
  const key = state.sortKey, dir = state.sortDir;
  return [...rows].sort((a,b) => {
    const av=a[key], bv=b[key];
    if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
    if (typeof av === "number" || typeof bv === "number") return (Number(av)-Number(bv))*dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity:"base" })*dir;
  });
}
function updateOfficerOptions() {
  const previous = state.officer;
  const source = state.data.officers.filter(r => state.status === "All statuses" || r.status === state.status);
  const names = [...new Set(source.map(r => r.officer))].sort((a,b)=>a.localeCompare(b));
  $("officer-filter").innerHTML = ["All officers", ...names].map(v => `<option>${esc(v)}</option>`).join("");
  if (names.includes(previous)) $("officer-filter").value = previous; else { state.officer = "All officers"; $("officer-filter").value = state.officer; }
}
function renderHeader() {
  const m = state.data.metadata;
  document.title = m.title;
  $("page-title").textContent = m.title;
  $("subtitle").textContent = m.subtitle;
  $("snapshot-line").textContent = `Response snapshot through ${fmtDate(m.snapshotDate)}`;
  $("snapshot-note").textContent = `Till-date plans are due through this date; full-month plans cover all of ${m.reportMonth}.`;
  const statuses = ["All statuses", ...new Set(state.data.officers.map(r=>r.status))];
  $("status-filter").innerHTML = statuses.map(v=>`<option>${esc(v)}</option>`).join("");
  updateOfficerOptions();
}
function renderKpis(rows) {
  const visibleOfficers = rows.filter(r => state.data.metadata.includeUnmappedInVisibleOfficerKpi || r.status !== "Unmapped").length;
  const total = key => rows.reduce((t,r)=>t+(Number(r[key])||0),0);
  const till = total("totalPlannedTillDate"), completed = total("distinctPlannedVisitsCompleted");
  const cards = [
    ["Visible Officers", visibleOfficers],
    ["Total Planned Visits<br>(Full Month)", total("totalPlannedFullMonth")],
    ["Planned Visits<br>Till Date", till],
    ["Accepted<br>Responses", total("acceptedResponses")],
    ["Planned Visits<br>Completed", completed],
    ["Remaining Visits<br>(No Response)", total("remainingVisits")],
    ["Never Visited<br>Outlets Till Date", total("neverVisitedOutlets")],
    ["Completion<br>%", till ? `${(completed/till*100).toFixed(1)}%` : "—"]
  ];
  $("kpis").innerHTML = cards.map(([label,value]) => `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${typeof value === "number" ? numberFmt.format(value) : value}</div></div>`).join("");
}
function renderTable(rows) {
  const head = $("performance-head");
  head.innerHTML = columns.map(([key,label]) => `<th data-key="${key}">${esc(label)} <span class="sort">${state.sortKey===key ? (state.sortDir===1?"▲":"▼") : "↕"}</span></th>`).join("");
  head.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
    const key=th.dataset.key; if (state.sortKey===key) state.sortDir*=-1; else { state.sortKey=key; state.sortDir=1; } render();
  }));
  const sorted = sortedRows(rows);
  $("performance-body").innerHTML = sorted.map(r => `<tr>${columns.map(([key]) => {
    const val=r[key];
    if (key==="completionPct") return `<td class="completion-cell" style="${completionStyle(val)}">${pct(val)}</td>`;
    if (typeof val === "number") return `<td>${numberFmt.format(val)}</td>`;
    return `<td>${esc(val)}</td>`;
  }).join("")}</tr>`).join("");
  const total = key => rows.reduce((t,r)=>t+(Number(r[key])||0),0);
  $("summary-caption").textContent = `${rows.length} displayed rows · ${numberFmt.format(total("totalPlannedFullMonth"))} planned visits full month · ${numberFmt.format(total("totalPlannedTillDate"))} planned visits till date · ${numberFmt.format(total("remainingVisits"))} remaining with no response · ${numberFmt.format(total("neverVisitedOutlets"))} never visited outlets`;
}
function detailTable(rows, type) {
  if (!rows.length) return `<div class="details-message">No records in this section.</div>`;
  const cols = type === "never" ? [["siteCode","Outlet Code"],["outletName","Outlet Name"]] : [["plannedDate","Planned Date"],["siteCode","Outlet Code"],["outletName","Outlet Name"]];
  return `<div class="detail-table-wrap"><table class="detail-table"><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(([k])=>`<td>${k==="plannedDate"?fmtDate(r[k]):esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function renderDetails(rows) {
  const target=$("details-section");
  if (rows.length!==1) { target.innerHTML=`<div class="details-message"><strong>Officer outlet details:</strong> Select an officer, or search until only one officer remains, to see planned outlets, remaining outlet/date assignments, and distinct outlets never visited through the snapshot.</div>`; return; }
  const row=rows[0], d=state.data.details[row.officerKey] || {planned:[],remaining:[],neverVisited:[]};
  const tabs=[
    ["planned",`Planned outlets (${d.planned.length})`],
    ["remaining",`Remaining visits (${d.remaining.length})`],
    ["never",`Never visited outlets (${d.neverVisited.length})`]
  ];
  const tabRows = state.activeDetailTab==="planned" ? d.planned : state.activeDetailTab==="remaining" ? d.remaining : d.neverVisited;
  target.innerHTML=`<div class="details-title">Officer outlet details — ${esc(row.status)} · ${esc(row.officer)}</div><div class="tabs">${tabs.map(([k,l])=>`<button class="tab-btn ${state.activeDetailTab===k?"active":""}" data-tab="${k}">${l}</button>`).join("")}</div><div id="detail-content">${detailTable(tabRows,state.activeDetailTab)}</div>`;
  target.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click",()=>{state.activeDetailTab=b.dataset.tab;renderDetails(rows);}));
}
function renderDefinitions() {
  const d=state.data.definitions;
  $("definitions-text").textContent = `${d.fullMonth} ${d.remaining} ${d.neverVisited} ${d.completion}`;
  const m=state.data.metadata;
  const unmapped=m.diagnostics.unmappedResponseNames?.length ? ` · Unmapped response names: ${m.diagnostics.unmappedResponseNames.join(", ")}` : "";
  $("source-footer").textContent=`Data source: ${m.scheduleFile} + ${m.responseFile} · Generated ${new Date(m.generatedAt).toLocaleString()}${unmapped}`;
}
function render() {
  const rows=getFiltered();
  renderKpis(rows); renderTable(rows); renderDetails(rows);
}
function csvEscape(v) { const s=String(v??""); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
function downloadCsv() {
  const rows=sortedRows(getFiltered());
  const lines=[columns.map(c=>csvEscape(c[1])).join(",")];
  for (const r of rows) lines.push(columns.map(([k])=>csvEscape(k==="completionPct"?pct(r[k]):r[k])).join(","));
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="visible_visit_compliance.csv"; a.click(); URL.revokeObjectURL(a.href);
}
async function init() {
  try {
    const res=await fetch("data/dashboard_data.json",{cache:"no-store"});
    if(!res.ok) throw new Error(`dashboard_data.json returned ${res.status}`);
    state.data=await res.json();
    renderHeader(); renderDefinitions(); render();
    $("status-filter").addEventListener("change",e=>{state.status=e.target.value;updateOfficerOptions();render();});
    $("officer-filter").addEventListener("change",e=>{state.officer=e.target.value;render();});
    $("officer-search").addEventListener("input",e=>{state.search=e.target.value;render();});
    $("reset-btn").addEventListener("click",()=>{state.status="All statuses";state.officer="All officers";state.search="";$("status-filter").value=state.status;$("officer-search").value="";updateOfficerOptions();render();});
    $("download-btn").addEventListener("click",downloadCsv);
  } catch(err) {
    document.querySelector("main").innerHTML=`<div class="error-box"><strong>Dashboard could not load.</strong>\n${esc(err.message)}\n\nIf this is a new GitHub repository, open the Actions tab and confirm the Deploy Visit Compliance Dashboard workflow completed successfully.</div>`;
  }
}
init();
