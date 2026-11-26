/* Minimal SVG line/bar charts for the Tools pages. No dependencies.
   lineChart(el, opts)
     opts.series   : [{name, color, dash:true|false, points:[[x, y], ...]}]
     opts.xType    : "time" (x = ms timestamps) or "num"
     opts.xLabel   : function(x) -> tick label        (optional)
     opts.xTicks   : array of x values for ticks       (optional, num axis)
     opts.yFmt     : function(y) -> label              (default 2dp + %)
     opts.tipX     : function(x) -> tooltip header     (optional)
     opts.ref      : [{y, label}] dashed reference lines
     opts.bars     : true to draw the first series as bars (num axis)
     opts.height   : px (default 300)
*/
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceStep(span, n) {
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }
  function timeTicks(x0, x1) {
    var d0 = new Date(x0), d1 = new Date(x1), years = (x1 - x0) / 3.156e10, out = [];
    if (years > 2.5) {
      var step = years > 12 ? 4 : years > 6 ? 2 : 1;
      for (var y = d0.getUTCFullYear() + 1; y <= d1.getUTCFullYear(); y++)
        if (y % step === 0) out.push(Date.UTC(y, 0, 1));
    } else {
      var mstep = years > 1.2 ? 6 : 3, d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
      while (d <= d1) { if (d.getUTCMonth() % mstep === 0) out.push(d.getTime()); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
    }
    return out;
  }
  function timeLabel(x, span) {
    var d = new Date(x);
    return span > 2.5 * 3.156e10 ? String(d.getUTCFullYear()) : MON[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2);
  }
  window.fmtDay = function (x) { var d = new Date(x); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };
  window.fmtMonth = function (x) { var d = new Date(x); return MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };

  window.lineChart = function (el, o) {
    function draw() {
      el.querySelectorAll("svg,.tip,.nodata").forEach(function (n) { n.remove(); });
      var W = Math.max(el.clientWidth - 32, 260), H = o.height || 300;
      var m = { l: 46, r: 14, t: 12, b: 28 };
      var pts = [];
      o.series.forEach(function (s) { s.points.forEach(function (p) { if (p[1] != null && isFinite(p[1])) pts.push(p); }); });
      if (!pts.length) { var p = document.createElement("p"); p.className = "status nodata"; p.textContent = "No data for this range."; el.appendChild(p); return; }
      var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      (o.ref || []).forEach(function (r) { ys.push(r.y); });
      if (o.bars) ys.push(0);
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      if (o.xMin != null) x0 = o.xMin; if (o.xMax != null) x1 = o.xMax;
      if (x1 === x0) x1 = x0 + 1;
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.08 || 0.5;
      y0 -= pad; y1 += pad;
      var st = niceStep(y1 - y0, H < 260 ? 4 : 5);
      y0 = Math.floor(y0 / st) * st; y1 = Math.ceil(y1 / st) * st;
      var bw = 0;
      if (o.bars) { var n = o.series[0].points.length; bw = Math.min(46, (W - m.l - m.r) / n * 0.62); m.l += bw / 2 + 4; m.r += bw / 2 + 4; }
      var X = function (x) { return m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r); };
      var Y = function (y) { return m.t + (y1 - y) / (y1 - y0) * (H - m.t - m.b); };
      var yFmt = o.yFmt || function (v) { return v.toFixed(2) + "%"; };
      var svg = mk("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.label || "chart" }, null);
      el.insertBefore(svg, el.querySelector(".src"));
      var g = mk("g", { "font-size": "11", fill: "#686d74", "font-family": "Inter,system-ui,sans-serif" }, svg);
      for (var v = y0; v <= y1 + st / 2; v += st) {
        var yy = Y(v);
        mk("line", { x1: m.l - (o.bars ? bw / 2 + 4 : 0), x2: W - m.r + (o.bars ? bw / 2 + 4 : 0), y1: yy, y2: yy, stroke: Math.abs(v) < st / 1e6 ? "#9a9fa7" : "#ebe8e1", "stroke-width": 1 }, g);
        var t = mk("text", { x: 4, y: yy + 4 }, g); t.textContent = o.yTick ? o.yTick(v) : (Math.abs(v) < st / 1e6 ? "0" : +v.toFixed(4) + (o.yUnit === undefined ? "%" : o.yUnit));
      }
      var ticks = o.xTicks || (o.xType === "time" ? timeTicks(x0, x1) : null);
      if (!ticks) { ticks = []; var xs2 = niceStep(x1 - x0, 6); for (var xv = Math.ceil(x0 / xs2) * xs2; xv <= x1; xv += xs2) ticks.push(xv); }
      ticks.forEach(function (tx) {
        if (tx < x0 || tx > x1) return;
        var t = mk("text", { x: X(tx), y: H - 8, "text-anchor": "middle" }, g);
        t.textContent = o.xLabel ? o.xLabel(tx) : o.xType === "time" ? timeLabel(tx, x1 - x0) : tx;
      });
      (o.ref || []).forEach(function (r) {
        mk("line", { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), stroke: "#15171b", "stroke-dasharray": "3 4", "stroke-width": 1 }, svg);
        var t = mk("text", { x: W - m.r, y: Y(r.y) - 5, "text-anchor": "end", "font-size": "11", fill: "#15171b", "font-family": "Inter,system-ui,sans-serif" }, svg);
        t.textContent = r.label;
      });
      o.series.forEach(function (s, i) {
        var ok = s.points.filter(function (p) { return p[1] != null && isFinite(p[1]) && p[0] >= x0 && p[0] <= x1; });
        if (o.bars && i === 0) {
          ok.forEach(function (p) {
            var top = Y(Math.max(p[1], 0)), bot = Y(Math.min(p[1], 0));
            mk("rect", { x: X(p[0]) - bw / 2, y: top, width: bw, height: Math.max(bot - top, 0.5), fill: s.color, rx: 1 }, svg);
          });
          return;
        }
        var d = ok.map(function (p, j) { return (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("");
        mk("path", { d: d, fill: "none", stroke: s.color, "stroke-width": s.width || 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": s.dash ? "5 4" : "" }, svg);
        if (s.dots) ok.forEach(function (p) { mk("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3, fill: s.color }, svg); });
      });
      // hover
      var guide = mk("line", { y1: m.t, y2: H - m.b, stroke: "#15171b", "stroke-width": 1, opacity: 0 }, svg);
      var dots = o.series.map(function (s) { return mk("circle", { r: 4, fill: s.color, stroke: "#fff", "stroke-width": 1.5, opacity: 0 }, svg); });
      var tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip);
      var allX = []; o.series.forEach(function (s) { s.points.forEach(function (p) { if (p[0] >= x0 && p[0] <= x1) allX.push(p[0]); }); });
      allX = Array.from(new Set(allX)).sort(function (a, b) { return a - b; });
      function nearest(arr, x) { var best = null, bd = Infinity; arr.forEach(function (p) { if (p[1] == null) return; var dd = Math.abs(p[0] - x); if (dd < bd) { bd = dd; best = p; } }); return best; }
      function move(ev) {
        var r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * W / r.width;
        if (sx < m.l - 10 || sx > W - m.r + 10) return hide();
        var xv = x0 + (sx - m.l) / (W - m.l - m.r) * (x1 - x0), xs3 = allX.length ? allX.reduce(function (a, b) { return Math.abs(b - xv) < Math.abs(a - xv) ? b : a; }) : xv;
        guide.setAttribute("x1", X(xs3)); guide.setAttribute("x2", X(xs3)); guide.setAttribute("opacity", .25);
        var rows = [];
        o.series.forEach(function (s, i) {
          var tol = o.xType === "time" ? 40 * 864e5 : (x1 - x0) / 40;
          var p = nearest(s.points.filter(function (q) { return Math.abs(q[0] - xs3) <= tol; }), xs3);
          if (!p || (o.bars && i === 0)) { dots[i].setAttribute("opacity", 0); }
          else { dots[i].setAttribute("cx", X(p[0])); dots[i].setAttribute("cy", Y(p[1])); dots[i].setAttribute("opacity", 1); }
          if (p) rows.push('<span style="color:' + (s.tipColor || s.color) + '">&#9632;</span> ' + s.name + ": <b>" + yFmt(p[1]) + "</b>");
        });
        tip.innerHTML = "<b>" + (o.tipX ? o.tipX(xs3) : o.xType === "time" ? fmtDay(xs3) : xs3) + "</b><br>" + rows.join("<br>");
        tip.style.opacity = 1;
        var px = X(xs3) / W * r.width + 16, tw = tip.offsetWidth;
        if (px + tw > el.clientWidth - 8) px = X(xs3) / W * r.width + 16 - tw - 24;
        tip.style.left = Math.max(px, 4) + "px"; tip.style.top = "18px";
      }
      function hide() { tip.style.opacity = 0; guide.setAttribute("opacity", 0); dots.forEach(function (d) { d.setAttribute("opacity", 0); }); }
      svg.addEventListener("pointermove", move); svg.addEventListener("pointerleave", hide);
    }
    el._draw = draw;
    draw();
    if (!el._ro) { var w = el.clientWidth; el._ro = new ResizeObserver(function () { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; el._draw(); } }); el._ro.observe(el); }
  };
})();
