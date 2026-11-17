// === Data ===
const DATA = {};
const FILES = ["crafts", "hobbies", "formats", "materials", "scope", "techniques", "quirks", "styles", "common_tools", "templates", "conflicts"];

// === State ===
const EXCLUDED_KEY = "wtf-make-excluded-v1";
let excluded = new Set(JSON.parse(localStorage.getItem(EXCLUDED_KEY) || "[]"));
let lastIdea = null;

// Multi-select state for hobbies and tools (Set preserves insertion order)
const selectedHobbies = new Set();
const selectedTools = new Set();

// === Init ===
async function init() {
  await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      DATA[name] = await res.json();
    })
  );
  buildCraftSelect();

  buildCombo({
    rootId: "hobbies-combo",
    inputId: "hobbies-input",
    pillsId: "hobbies-pills",
    popoverId: "hobbies-popover",
    listId: "hobbies-list",
    selected: selectedHobbies,
    grouped: true,
    groupedSource: DATA.hobbies,
    allowFreeText: true,
    actions: [],
  });

  buildCombo({
    rootId: "tools-combo",
    inputId: "tools-input",
    pillsId: "tools-pills",
    popoverId: "tools-popover",
    listId: "tools-list",
    selected: selectedTools,
    grouped: false,
    flatSource: DATA.common_tools.map((t) => t.text),
    allowFreeText: true,
    actions: [
      { id: "all", label: "select all", fn: () => DATA.common_tools.forEach((t) => selectedTools.add(t.text)) },
      { id: "clear", label: "clear", fn: () => selectedTools.clear() },
    ],
  });

  updateToolsVisibility();
  document.getElementById("craft-select").addEventListener("change", updateToolsVisibility);

  renderExcluded();
  document.getElementById("generate").addEventListener("click", generate);
  document.getElementById("reroll").addEventListener("click", generate);
  document.getElementById("clear-excluded").addEventListener("click", clearExcluded);
}

function buildCraftSelect() {
  const sel = document.getElementById("craft-select");
  DATA.crafts.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

// Hide tools field for crafts that don't use them. For "surprise me" (*) keep it visible.
function updateToolsVisibility() {
  const craftId = document.getElementById("craft-select").value;
  const wrapper = document.getElementById("tools-field-wrapper");
  if (craftId === "*") {
    wrapper.hidden = false;
    return;
  }
  const craft = DATA.crafts.find((c) => c.id === craftId);
  wrapper.hidden = !craft || craft.usesTools === false;
}

// === Generic combo factory ===
function buildCombo(cfg) {
  const wrapper = document.getElementById(cfg.rootId);
  const field = wrapper.querySelector(".combo-field");
  const input = document.getElementById(cfg.inputId);
  const popover = document.getElementById(cfg.popoverId);

  let filterQuery = "";

  function render() {
    renderPills();
    renderList();
  }

  function renderPills() {
    const container = document.getElementById(cfg.pillsId);
    container.innerHTML = "";
    [...cfg.selected].forEach((text) => {
      const pill = document.createElement("span");
      pill.className = "combo-pill";
      pill.innerHTML = `${escapeHtml(text)}<span class="combo-pill-x">✕</span>`;
      pill.querySelector(".combo-pill-x").addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        cfg.selected.delete(text);
        render();
      });
      container.appendChild(pill);
    });
  }

  function renderList() {
    const list = document.getElementById(cfg.listId);
    list.innerHTML = "";

    // "Add custom" row when query exists and isn't already in source/selected
    if (cfg.allowFreeText && filterQuery) {
      const sourceTexts = cfg.grouped
        ? cfg.groupedSource.flatMap((g) => g.items)
        : cfg.flatSource;
      const exactMatch = sourceTexts.some((t) => t.toLowerCase() === filterQuery);
      const alreadyAdded = [...cfg.selected].some((t) => t.toLowerCase() === filterQuery);
      if (!exactMatch && !alreadyAdded) {
        const row = document.createElement("div");
        row.className = "combo-add-custom";
        row.innerHTML = `+ add "${escapeHtml(input.value.trim())}"`;
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          cfg.selected.add(input.value.trim());
          input.value = "";
          filterQuery = "";
          render();
          input.focus();
        });
        list.appendChild(row);
      }
    }

    // Options
    if (cfg.grouped) {
      cfg.groupedSource.forEach((group) => {
        const matchingItems = group.items.filter((t) =>
          !filterQuery || t.toLowerCase().includes(filterQuery)
        );
        if (matchingItems.length === 0) return;
        const header = document.createElement("div");
        header.className = "combo-group-label";
        header.textContent = group.category;
        list.appendChild(header);
        matchingItems.forEach((t) => list.appendChild(makeOption(t)));
      });
    } else {
      cfg.flatSource
        .filter((t) => !filterQuery || t.toLowerCase().includes(filterQuery))
        .forEach((t) => list.appendChild(makeOption(t)));
    }

    if (list.children.length === 0) {
      list.innerHTML = `<div class="combo-empty">no matches</div>`;
    }
  }

  function makeOption(text) {
    const opt = document.createElement("div");
    opt.className = "combo-option";
    opt.setAttribute("role", "option");
    opt.dataset.selected = cfg.selected.has(text) ? "true" : "false";
    opt.setAttribute("aria-selected", opt.dataset.selected);
    opt.innerHTML = `<span class="combo-checkbox"></span><span>${escapeHtml(text)}</span>`;
    opt.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (cfg.selected.has(text)) cfg.selected.delete(text);
      else cfg.selected.add(text);
      input.value = "";
      filterQuery = "";
      render();
      input.focus();
    });
    return opt;
  }

  // Action buttons in popover
  const actionsContainer = popover.querySelector(".combo-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = "";
    cfg.actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "combo-action";
      btn.textContent = a.label;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        a.fn();
        render();
        input.focus();
      });
      actionsContainer.appendChild(btn);
    });
  }

  // Clicking the field anywhere → focus input
  field.addEventListener("click", (e) => {
    if (e.target === field || e.target.classList.contains("combo-pills")) {
      input.focus();
    }
  });

  function open() {
    popover.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function close() {
    popover.hidden = true;
    input.setAttribute("aria-expanded", "false");
    filterQuery = "";
    input.value = "";
    renderList();
  }

  input.addEventListener("focus", () => {
    wrapper.dataset.focused = "true";
    open();
  });

  input.addEventListener("input", (e) => {
    filterQuery = e.target.value.toLowerCase().trim();
    renderList();
    open();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.blur();
      close();
    } else if (e.key === "Backspace" && input.value === "" && cfg.selected.size > 0) {
      const last = [...cfg.selected].pop();
      cfg.selected.delete(last);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const firstRow = popover.querySelector(".combo-add-custom, .combo-option");
      if (firstRow) {
        firstRow.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      } else if (cfg.allowFreeText && input.value.trim()) {
        cfg.selected.add(input.value.trim());
        input.value = "";
        filterQuery = "";
        render();
      }
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.dataset.focused = "false";
      close();
    }
  });

  render();
}

// === Generation ===
function generate() {
  const craftId = document.getElementById("craft-select").value;
  const chosenCraft = craftId === "*"
    ? pick(DATA.crafts)
    : DATA.crafts.find((c) => c.id === craftId);

  const formatPool = filterPool(DATA.formats, chosenCraft.id);
  const materialPool = filterPool(DATA.materials, chosenCraft.id);
  const scopePool = filterPool(DATA.scope, chosenCraft.id);
  const techniquePool = filterPool(DATA.techniques, chosenCraft.id);
  const quirkPool = filterPool(DATA.quirks, chosenCraft.id);
  const stylePool = filterPool(DATA.styles, chosenCraft.id);

  if (!formatPool.length) {
    showError(`Not enough format options for ${chosenCraft.label} after exclusions.`);
    return;
  }
  if (!materialPool.length) {
    showError(`Not enough material options for ${chosenCraft.label} after exclusions.`);
    return;
  }

  // Drop up to 1 optional category (~40% chance)
  const optionalCats = ["scope", "technique", "quirk"];
  const dropCat = Math.random() < 0.4 ? pick(optionalCats) : null;

  // Tools: only include if the craft uses tools AND user selected some.
  // Pick 1, with ~10% chance of 2.
  let toolsForIdea = [];
  if (chosenCraft.usesTools !== false && selectedTools.size > 0) {
    const tools = [...selectedTools];
    const count = (tools.length >= 2 && Math.random() < 0.1) ? 2 : 1;
    toolsForIdea = shuffle(tools).slice(0, count);
  }

  // Style: independent 30% inclusion roll (only if pool has items)
  const includeStyle = stylePool.length > 0 && Math.random() < 0.3;

  // Build parts, re-rolling to dodge over-constrained / contradictory combos.
  // After a few failed tries, drop one optional slot so we always emit something.
  const buildParts = (dropExtra) => ({
    format: pick(formatPool),
    material: pick(materialPool),
    scope: dropCat === "scope" || dropExtra === "scope" || !scopePool.length ? null : pick(scopePool),
    technique: dropCat === "technique" || dropExtra === "technique" || !techniquePool.length ? null : pick(techniquePool),
    quirk: dropCat === "quirk" || dropExtra === "quirk" || !quirkPool.length ? null : pick(quirkPool),
    style: includeStyle && dropExtra !== "style" ? pick(stylePool) : null,
    tools: toolsForIdea,
  });

  let parts = buildParts(null);
  const MAX_TRIES = 40;
  for (let i = 0; i < MAX_TRIES && hasConflict(parts); i++) {
    parts = buildParts(null);
  }
  // Still conflicting? Drop optional slots until the combo is clean.
  if (hasConflict(parts)) {
    for (const slot of ["quirk", "style", "technique", "scope"]) {
      parts = buildParts(slot);
      if (!hasConflict(parts)) break;
    }
  }

  const themeClause = buildThemeClause([...selectedHobbies]);
  const template = pick(DATA.templates[chosenCraft.id]);
  const idea = fillTemplate(template, parts, themeClause);

  lastIdea = { idea, parts, craft: chosenCraft };
  renderOutput(idea, parts);
}

function buildThemeClause(hobbiesArr) {
  if (!hobbiesArr.length) return "";
  const sample = shuffle(hobbiesArr).slice(0, Math.random() < 0.4 && hobbiesArr.length > 1 ? 2 : 1);
  if (sample.length === 1) return `about ${escapeHtml(sample[0])}`;
  return `that fuses ${escapeHtml(sample[0])} and ${escapeHtml(sample[1])}`;
}

function buildToolsClause(tools) {
  if (!tools.length) return "";
  if (tools.length === 1) return escapeHtml(tools[0]);
  if (tools.length === 2) return `${escapeHtml(tools[0])} and ${escapeHtml(tools[1])}`;
  const last = tools[tools.length - 1];
  const rest = tools.slice(0, -1).map(escapeHtml).join(", ");
  return `${rest}, and ${escapeHtml(last)}`;
}

function replaceOrStrip(text, token, replacement) {
  if (replacement !== null) return text.replace(token, replacement);
  return text.replace(
    new RegExp(`(^|\\n)[A-Za-z]+:\\s*${escapeRegex(token)}(?=\\n|\\.|$)`, "g"),
    ""
  );
}

function fillTemplate(template, parts, themeClause) {
  const wrap = (v) => `<span class="slot">${escapeHtml(v)}</span>`;
  let out = template
    .replace("{format}", wrap(parts.format.text))
    .replace("{material}", wrap(parts.material.text))
    .replace("{theme_clause}", themeClause ? `<span class="slot">${themeClause}</span>` : "");

  const toolsClause = buildToolsClause(parts.tools);
  out = replaceOrStrip(out, "{tools_clause}", toolsClause ? `<span class="slot">${toolsClause}</span>` : null);
  out = replaceOrStrip(out, "{style}", parts.style ? wrap(parts.style.text) : null);
  out = replaceOrStrip(out, "{scope}", parts.scope ? wrap(parts.scope.text) : null);
  out = replaceOrStrip(out, "{technique}", parts.technique ? wrap(parts.technique.text) : null);
  out = replaceOrStrip(out, "{quirk}", parts.quirk ? wrap(parts.quirk.text) : null);

  // Cleanup
  out = out
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  // a/an fix
  out = out.replace(/\b(a|A)\s+(<span class="slot">)([aeiouAEIOU])/g, "$1n $2$3");
  out = out.replace(/\b(a|A)\s+([aeiouAEIOU])/g, "$1n $2");

  return out;
}

// === Conflicts ===
// A combo is invalid if any conflict rule's items are all present in the chosen parts.
function hasConflict(parts) {
  const chosen = new Set(
    [parts.format, parts.material, parts.scope, parts.technique, parts.quirk, parts.style]
      .filter(Boolean)
      .map((p) => p.text)
  );
  return (DATA.conflicts || []).some((rule) => rule.items.every((t) => chosen.has(t)));
}

// === Pool filtering ===
function filterPool(pool, craftId) {
  return pool.filter((item) => isCompatible(item, craftId) && !excluded.has(item.text));
}

function isCompatible(item, craftId) {
  return item.crafts.includes("*") || item.crafts.includes(craftId);
}

// === Output rendering ===
function renderOutput(ideaHtml, parts) {
  const out = document.getElementById("output");
  out.hidden = false;
  document.getElementById("idea").innerHTML = ideaHtml;

  const chips = document.getElementById("chips");
  chips.innerHTML = "";
  const entries = [
    ["format", parts.format],
    ["material", parts.material],
    ["style", parts.style],
    ["scope", parts.scope],
    ["technique", parts.technique],
    ["quirk", parts.quirk],
  ];
  entries.forEach(([cat, item]) => {
    if (!item) return;
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.innerHTML = `<span class="chip-cat">${cat}</span> ${escapeHtml(item.text)}`;
    chip.addEventListener("click", () => excludeItem(item.text));
    chips.appendChild(chip);
  });

  out.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(msg) {
  const out = document.getElementById("output");
  out.hidden = false;
  document.getElementById("idea").textContent = msg;
  document.getElementById("chips").innerHTML = "";
}

// === Exclusions ===
function excludeItem(text) {
  excluded.add(text);
  persistExcluded();
  renderExcluded();
  generate();
}

function restoreItem(text) {
  excluded.delete(text);
  persistExcluded();
  renderExcluded();
}

function clearExcluded() {
  excluded.clear();
  persistExcluded();
  renderExcluded();
}

function persistExcluded() {
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify([...excluded]));
}

function renderExcluded() {
  const section = document.getElementById("excluded-section");
  const container = document.getElementById("excluded-chips");
  container.innerHTML = "";
  if (excluded.size === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  [...excluded].forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => restoreItem(text));
    container.appendChild(chip);
  });
}

// === Utils ===
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

init();
