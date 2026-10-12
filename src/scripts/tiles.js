/* "What changed" figures: four drawn data marks, each a small chart of its own fact, in glass and ember */
(function (W, D) {
  "use strict";
  var PL = W.PL; if (!PL) return;
  var E1 = "#EE9467", E2 = "#E8703A", E3 = "#B4572C", B1 = "rgba(220,220,220,.16)", B2 = "rgba(220,220,220,.32)";
  function defs(id) {
    return '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + E1 + '"/><stop offset=".45" stop-color="' + E2 + '"/><stop offset="1" stop-color="' + E3 + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + E3 + '"/><stop offset=".6" stop-color="' + E2 + '"/><stop offset="1" stop-color="' + E1 + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(220,220,220,.14)"/><stop offset="1" stop-color="rgba(220,220,220,.03)"/></linearGradient>' +
      '<filter id="' + id + 'f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>';
  }
  var n = 0;
  PL.tileTwin = function (svg, kind) {
    var id = "tf" + (n++) + "_", s = defs(id);
    svg.setAttribute("viewBox", "0 0 160 104");
    if (kind === "meter") { /* 80 to 90% of the campaign run by AI: one disc, the AI share as a wedge from 12 o'clock; both parts labelled outside with leaders */
      var cx = 72, cy = 52, r = 38, frac = 0.85, a1 = -Math.PI / 2 + frac * Math.PI * 2, ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r;
      var mA = -Math.PI / 2 + frac * Math.PI, mP = a1 + (1 - frac) * Math.PI; /* mid-angles of the AI wedge and the people slice */
      var pt = function (a, rr) { return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 10) + '" fill="' + E2 + '" opacity=".14" filter="url(#' + id + 'f)"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + id + 'k)" stroke="' + B1 + '"/>';
      s += '<path class="tf-wedge" d="M' + cx + ',' + cy + ' L' + cx + ',' + (cy - r) + ' A' + r + ',' + r + ' 0 1 1 ' + ex.toFixed(2) + ',' + ey.toFixed(2) + ' Z" fill="url(#' + id + 'g)"/>';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - r) + '" stroke="rgba(22,22,22,.7)" stroke-width="1.2"/><line x1="' + cx + '" y1="' + cy + '" x2="' + ex.toFixed(2) + '" y2="' + ey.toFixed(2) + '" stroke="rgba(22,22,22,.7)" stroke-width="1.2"/>';
      var a0p = pt(mA, r * 0.92), a1p = pt(mA, r + 9), lxA = 128;   /* AI: wedge mid (lower right) out to a label on the right */
      s += '<polyline points="' + a0p + ' ' + a1p + ' ' + lxA + ',' + a1p[1].toFixed(1) + '" fill="none" stroke="' + E1 + '" stroke-width=".8"/><circle cx="' + a0p[0].toFixed(1) + '" cy="' + a0p[1].toFixed(1) + '" r="1.6" fill="' + E1 + '"/>';
      s += '<text x="' + (lxA + 4) + '" y="' + (a1p[1] + 3.5).toFixed(1) + '" font-family="DM Mono, monospace" font-size="10" fill="' + E1 + '">AI</text>';
      var p0p = pt(mP, r * 0.8), p1p = pt(mP, r + 9), lxP = 128;    /* people: slice mid (upper left) up and across to a label on the right */
      s += '<polyline points="' + p0p + ' ' + p1p.map(function (v, k) { return k ? Math.min(v, 8) : v; }) + ' ' + lxP + ',8" fill="none" stroke="rgba(220,220,220,.45)" stroke-width=".8"/><circle cx="' + p0p[0].toFixed(1) + '" cy="' + p0p[1].toFixed(1) + '" r="1.6" fill="rgba(220,220,220,.7)"/>';
      s += '<text x="' + (lxP + 4) + '" y="11.5" font-family="DM Mono, monospace" font-size="10" fill="rgba(220,220,220,.7)">people</text>';
    } else if (kind === "grid") { /* 3 of 10 attempts went end to end: ten columns, three full in ember, seven stopping short */
      var hs = [1, 0.62, 1, 0.38, 0.71, 0.55, 1, 0.3, 0.66, 0.47], x0 = 14, w = 10, gp = 4.4, top = 14, bot = 92;
      s += '<line x1="8" x2="152" y1="' + top + '" y2="' + top + '" stroke="' + B2 + '" stroke-dasharray="2 3"/>';
      hs.forEach(function (h, i) {
        var x = x0 + i * (w + gp + 0.6), full = h === 1, y1 = bot - (bot - top) * h;
        s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + (bot - top) + '" rx="2" fill="url(#' + id + 'k)" stroke="' + B1 + '"/>';
        if (full) s += '<rect x="' + (x - 2) + '" y="' + y1 + '" width="' + (w + 4) + '" height="' + (bot - y1) + '" rx="3" fill="' + E2 + '" opacity=".5" filter="url(#' + id + 'f)"/>';
        s += '<rect class="tf-bar" style="--i:' + i + '" x="' + x + '" y="' + y1 + '" width="' + w + '" height="' + (bot - y1) + '" rx="2" fill="' + (full ? "url(#" + id + "g)" : "rgba(220,220,220,.3)") + '"/>';
        if (full) s += '<circle cx="' + (x + w / 2) + '" cy="' + (top - 0.5) + '" r="2.4" fill="' + E1 + '"/>';
      });
      s += '<line x1="8" x2="152" y1="' + bot + '" y2="' + bot + '" stroke="' + B2 + '"/>';
    } else if (kind === "arc") { /* one weekend: Friday to Monday, the agent crosses the whole network */
      var X = [18, 64, 100, 142], by = 78;
      s += '<line x1="10" x2="150" y1="' + by + '" y2="' + by + '" stroke="' + B2 + '"/>';
      ["Fri", "Sat", "Sun", "Mon"].forEach(function (d, i) { s += '<line x1="' + X[i] + '" x2="' + X[i] + '" y1="' + (by - 4) + '" y2="' + (by + 4) + '" stroke="' + B2 + '"/><text x="' + X[i] + '" y="' + (by + 18) + '" text-anchor="middle" font-family="DM Mono, monospace" font-size="9.5" fill="rgba(220,220,220,.7)">' + d + "</text>"; });
      [[18, by - 10], [142, by - 10]].forEach(function (p) { s += '<rect x="' + (p[0] - 9) + '" y="' + (p[1] - 7) + '" width="18" height="12" rx="2" fill="url(#' + id + 'k)" stroke="' + B2 + '"/>'; });
      for (var k = 0; k < 5; k++) { var nx = 34 + k * 23, ny = by - 14 - (k % 2) * 4; s += '<rect x="' + (nx - 5) + '" y="' + (ny - 4) + '" width="10" height="7" rx="1.5" fill="rgba(220,220,220,.08)" stroke="' + B1 + '"/>'; }
      var path = "M18," + (by - 16) + " C40," + (by - 78) + " 120," + (by - 78) + " 142," + (by - 16);
      s += '<path d="' + path + '" fill="none" stroke="' + E2 + '" stroke-width="6" opacity=".45" filter="url(#' + id + 'f)"/><path class="tf-arc" d="' + path + '" fill="none" stroke="url(#' + id + 'h)" stroke-width="2.2" stroke-linecap="round"/>';
      s += '<circle cx="142" cy="' + (by - 16) + '" r="7" fill="' + E2 + '" opacity=".5" filter="url(#' + id + 'f)"/><circle cx="142" cy="' + (by - 16) + '" r="3" fill="' + E1 + '"/><circle cx="18" cy="' + (by - 16) + '" r="2.4" fill="none" stroke="' + E2 + '"/>';
    } else { /* about 2,500 in a month, five times the earlier record: earlier months in glass, July in ember */
      var vals = [0.13, 0.18, 0.15, 0.2, 0.17, 1], bw = 15, bx0 = 18, base = 92, topY = 12, rec = base - (base - topY) * 0.2;
      vals.forEach(function (v, i) {
        var x = bx0 + i * 21, y = base - (base - topY) * v, last = i === vals.length - 1;
        if (last) s += '<rect x="' + (x - 3) + '" y="' + y + '" width="' + (bw + 6) + '" height="' + (base - y) + '" rx="3" fill="' + E2 + '" opacity=".45" filter="url(#' + id + 'f)"/>';
        s += '<rect class="tf-bar" style="--i:' + i + '" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + (base - y) + '" rx="2" fill="' + (last ? "url(#" + id + "g)" : "url(#" + id + "k)") + '" stroke="' + (last ? "none" : B2) + '"/>';
      });
      s += '<line x1="12" x2="150" y1="' + rec + '" y2="' + rec + '" stroke="' + B2 + '" stroke-dasharray="2 3"/><text x="16" y="' + (rec - 5) + '" font-family="DM Mono, monospace" font-size="9.5" fill="rgba(220,220,220,.7)">earlier record</text>';
      s += '<text x="' + (bx0 + 5 * 21 + bw / 2) + '" y="' + (topY - 3) + '" text-anchor="middle" font-family="DM Mono, monospace" font-size="9" fill="' + E1 + '">5×</text>';
      s += '<line x1="12" x2="150" y1="' + base + '" y2="' + base + '" stroke="' + B2 + '"/>';
    }
    svg.innerHTML = s;
  };
  [].slice.call(D.querySelectorAll("[data-tile]")).forEach(function (s) { PL.tileTwin(s, s.dataset.tile); });
})(window, document);
