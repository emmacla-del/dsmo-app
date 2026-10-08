// Layout and navigation checks for /register, measured in a real browser.
//
// These are not screenshots: every assertion is a number read off the live
// page, because the properties that matter here are exactly the ones a
// screenshot cannot state -- whether the DOCUMENT scrolls, how many scroll
// containers exist, whether an input has a border, and whether a side label
// sits on the same optical line as the text inside its input.
//
// Usage:  node scripts/test-register-layout.mjs [baseUrl]
//         BASE_URL=http://localhost:3005 node scripts/test-register-layout.mjs
//
// Needs a server already running (npm run dev, or npm run build && npm start).
// It deliberately does not start one: the port, the backend it talks to and
// whether it is a dev or production build are all the caller's decision.
import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const PAGE_URL = BASE.replace(/\/$/, "") + "/register";

// The viewports the layout is specified against: a normal desktop, a SHORT
// laptop (1366x680 is where a tall header used to squeeze the form to
// nothing), and a small phone.
const VIEWPORTS = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x680", width: 1366, height: 680 },
  { name: "360x640", width: 360, height: 640 },
];

const FRAME_MAX_WIDTH = 600;
const FIELD_HEIGHT = 40;

let failures = 0;
let checks = 0;

// The continue link is present on the furthest revealed section whether or
// not that section is complete, and carries aria-disabled while it is not.
// Playwright refuses to click an aria-disabled control, which is exactly the
// distinction these helpers keep: continueOn() is "move on", clickBlocked()
// is "ask what is missing".
async function continueEnabled(page) {
  const el = await page.$(".flow-continue-link");
  if (!el) return false;
  return (await el.getAttribute("aria-disabled")) !== "true";
}

// A context that never restores a draft.
//
// The wizard saves to sessionStorage and puts the answers back on the next
// load, which is exactly what it should do -- and exactly what makes a
// runner that walks seven entity types in one context land in section 4 on
// its second pass instead of on the type list. The init script runs before
// the page's own scripts on every navigation, so there is never a draft to
// restore in the first place.
async function newCleanContext(browser, options) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* private mode / blocked storage: nothing to clear */
    }
  });
  return context;
}

// The nth step (1-based) of whichever navigation is on screen.
function railItem(page, n) {
  return page.locator(RAIL_ITEMS).locator("visible=true").nth(n - 1);
}

async function continueOn(page) {
  if (!(await continueEnabled(page))) return false;
  await page.click(".flow-continue-link");
  await page.waitForTimeout(300);
  return true;
}

function check(ok, label, detail) {
  checks++;
  const suffix = detail ? " — " + detail : "";
  if (ok) {
    console.log("  PASS  " + label + suffix);
  } else {
    failures++;
    console.log("  FAIL  " + label + suffix);
  }
}

// ── Measurements, run inside the page ────────────────────────────────────

const measureLayout = () => {
  const doc = document.documentElement;
  // Every element that can scroll AND whose content exceeds its box. Both
  // halves matter: an element with overflow:auto that is not currently
  // overflowing is still a scrollbar waiting to appear.
  const scrollers = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const scrollableY = /(auto|scroll|overlay)/.test(cs.overflowY);
    const scrollableX = /(auto|scroll|overlay)/.test(cs.overflowX);
    const overflowsY = el.scrollHeight > el.clientHeight + 1;
    const overflowsX = el.scrollWidth > el.clientWidth + 1;
    if ((scrollableY && overflowsY) || (scrollableX && overflowsX)) {
      const cls = String(el.className || "").trim();
      scrollers.push({
        selector: el.tagName.toLowerCase() + (cls ? "." + cls.split(/\s+/).join(".") : ""),
        overflowsY,
        overflowsX,
      });
    }
  }
  const frame = document.querySelector(".flow-frame");
  // A BOX inside the frame would be the "frame inside a frame" this layout
  // exists to remove. Counted by sides, not by total width: a rule on one
  // edge is a separator (the radio list's row dividers, the subsection
  // heading's underline) and is not a box. Three or more edges is.
  // Controls are meant to be boxed; containers are not.
  const skip = ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "TABLE", "TD", "TH", "TR", "HR"];
  const borderedExtras = [];
  for (const el of document.querySelectorAll(".flow-frame-scroll *")) {
    if (skip.includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none") continue;
    const sides = ["Top", "Right", "Bottom", "Left"].filter(
      (s) =>
        parseFloat(cs["border" + s + "Width"]) > 0 &&
        cs["border" + s + "Style"] !== "none"
    );
    if (sides.length >= 3) {
      borderedExtras.push(String(el.className || el.tagName) + " [" + sides.join("+") + "]");
    }
  }
  const seal = document.querySelector(".seal");
  return {
    docScrollHeight: doc.scrollHeight,
    docClientHeight: doc.clientHeight,
    docScrollWidth: doc.scrollWidth,
    docClientWidth: doc.clientWidth,
    scrollers,
    frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null,
    borderedExtras,
    sealVisible: !!seal && getComputedStyle(seal).display !== "none",
  };
};

const measureControls = () => {
  const out = [];
  for (const el of document.querySelectorAll(".flow-frame-scroll input, .flow-frame-scroll select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    const kind = el.tagName === "SELECT" ? "select" : el.getAttribute("type") || "__none__";
    out.push({
      id: el.id || el.name || "(anon)",
      tag: el.tagName.toLowerCase(),
      kind,
      hasTypeAttr: el.tagName !== "INPUT" || el.hasAttribute("type"),
      height: Math.round(r.height),
      borderWidth: parseFloat(cs.borderTopWidth),
      borderStyle: cs.borderTopStyle,
      fontSize: parseFloat(cs.fontSize),
    });
  }
  return out;
};

// Label/input optical alignment: the centre of the label's FIRST LINE box
// against the centre of the input's text. The first line, not the whole
// label box, because a two-line bilingual label must still align on line one.
const measureLabelAlignment = () => {
  const rows = [];
  for (const field of document.querySelectorAll(".flow-frame-scroll .field")) {
    const label = field.querySelector(":scope > label");
    const control = field.querySelector("input, select");
    if (!label || !control) continue;
    const lr = label.getBoundingClientRect();
    const cr = control.getBoundingClientRect();
    if (lr.height === 0 || cr.height === 0) continue;
    const ls = getComputedStyle(label);
    const lineHeight = parseFloat(ls.lineHeight) || parseFloat(ls.fontSize) * 1.3;
    const padTop = parseFloat(ls.paddingTop);
    const labelFirstLineCentre = lr.top + padTop + lineHeight / 2;
    const controlTextCentre = cr.top + cr.height / 2;
    rows.push({
      id: control.id || "(anon)",
      sideBySide: lr.right <= cr.left + 1,
      stacked: lr.bottom <= cr.top + 1,
      delta: Math.round((labelFirstLineCentre - controlTextCentre) * 10) / 10,
      labelColor: ls.color,
    });
  }
  return rows;
};

const measurePlaceholderVsLabel = () => {
  const field = document.querySelector(".flow-frame-scroll .field");
  if (!field) return null;
  const label = field.querySelector(":scope > label");
  if (!label) return null;

  // getComputedStyle cannot reach ::placeholder, so the applied rule is read
  // out of the stylesheet itself -- the rule, not the token, because a token
  // nothing references proves nothing.
  let declared = null;
  let fontSize = null;
  let fontWeight = null;
  let opacity = null;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of rules) {
      if (!rule.selectorText) continue;
      if (rule.selectorText.indexOf("::placeholder") === -1) continue;
      if (rule.selectorText.indexOf("cam-form-flow") === -1) continue;
      declared = rule.style.color;
      fontSize = rule.style.fontSize;
      fontWeight = rule.style.fontWeight;
      opacity = rule.style.opacity;
    }
  }
  // Resolve a var() reference against :root so the comparison is in real
  // values -- colour space for the colour, and the token's own value for the
  // size and weight, which the stylesheet now declares as tokens too.
  const resolveVar = (value) => {
    const m = value && value.match(/var\(\s*(--[\w-]+)/);
    return m
      ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
      : value;
  };
  return {
    labelColor: getComputedStyle(label).color,
    declared,
    resolved: resolveVar(declared),
    fontSize: resolveVar(fontSize),
    fontWeight: resolveVar(fontWeight),
    opacity: resolveVar(opacity),
  };
};

// The step navigation is the horizontal rail on a narrow screen and the
// dossier panel's vertical list from 1080px; only one of the two is rendered
// at a time. Both carry the same states and accessible names, so every rail
// check reads whichever one is on screen. On the list, the state class sits
// on the <li> around the button.
const RAIL_ITEMS = ".progress-rail .progress-step-item, .step-list .step-list-button";

const railStates = () =>
  Array.from(
    document.querySelectorAll(".progress-rail .progress-step-item, .step-list .step-list-button")
  ).filter((b) => b.offsetParent !== null).map((b) => {
    const circle = b.querySelector(".progress-step-circle");
    const labelEl = b.querySelector(".progress-step-label, .step-list-name");
    const stateEl = b.closest(".step-list-item") || b;
    return {
      label: labelEl ? labelEl.textContent.trim() : "",
      labelHidden: labelEl ? getComputedStyle(labelEl).display === "none" : true,
      cls: Array.from(stateEl.classList).find((c) => c.indexOf("is-") === 0) || "",
      // aria-disabled, not the `disabled` property: a locked item still takes
      // a click, which is how it gets to say what the current section is
      // missing. See item 11 trigger (d).
      disabled: b.getAttribute("aria-disabled") === "true",
      hasCheck: !!b.querySelector("svg"),
      ariaCurrent: b.getAttribute("aria-current"),
      ariaLabel: b.getAttribute("aria-label"),
      title: b.getAttribute("title"),
      circleBorderStyle: getComputedStyle(circle).borderTopStyle,
      circleSize: Math.round(circle.getBoundingClientRect().width),
    };
  });

function rgbLuminance(css) {
  const m = css.match(/\d+(\.\d+)?/g);
  if (!m) return null;
  const [r, g, b] = m.slice(0, 3).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexLuminance(hex) {
  const h = hex.replace("#", "");
  return (
    0.2126 * parseInt(h.slice(0, 2), 16) +
    0.7152 * parseInt(h.slice(2, 4), 16) +
    0.0722 * parseInt(h.slice(4, 6), 16)
  );
}

// ── The run ──────────────────────────────────────────────────────────────

async function runViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".flow-frame-scroll");

  console.log("\n── " + vp.name + " ──");

  // Controls are collected from EVERY section as it comes on screen, not
  // just the last one: the two inputs that shipped without a type attribute
  // were in section 2, which a sweep of the tall section 3 never sees.
  const allControls = [];

  // Measured three times: on the short first section, on section 2, and on
  // the tall entity section, which is the one that actually makes the frame
  // scroll. A layout that holds only while nothing overflows is untested.
  for (const phase of ["section 1", "section 2", "section 3 (tall)"]) {
    if (phase === "section 2") {
      await page.click('input[name="entityType"][value="vocationalTraining"]');
      await page.waitForTimeout(300);
    }
    if (phase === "section 3 (tall)") {
      await page.fill("#reg-first-name", "Emmanuel");
      await page.fill("#reg-last-name", "Biya");
      await page.selectOption("#reg-function", { index: 1 });
      await page.fill("#reg-email", "layout." + Date.now() + "@example.cm");
      await page.fill("#reg-phone1", "655000000");
      await page.fill("#reg-phone2", "233000000");
      await page.waitForTimeout(500);
      await continueOn(page);
      await page.waitForTimeout(300);
    }
    allControls.push(...(await page.evaluate(measureControls)));

    const L = await page.evaluate(measureLayout);
    const tag = " [" + phase + "]";

    check(
      L.docScrollHeight === L.docClientHeight,
      "document does not scroll" + tag,
      "scrollHeight=" + L.docScrollHeight + " clientHeight=" + L.docClientHeight
    );
    check(
      L.docScrollWidth <= L.docClientWidth,
      "no horizontal page scroll" + tag,
      "scrollWidth=" + L.docScrollWidth + " clientWidth=" + L.docClientWidth
    );
    const names = L.scrollers.map((s) => s.selector);
    check(
      L.scrollers.every((s) => s.selector.indexOf("flow-frame-scroll") !== -1),
      "the only scroll container is .flow-frame-scroll" + tag,
      names.length ? names.join(", ") : "(nothing overflowing)"
    );
    check(
      L.scrollers.every((s) => !s.overflowsX),
      "nothing scrolls horizontally" + tag
    );
    check(
      L.frameWidth !== null && L.frameWidth <= FRAME_MAX_WIDTH,
      "frame width <= " + FRAME_MAX_WIDTH + "px" + tag,
      L.frameWidth + "px"
    );
    check(
      L.borderedExtras.length === 0,
      "no bordered container inside the frame" + tag,
      L.borderedExtras.join(" | ") || "none"
    );
    if (phase === "section 1") {
      check(!L.sealVisible, "no emblem placeholder on this route");
    }
  }

  // Controls, across every section that came on screen above.
  const controls = allControls;
  const untyped = controls.filter((c) => c.tag === "input" && !c.hasTypeAttr);
  check(
    untyped.length === 0,
    "no wizard input lacks a type attribute",
    untyped.map((c) => c.id).join(", ") || controls.length + " controls seen"
  );

  const sized = controls.filter(
    (c) => ["text", "email", "tel", "password", "select"].indexOf(c.kind) !== -1
  );
  const wrongHeight = sized.filter((c) => Math.abs(c.height - FIELD_HEIGHT) > 1);
  check(
    sized.length > 0 && wrongHeight.length === 0,
    "every text/email/tel/password control and select is " + FIELD_HEIGHT + "px",
    wrongHeight.map((c) => c.id + "=" + c.height + "px").join(", ") ||
      sized.length + " controls"
  );
  const borderless = sized.filter((c) => !(c.borderWidth > 0) || c.borderStyle === "none");
  check(
    borderless.length === 0,
    "every such control has a visible border",
    borderless.map((c) => c.id).join(", ") || "none"
  );

  if (vp.width <= 640) {
    const small = sized.filter((c) => c.fontSize < 16);
    check(
      small.length === 0,
      "controls are >= 16px, so iOS does not zoom in on focus",
      small.map((c) => c.id + "=" + c.fontSize + "px").join(", ") || sized.length + " controls"
    );
  }

  // Label placement.
  const align = await page.evaluate(measureLabelAlignment);
  check(align.length > 0, "label/input rows found to measure", align.length + " rows");
  if (align.length > 0) {
    if (vp.width >= 1000) {
      const notSide = align.filter((r) => !r.sideBySide);
      check(
        notSide.length === 0,
        "labels sit beside their inputs",
        notSide.map((r) => r.id).join(", ") || align.length + " rows"
      );
      const worst = align.reduce(
        (a, r) => (Math.abs(r.delta) > Math.abs(a.delta) ? r : a),
        align[0]
      );
      check(
        Math.abs(worst.delta) <= 2,
        "label line centre within 2px of the input text centre",
        "worst: " + worst.id + " " + worst.delta + "px"
      );
    } else {
      const notStacked = align.filter((r) => !r.stacked);
      check(
        notStacked.length === 0,
        "labels sit above their inputs at " + vp.width + "px",
        notStacked.map((r) => r.id).join(", ") || align.length + " rows"
      );
    }

    const pl = await page.evaluate(measurePlaceholderVsLabel);
    if (pl && pl.resolved) {
      const labelLum = rgbLuminance(pl.labelColor);
      const phLum = pl.resolved.indexOf("#") === 0
        ? hexLuminance(pl.resolved)
        : rgbLuminance(pl.resolved);
      check(
        phLum > labelLum,
        "placeholder colour is lighter than the label",
        "label=" + Math.round(labelLum) + " placeholder=" + Math.round(phLum) +
          " (" + pl.declared + " -> " + pl.resolved + ")"
      );
      check(
        parseFloat(pl.fontSize) > 0 && pl.fontWeight === "400" && pl.opacity === "1",
        "placeholder is 14px / weight 400 / opacity 1",
        pl.fontSize + " / " + pl.fontWeight + " / " + pl.opacity
      );
    } else {
      check(false, "the ::placeholder rule is readable", "no matching rule found");
    }
  }

  // Narrow: circles stay, labels go.
  if (vp.width < 560) {
    const rail = await page.evaluate(railStates);
    check(
      rail.every((r) => r.labelHidden),
      "rail labels hidden below 560px"
    );
    check(
      rail.every((r) => Math.abs(r.circleSize - 30) <= 1),
      "rail circles stay 30px",
      rail.map((r) => r.circleSize).join("/")
    );
  }

  await context.close();
}

async function runRail(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".step-list");

  console.log("\n── step navigation (1280x720: the dossier panel) ──");

  check(
    await page.isVisible(".flow-panel") && !(await page.isVisible(".flow-header")),
    "the dossier panel replaces the header at 1280px"
  );

  let rail = await page.evaluate(railStates);
  check(rail.length === 6, "six step items", String(rail.length));
  check(
    rail.slice(1).every((r) => r.disabled),
    "every unrevealed item is marked unavailable (aria-disabled)"
  );
  check(rail.every((r) => !r.hasCheck), "no check mark before anything is answered");
  check(
    /verrouill|lock/i.test(rail[5].ariaLabel || ""),
    "a locked item says so in its accessible name",
    rail[5].ariaLabel || ""
  );

  await page.click('input[name="entityType"][value="enterprise"]');
  await page.waitForTimeout(300);

  rail = await page.evaluate(railStates);
  check(
    rail[0].cls === "is-done" && rail[0].hasCheck,
    "picking a type turns the first circle green with a check",
    rail[0].cls
  );
  check(
    rail[1].ariaCurrent === "step",
    "Declarant becomes the current step",
    "aria-current=" + rail[1].ariaCurrent
  );
  const shown = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
  check(
    shown === "reg-section-title-respondent",
    "the frame now shows the Declarant section",
    shown || ""
  );
  check(
    /modifier|edit/i.test(rail[0].ariaLabel || ""),
    "a completed item offers editing in its accessible name",
    rail[0].ariaLabel || ""
  );
  // The summary is a visible line under the step name in the panel, and part
  // of the item's accessible name (the rail on a narrow screen keeps it in
  // its tooltip).
  check(
    /Entreprise|Company/.test(rail[0].ariaLabel || "") &&
      /Entreprise|Company/.test(
        (await page.textContent(".step-list-item.is-done .step-list-summary").catch(() => "")) || ""
      ),
    "a completed item shows its summary and carries it in its accessible name",
    rail[0].ariaLabel || ""
  );

  // Back to the type list.
  await railItem(page, 1).click();
  await page.waitForTimeout(250);
  check(
    await page.isVisible('input[name="entityType"]'),
    "clicking the first circle brings the type list back"
  );
  rail = await page.evaluate(railStates);
  check(
    rail[0].cls === "is-currentComplete",
    "the revisited, complete section is current + soft green",
    rail[0].cls
  );
  check(
    rail[1].cls === "is-revealed" && rail[1].circleBorderStyle === "dashed",
    "the section left behind, still empty, is a dashed gold ring",
    rail[1].cls + " / " + rail[1].circleBorderStyle
  );

  // Fill Declarant.
  await railItem(page, 2).click();
  await page.waitForTimeout(200);
  await page.fill("#reg-first-name", "Emmanuel");
  await page.fill("#reg-last-name", "Biya");
  await page.selectOption("#reg-function", { index: 1 });
  await page.fill("#reg-email", "rail." + Date.now() + "@example.cm");
  await page.fill("#reg-phone1", "655000000");
  await page.waitForTimeout(700);

  rail = await page.evaluate(railStates);
  check(!rail[5].hasCheck, "Recapitulatif still shows no check");
  check(
    rail[1].cls === "is-currentComplete",
    "Declarant reads as answered but is not pushed away (phone 2 is optional)",
    rail[1].cls
  );
  check(
    await continueEnabled(page),
    "a complete section with optional fields offers a working continue link"
  );

  // Optional field present and still usable: the proof the section did not
  // advance the instant its required fields were satisfied.
  //
  // Typed key by key, NOT page.fill: fill sets the whole value in one input
  // event, which is exactly what hid the bug where the first keystroke in
  // the last field opened the next section and swallowed the rest.
  await page.type("#reg-phone2", "233000000", { delay: 40 });
  await page.waitForTimeout(500);
  const whileTyping = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
  check(
    whileTyping === "reg-section-title-respondent" &&
      (await page.inputValue("#reg-phone2")) === "233000000",
    "typing into the LAST field keeps the section open until the respondent leaves it",
    whileTyping + " / " + (await page.inputValue("#reg-phone2").catch(() => "?"))
  );

  // Tab from the last field reaches Retour first, in the frame footer: a
  // respondent heading back must not be pushed forward on the way.
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  check(
    (await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby")) ===
      "reg-section-title-respondent",
    "tabbing from the LAST field onto Retour does not advance"
  );

  // Enter on the last field is the keyboard's "done here".
  await page.focus("#reg-phone2");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const afterPhone2 = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
  check(
    afterPhone2 === "reg-section-title-entityInfo",
    "Enter on the changed LAST field advances to Informations",
    afterPhone2 || ""
  );
  const focusedAfter = await page.evaluate(() => document.activeElement?.id ?? null);
  check(
    focusedAfter === "reg-section-title-entityInfo",
    "focus lands on the new section's heading, not on <body>",
    focusedAfter || "body"
  );
  check(
    (await page.$$eval("h1", (hs) => hs.filter((h) => h.offsetParent !== null).length)) === 1,
    "exactly one visible <h1> on the page"
  );

  console.log("\n── entity-type guard ──");
  await page.fill("#reg-entity-companyName", "SARL Exemple");
  await page.waitForTimeout(250);

  await railItem(page, 1).click();
  await page.waitForTimeout(250);
  await page.click('input[name="entityType"][value="cooperative"]');
  await page.waitForTimeout(250);
  check(await page.isVisible(".leave-dialog"), "changing the type with data raises the dialog");

  await page.click(".leave-dialog .btn-secondary");
  await page.waitForTimeout(250);
  check(
    await page.isChecked('input[name="entityType"][value="enterprise"]'),
    "Cancel keeps the original type"
  );
  await railItem(page, 3).click();
  await page.waitForTimeout(250);
  check(
    (await page.inputValue("#reg-entity-companyName")) === "SARL Exemple",
    "Cancel keeps the Informations data"
  );

  await railItem(page, 1).click();
  await page.waitForTimeout(250);
  await page.click('input[name="entityType"][value="cooperative"]');
  await page.waitForTimeout(250);
  await page.click(".leave-dialog .btn-primary");
  await page.waitForTimeout(450);
  check(
    (await page.inputValue("#reg-first-name").catch(() => "")) === "Emmanuel",
    "Confirm leaves the Declarant untouched"
  );
  const landed = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
  check(landed === "reg-section-title-entityInfo", "Confirm lands on Informations", landed || "");
  check(
    (await page.inputValue("#reg-entity-cooperativeName").catch(() => "?")) === "",
    "Informations comes back empty"
  );

  await context.close();
}


// ── Labels: one line, one language, one column ───────────────────────────

const ENTITY_TYPES = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
  "vocationalTraining",
];

// Measured for every label in the section on screen: the rendered height of
// the label against the height of one line of it. A label that wrapped is
// two line boxes tall, which is the thing the subgrid layout exists to
// prevent -- and which no screenshot would tell you about.
const measureLabels = () => {
  const out = [];
  for (const field of document.querySelectorAll(".flow-frame-scroll .field")) {
    const label = field.querySelector(":scope > label");
    if (!label) continue;
    const r = label.getBoundingClientRect();
    if (r.height === 0) continue;
    const cs = getComputedStyle(label);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    out.push({
      // textContent includes the required marker ("*"), which is its own
      // element; the asterisk is not part of the label's wording.
      text: (label.childNodes.length ? label.textContent : "").replace(/\s*\*\s*$/, "").trim(),
      lines: Math.round((r.height - padding) / lineHeight),
      // Rounded: subpixel layout makes exact equality meaningless, and what
      // matters is that every input starts on the same visible x.
      labelRight: Math.round(r.right),
      width: Math.round(r.width),
    });
  }
  return out;
};

const measureInputWidths = () => {
  const out = [];
  for (const field of document.querySelectorAll(".flow-frame-scroll .field")) {
    const control = field.querySelector("input, select");
    if (!control) continue;
    const r = control.getBoundingClientRect();
    if (r.width === 0) continue;
    const hint = field.querySelector(".field-hint");
    out.push({
      id: control.id || "(anon)",
      width: Math.round(r.width),
      left: Math.round(r.left),
      size: field.className.includes("field--short")
        ? "short"
        : field.className.includes("field--medium")
          ? "medium"
          : "full",
      hintWidth: hint ? Math.round(hint.getBoundingClientRect().width) : null,
    });
  }
  return out;
};

async function openEntitySection(page, type) {
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".flow-frame-scroll");
  await page.click('input[name="entityType"][value="' + type + '"]');
  await page.waitForTimeout(250);
  await page.fill("#reg-first-name", "Emmanuel");
  await page.fill("#reg-last-name", "Biya");
  await page.selectOption("#reg-function", { index: 1 });
  await page.fill("#reg-email", "labels." + Date.now() + "@example.cm");
  await page.fill("#reg-phone1", "655000000");
  await page.waitForTimeout(400);
  // Required fields only -- the continue link is the path that never asks
  // for an optional one.
  const moved = await continueOn(page);
  await page.waitForTimeout(250);
  return moved;
}

async function runLabels(browser) {
  for (const locale of ["fr", "en"]) {
    const context = await newCleanContext(browser, {
      viewport: { width: 1280, height: 800 },
    });
    // The active locale comes from the NEXT_LOCALE cookie, read server-side
    // in src/i18n/request.ts; there is no /fr or /en path segment to use.
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: BASE },
    ]);
    const page = await context.newPage();

    console.log("\n\u2500\u2500 labels, locale=" + locale + " \u2500\u2500");

    let bilingual = [];
    let wrapped = [];
    let columnsPerType = [];

    for (const type of ENTITY_TYPES) {
      const moved = await openEntitySection(page, type);
      if (!moved) {
        check(false, type + ": could not reach section 3 with required fields only");
        continue;
      }
      const labels = await page.evaluate(measureLabels);
      if (labels.length === 0) {
        check(false, type + ": no labels measured");
        continue;
      }
      for (const l of labels) {
        // "/ " is the signature of the old combined strings
        // ("Raison sociale/ Company name"). " / " with spaces on BOTH sides
        // is legitimate -- "Projet / Programme" is one French name.
        if (/[^ ]\/ /.test(l.text)) bilingual.push(type + ": " + l.text);
        if (l.lines > 1) wrapped.push(type + ': "' + l.text + '" on ' + l.lines + " lines");
      }
      const rights = new Set(labels.map((l) => l.labelRight));
      columnsPerType.push({ type, rights: [...rights], count: labels.length });
    }

    check(
      bilingual.length === 0,
      "no label carries both languages",
      bilingual.slice(0, 4).join(" | ") || ENTITY_TYPES.length + " types checked"
    );
    check(
      wrapped.length === 0,
      "every label fits on one line at a 600px frame",
      wrapped.slice(0, 4).join(" | ") || "none wrapped"
    );
    const multiColumn = columnsPerType.filter((c) => c.rights.length > 1);
    check(
      multiColumn.length === 0,
      "the label column is one width for every field of a section",
      multiColumn.map((c) => c.type + " has " + c.rights.length + " edges").join(", ") ||
        columnsPerType.map((c) => c.type + "=" + c.rights[0] + "px").join(" ")
    );

    await context.close();
  }
}

// ── Field widths (item 13) ───────────────────────────────────────────────

async function runFieldWidths(browser) {
  const context = await newCleanContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  console.log("\n\u2500\u2500 field widths at a 600px frame \u2500\u2500");

  await openEntitySection(page, "enterprise");
  const widths = await page.evaluate(measureInputWidths);
  check(widths.length > 0, "controls measured", widths.length + " controls");

  const bySize = { short: [], medium: [], full: [] };
  for (const w of widths) bySize[w.size].push(w);

  check(
    bySize.short.every((w) => w.width <= 220),
    "short fields are at most 220px",
    bySize.short.map((w) => w.id + "=" + w.width).join(", ") || "none"
  );
  check(
    bySize.medium.every((w) => w.width <= 280),
    "code fields are at most 280px",
    bySize.medium.map((w) => w.id + "=" + w.width).join(", ") || "none"
  );
  check(
    bySize.full.every((w) => w.width > 280),
    "full fields take the whole column",
    bySize.full.length ? bySize.full[0].id + "=" + bySize.full[0].width + "px" : "none"
  );

  // Left-aligned in column 2: every control starts on the same x whatever
  // its width.
  const lefts = new Set(widths.map((w) => w.left));
  check(lefts.size === 1, "every control starts at the same x", [...lefts].join("/"));

  // A hint under a capped control must not run wider than the control.
  const overrunHints = widths.filter((w) => w.hintWidth !== null && w.hintWidth > w.width + 1);
  check(
    overrunHints.length === 0,
    "hints span the same width as their control",
    overrunHints.map((w) => w.id).join(", ") || "none overrun"
  );

  console.log(
    "  MEASURED  " + widths.map((w) => w.id + " " + w.size + " " + w.width + "px").join(" | ")
  );
  await context.close();
}

// ── Required-only advance, per entity type (item 10) ─────────────────────

async function runRequiredOnly(browser) {
  const context = await newCleanContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  console.log("\n\u2500\u2500 required-only advance, per entity type \u2500\u2500");

  for (const type of ENTITY_TYPES) {
    const moved = await openEntitySection(page, type);
    if (!moved) {
      check(false, type + ": Declarant did not advance on required fields alone");
      continue;
    }
    // Fill section 3's required, visible fields and nothing else.
    const filled = await page.evaluate(() => {
      const touched = [];
      for (const field of document.querySelectorAll(".flow-frame-scroll .field")) {
        const control = field.querySelector("input, select");
        if (!control) continue;
        if (control.getAttribute("aria-required") !== "true") continue;
        const set = (el, v) => {
          const proto = el.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement;
          Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        if (control.tagName === "SELECT") {
          const opt = [...control.options].find((o) => o.value !== "");
          if (opt) set(control, opt.value);
        } else {
          // Year and amount fields are digits-only text inputs (numeric
          // keypad, non-digits filtered out), so they need a number.
          set(control, control.inputMode === "numeric" ? "2020" : "Test");
        }
        touched.push(control.id);
      }
      return touched;
    });
    await page.waitForTimeout(500);

    const untouchedOptional = await page.evaluate(() =>
      [...document.querySelectorAll(".flow-frame-scroll .field")]
        .map((f) => f.querySelector("input, select"))
        .filter((c) => c && c.getAttribute("aria-required") !== "true")
        .map((c) => ({ id: c.id, value: c.value }))
    );
    check(
      untouchedOptional.every((c) => c.value === ""),
      type + ": the optional fields were never touched",
      untouchedOptional.map((c) => c.id).join(", ") || "none declared"
    );

    const enabled = await continueEnabled(page);
    check(enabled, type + ": continue is available on required fields alone");
    if (!enabled) continue;

    await page.click(".flow-continue-link");
    await page.waitForTimeout(400);
    const landed = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
    check(
      landed === "reg-section-title-location",
      type + ": continue advances to Localisation",
      landed || ""
    );
    void filled;
  }

  await context.close();
}

// ── The four prompt triggers (item 11) ───────────────────────────────────

const promptState = () => ({
  notice: document.querySelector(".flow-missing-notice")?.textContent?.trim() ?? null,
  invalid: [
    ...document.querySelectorAll('.wizard-section:not([hidden]) [aria-invalid="true"]'),
  ].map((e) => e.id),
  errors: [...document.querySelectorAll(".wizard-section:not([hidden]) .field-error")].length,
  focused: document.activeElement?.id ?? null,
  describedBy: document.querySelector("#reg-first-name")?.getAttribute("aria-describedby") ?? null,
});

async function runPrompts(browser) {
  const context = await newCleanContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  console.log("\n\u2500\u2500 missing-field prompt triggers \u2500\u2500");

  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".flow-frame-scroll");

  // Nothing is flagged before a trigger fires.
  let st = await page.evaluate(promptState);
  check(
    st.notice === null && st.invalid.length === 0 && st.errors === 0,
    "no error is shown before any trigger fires"
  );

  // (b) the continue link, on an empty section 1.
  await page.click(".flow-continue-link", { force: true });
  await page.waitForTimeout(300);
  st = await page.evaluate(promptState);
  check(
    st.notice !== null && /1 champ|1 required/i.test(st.notice),
    "(b) continue on an empty section names the one thing missing",
    st.notice || ""
  );

  await page.click('input[name="entityType"][value="enterprise"]');
  await page.waitForTimeout(400);
  st = await page.evaluate(promptState);
  check(st.notice === null, "the notice clears when the section is satisfied");

  // (d) a locked rail item.
  await railItem(page, 5).click({ force: true });
  await page.waitForTimeout(300);
  st = await page.evaluate(promptState);
  check(
    st.invalid.length === 5 && st.errors === 5,
    "(d) a locked rail click flags every missing field",
    st.invalid.join(", ")
  );
  check(st.focused === "reg-first-name", "it focuses the first one", st.focused || "");
  check(
    st.describedBy === "reg-first-name-error",
    "and points the control at its own message",
    st.describedBy || ""
  );
  check(
    st.notice !== null && st.notice.includes(","),
    "the notice lists them by name",
    st.notice || ""
  );
  const stillHere = await page.getAttribute(".wizard-section:not([hidden])", "aria-labelledby");
  check(
    stillHere === "reg-section-title-respondent",
    "and does not navigate anywhere",
    stillHere || ""
  );

  // Errors clear per field as each is fixed.
  await page.fill("#reg-first-name", "Emmanuel");
  await page.waitForTimeout(250);
  st = await page.evaluate(promptState);
  check(
    st.invalid.length === 4 && !st.invalid.includes("reg-first-name"),
    "fixing one field clears that field's error alone",
    st.invalid.join(", ")
  );

  // (c) Enter on the section's last field.
  await page.focus("#reg-phone2");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  st = await page.evaluate(promptState);
  check(
    st.invalid.length === 4,
    "(c) Enter on the last field raises the prompt",
    st.invalid.join(", ")
  );

  // (a) focus leaving the last field for somewhere outside the section.
  await page.fill("#reg-last-name", "Biya");
  await page.selectOption("#reg-function", { index: 1 });
  await page.waitForTimeout(200);
  await page.focus("#reg-phone2");
  // Tabbing INSIDE the section must not trigger anything, so the control
  // focused next is deliberately outside the form.
  await railItem(page, 1).focus();
  await page.waitForTimeout(300);
  st = await page.evaluate(promptState);
  check(
    st.invalid.includes("reg-email") && st.invalid.includes("reg-phone1"),
    "(a) leaving the last field for outside the section raises the prompt",
    st.invalid.join(", ")
  );

  // Finishing the section clears everything.
  await page.fill("#reg-email", "prompt." + Date.now() + "@example.cm");
  await page.fill("#reg-phone1", "655000000");
  await page.waitForTimeout(700);
  st = await page.evaluate(promptState);
  check(
    st.notice === null && st.invalid.length === 0,
    "completing the section clears the notice and every flag",
    st.notice || ""
  );

  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      await runViewport(browser, vp);
    }
    await runRail(browser);
    await runRequiredOnly(browser);
    await runPrompts(browser);
    await runLabels(browser);
    await runFieldWidths(browser);
  } finally {
    await browser.close();
  }
  console.log("\n" + (checks - failures) + "/" + checks + " checks passed");
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
