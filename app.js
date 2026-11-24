(() => {
  "use strict";
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // strike every line of a problem
  function strikes() {
    $$(".pb").forEach((pb) => {
      $$(".strike", pb).forEach((x) => x.remove());
      const t = pb.querySelector(".pbt"); if (t === null) return;
      const base = pb.getBoundingClientRect();
      Array.from(t.getClientRects()).forEach((r) => {
        const i = document.createElement("i"); i.className = "strike";
        i.style.cssText = "left:" + (r.left - base.left - 4) + "px;top:" + (r.top - base.top + r.height * 0.55) + "px;width:" + (r.width + 8) + "px";
        pb.appendChild(i);
      });
    });
  }

  // class toggles on enter (no scroll handlers)
  function watch(sel, cls, opts, once) {
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add(cls); if (once) io.unobserve(e.target); }
      else if (once === false) e.target.classList.remove(cls);
    }), opts);
    $$(sel).forEach((el) => io.observe(el));
  }

  // videos: lazy src, only one plays at a time
  function videos() {
    const vids = $$("video");
    const ratio = new Map();
    const pick = () => {
      let best = null, r = 0.3;
      ratio.forEach((v, el) => { if (v > r) { r = v; best = el; } });
      vids.forEach((v) => {
        if (v === best) { if (v.paused) v.play().catch(() => {}); }
        else if (v.paused === false) v.pause();
      });
    };
    const near = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting && e.target.dataset.src) {
        e.target.src = e.target.dataset.src; e.target.removeAttribute("data-src"); near.unobserve(e.target);
      }
    }), { rootMargin: "120% 0px" });
    const vis = new IntersectionObserver((list) => {
      list.forEach((e) => ratio.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
      pick();
    }, { threshold: [0, 0.3, 0.5, 0.7, 1] });
    vids.forEach((v) => { v.muted = true; if (v.dataset.src) near.observe(v); vis.observe(v); });
  }

  function drum() {
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting === false) return;
      $$(".dg", e.target).forEach((d) => { d.firstElementChild.style.transform = "translate3d(0," + (-d.dataset.v * 10) + "%,0)"; });
      io.unobserve(e.target);
    }), { threshold: 0.5 });
    $$(".tc").forEach((t) => io.observe(t));
  }

  // dock: hidden on hero, form and finale
  function dock() {
    const d = document.querySelector(".dock");
    if (d === null) return;
    const hide = new Set();
    const io = new IntersectionObserver((list) => {
      list.forEach((e) => { if (e.isIntersecting) hide.add(e.target); else hide.delete(e.target); });
      d.classList.toggle("show", hide.size === 0);
    }, { threshold: 0 });
    ["#top", "#zayavka", "#fin"].forEach((s) => { const el = document.querySelector(s); if (el) io.observe(el); });
  }

  function motion() {
    const g = window.gsap, ST = window.ScrollTrigger;
    const cards = $$(".card");
    if (g && ST && reduce === false) {
      g.registerPlugin(ST);
      ST.config({ ignoreMobileResize: true });
      cards.forEach((c, i) => {
        const next = cards[i + 1];
        if (next === undefined) return;
        const st = { trigger: next, start: "top bottom", end: "top top", scrub: 0.6 };
        g.to(c.querySelector(".card-in"), { scale: 0.92, ease: "none", scrollTrigger: st });
        g.to(c.querySelector(".card-dim"), { opacity: 0.62, ease: "none", scrollTrigger: { ...st } });
      });
      $$(".zoom").forEach((img) => {
        g.fromTo(img, { scale: 1 }, { scale: 1.12, ease: "none",
          scrollTrigger: { trigger: img.closest("section,.need"), start: "top bottom", end: "bottom top", scrub: 0.8 } });
      });
      const rail = document.querySelector(".rail i");
      if (rail) g.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: "none",
        scrollTrigger: { trigger: ".steps", start: "top 62%", end: "bottom 62%", scrub: 0.6 } });
      $$(".st").forEach((s) => ST.create({ trigger: s, start: "top 64%",
        onEnter: () => s.classList.add("on"), onLeaveBack: () => s.classList.remove("on") }));
    } else {
      $$(".st").forEach((s) => s.classList.add("on"));
      const r = document.querySelector(".rail i"); if (r) r.style.transform = "none";
    }
    watch(".card", "on", { rootMargin: "0px 0px -40% 0px" }, false);
  }

  function form() {
    const form = document.getElementById("leadForm");
    if (form === null) return;
    const contact = document.getElementById("leadContact");
    const err = document.getElementById("leadContactErr");
    const fail = document.getElementById("leadFail");
    const ok = document.getElementById("leadOk");
    const btn = document.getElementById("leadBtn");
    const label = btn ? btn.innerHTML : "";
    let busy = false;
    contact.addEventListener("input", () => {
      err.hidden = true; contact.removeAttribute("aria-invalid"); contact.closest(".fld").classList.remove("bad");
    });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (busy) return;
      const data = new FormData(form);
      const val = (k) => String(data.get(k) || "").trim();
      const c = val("contact");
      if (c.replace(/[\s()-]/g, "").length < 4) {
        err.hidden = false; contact.setAttribute("aria-invalid", "true"); contact.closest(".fld").classList.add("bad"); contact.focus();
        return;
      }
      busy = true; form.setAttribute("aria-busy", "true"); fail.hidden = true;
      btn.disabled = true; btn.innerHTML = "<b>Отправляем</b>";
      const body = { name: val("name"), contact: c, role: val("role"), msg: val("msg"), page: "k2", company_site: val("company_site") };
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      let good = false;
      try {
        const res = await fetch("/api/entracte-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
        const j = await res.json().catch(() => null);
        good = res.ok && Boolean(j) && j.ok === true;
      } catch (_) { good = false; } finally {
        clearTimeout(t); busy = false; form.removeAttribute("aria-busy"); btn.disabled = false; btn.innerHTML = label;
      }
      if (good) { form.hidden = true; ok.hidden = false; ok.focus({ preventScroll: true }); }
      else fail.hidden = false;
    });
  }

  // visit beacon: one tiny POST per event, no libraries, no scroll handlers
  function beacon() {
    const U = "/api/entracte-visit";
    const st = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; };
    const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    const q = new URLSearchParams(location.search);
    if (q.get("me") === "1") document.cookie = "ent_me=1; max-age=157680000; path=/; SameSite=Lax";
    let vid = st("ent_vid"); if (!vid) { vid = rid(); st("ent_vid", vid); }
    const n = Number(st("ent_n") || 0) + 1; st("ent_n", String(n));
    const pv = rid();
    const blocks = new Set(), cl = {};
    let sc = 0, vis = 0, since = document.visibilityState === "visible" ? performance.now() : 0, timer = 0;
    const dur = () => Math.round((vis + (since ? performance.now() - since : 0)) / 1000);
    const depth = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      const p = h > 0 ? Math.round(Math.min(1, scrollY / h) * 100) : 100;
      if (p > sc) sc = p; return sc;
    };
    const send = (ev) => {
      const d = { ev, vid, pv, n, dur: dur(), sc: depth(), bl: Array.from(blocks), cl };
      if (ev === "start") {
        d.ref = document.referrer.slice(0, 300); d.path = location.pathname; d.scr = screen.width + "x" + screen.height;
        d.sw = screen.width; d.r = q.get("r") || ""; d.me = q.get("me") === "1" ? 1 : 0; d.wd = navigator.webdriver ? 1 : 0;
        ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => { if (q.get(k)) d[k] = q.get(k); });
      }
      const b = JSON.stringify(d);
      try {
        if (ev !== "start" && navigator.sendBeacon && navigator.sendBeacon(U, new Blob([b], { type: "application/json" }))) return;
        fetch(U, { method: "POST", headers: { "Content-Type": "application/json" }, body: b, keepalive: true }).catch(() => {});
      } catch (_) {}
    };
    let k = 0;
    const tick = () => { clearTimeout(timer); timer = setTimeout(() => { send("ping"); k++; tick(); }, k < 2 ? 15000 : 60000); };
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting && e.target.id) { blocks.add(e.target.id); io.unobserve(e.target); }
    }), { rootMargin: "-45% 0px -45% 0px" });
    $$("section[id], #demo").forEach((el) => io.observe(el));
    setInterval(depth, 2000);
    const hit = (key) => { cl[key] = (cl[key] || 0) + 1; send("ping"); };
    document.addEventListener("click", (ev) => {
      const a = ev.target.closest ? ev.target.closest("a[href]") : null;
      if (a === null) return;
      const h = a.getAttribute("href");
      if (/t\.me|telegram/i.test(h)) hit("tg");
      else if (/^tel:/i.test(h)) hit("tel");
      else if (/wa\.me|whatsapp/i.test(h)) hit("wa");
      else if (h === "#zayavka") hit("form");
    }, { passive: true, capture: true });
    const f = document.getElementById("leadForm");
    if (f) f.addEventListener("focusin", () => { if (!cl.focus) hit("focus"); }, { once: true });
    $$("video[data-src]").forEach((v) => v.addEventListener("playing", () => { if (!cl.video) hit("video"); }, { once: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") { if (since) { vis += performance.now() - since; since = 0; } clearTimeout(timer); send("end"); }
      else { if (!since) since = performance.now(); send("ping"); tick(); }
    });
    addEventListener("pagehide", () => send("end"));
    send("start"); tick();
  }

  function init() {
    strikes();
    if (document.fonts) document.fonts.ready.then(() => { strikes(); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); });
    let rw = innerWidth;
    addEventListener("resize", () => { if (innerWidth === rw) return; rw = innerWidth; strikes(); });
    watch(".rv", "in", { rootMargin: "0px 0px -12% 0px" }, true);
    watch(".need", "on", { threshold: 0.35 }, true);
    watch(".fact", "in", { threshold: 0.5 }, true);
    videos(); drum(); dock(); form();
    try { beacon(); } catch (_) {}
    if (window.gsap) motion(); else addEventListener("load", motion, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
