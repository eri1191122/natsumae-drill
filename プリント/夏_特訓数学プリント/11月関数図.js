/*
 * 11月関数図.js
 * 比例・反比例の座標平面図を共通仕様で描くSVG生成関数。
 * 設計書: 対策/塾_中1特訓選抜_2026年11月/2026-09-29_11月特訓_数学_比例反比例_教材設計.md §5
 *
 * 使い方:
 *   <div id="fig1"></div>
 *   <script src="11月関数図.js"></script>
 *   <script>drawPlane('fig1', { xmin:-6, xmax:6, ymin:-6, ymax:6,
 *     graphs:[{type:'prop', a:2, color:'blue', label:'y=2x'}] });</script>
 *
 * opts:
 *   xmin,xmax,ymin,ymax : 表示範囲（既定 -6〜6）
 *   unit                : 1目盛のpx（既定28）
 *   gridStep            : 方眼の間隔（既定1、方眼線は常にこの間隔で全て描く）
 *   labelEvery          : 目盛数字を出す間隔（既定は軸の幅が14を超えたら自動で2（1つおき）、それ以外は1。
 *                          指定した場合はx軸・y軸の両方にこの値を優先適用する）
 *   ariaLabel           : svgのaria-label
 *   graphs: [{ type:'prop'|'inv', a:Number, style:'solid'|'dash', color:'blue'|'orange'|hex, label:String,
 *              labelAt:Number(ラベルを置くx座標。省略時は見えている区間の中ほどで他の線・点から一番離れた位置を自動選択),
 *              labelDx,labelDy:Number(最終手動調整。指定すると自動の法線オフセットより優先), labelAnchor:'start'|'end'|'middle' }]
 *   points: [{ x, y, name, pos:'ne'|'nw'|'se'|'sw', coord:Boolean, color:hex, dx,dy:Number(手動調整), anchor:String }]
 *   segments: [{ x1,y1,x2,y2, dash:Boolean, color:hex }]
 *   polygons: [{ pts:[[x,y],...], fill:hex/rgba }]
 *   highlight: { graphIndex, xFrom, xTo, fromOpen, toOpen }
 *
 * ラベルの見た目: グラフ名ラベルと点の座標ラベルには白い縁取り(stroke)を付け、方眼線の上でも読みやすくしている。
 * グラフ名ラベルの既定位置は、その点での接線の法線方向に12px（線と重ならない側）。
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COLOR_BLUE = '#1e3a8a';
  var COLOR_ORANGE = '#9a3412';
  var COLOR_AXIS = '#111111';
  var COLOR_TICK = '#111111';
  var COLOR_GRID_MINOR = '#d1d5db';
  var COLOR_GRID_MAJOR = '#9ca3af';
  var COLOR_POINT = '#111111';
  var COLOR_HELPER = '#8a8f94';
  var COLOR_POLY_FILL = 'rgba(30,58,138,0.18)';

  var PAD_L = 38, PAD_R = 34, PAD_T = 34, PAD_B = 38;
  var EPS = 1e-6;

  function el(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    return e;
  }

  function resolveColor(c, fallback) {
    if (!c) return fallback;
    if (c === 'blue') return COLOR_BLUE;
    if (c === 'orange') return COLOR_ORANGE;
    return c;
  }

  function fmtNum(v) {
    var r = Math.round(v * 1000) / 1000;
    if (Math.abs(r - Math.round(r)) < 1e-6) return String(Math.round(r));
    return String(r);
  }

  /* ---- 比例 y=ax の表示区間を [xmin,xmax]×[ymin,ymax] にクリップ ---- */
  function propRange(a, xmin, xmax, ymin, ymax) {
    if (a === 0) {
      return (0 >= ymin && 0 <= ymax) ? [xmin, xmax] : null;
    }
    var x1 = ymin / a, x2 = ymax / a;
    var lo = Math.max(xmin, Math.min(x1, x2));
    var hi = Math.min(xmax, Math.max(x1, x2));
    if (lo >= hi) return null;
    return [lo, hi];
  }

  /* ---- グラフg（比例/反比例）のx=xでのyを返す。定義できない時はnull ---- */
  function evalGraphAt(g, x) {
    if (!g) return null;
    if (g.type === 'prop') return g.a * x;
    if (g.type === 'inv') return (Math.abs(x) > EPS) ? g.a / x : null;
    return null;
  }

  /* ---- 他の線・点までの画面上の最短距離（px）。ラベル候補の混雑度スコアに使う ---- */
  function crowdScoreAt(x0, y0, idx, allGraphs, points, unit) {
    var score = Infinity;
    (allGraphs || []).forEach(function (g2, i2) {
      if (i2 === idx) return;
      var y2 = evalGraphAt(g2, x0);
      if (y2 !== null && isFinite(y2)) {
        var d = Math.abs(y0 - y2) * unit;
        if (d < score) score = d;
      }
    });
    (points || []).forEach(function (p) {
      var d = Math.sqrt(Math.pow((x0 - p.x) * unit, 2) + Math.pow((y0 - p.y) * unit, 2));
      if (d < score) score = d;
    });
    return score;
  }

  /* ---- ラベルの自動位置（反比例用：見えている区間の中ほど、他の線・点から一番離れた候補） ---- */
  function pickAutoLabelX(ranges, g, idx, allGraphs, points, unit) {
    var fracs = [0.5, 0.35, 0.65, 0.2, 0.8];
    var best = null, bestScore = -1;
    ranges.forEach(function (rg) {
      var lo = rg[0], hi = rg[1];
      fracs.forEach(function (f) {
        var x0 = lo + (hi - lo) * f;
        var y0 = evalGraphAt(g, x0);
        if (y0 === null || !isFinite(y0)) return;
        var score = crowdScoreAt(x0, y0, idx, allGraphs, points, unit);
        if (score > bestScore) { bestScore = score; best = x0; }
      });
    });
    if (best === null && ranges.length) { best = (ranges[0][0] + ranges[0][1]) / 2; }
    return best;
  }

  /* ---- ラベルの自動位置（比例用：原点から遠い側の端から15〜25%内側を最優先。原点から半径3目盛以内は避ける） ---- */
  function pickPropLabelX(rng, g, idx, allGraphs, points, unit) {
    var lo = rng[0], hi = rng[1];
    var width = hi - lo;
    var farIsHi = Math.abs(hi) >= Math.abs(lo); /* 同じ距離ならhi(正)側を優先 */
    var fracs = [0.20, 0.15, 0.25, 0.30, 0.40, 0.50];
    var raw = fracs.map(function (f) {
      return farIsHi ? (hi - f * width) : (lo + f * width);
    });
    var valid = raw.filter(function (x0) {
      var y0 = g.a * x0;
      return Math.sqrt(x0 * x0 + y0 * y0) >= 3 - 1e-9;
    });
    if (!valid.length) valid = [farIsHi ? hi : lo]; /* 区間が短く半径3を満たせない時は端そのものを使う */
    var CLEAR = 20;
    var best = valid[0], bestScore = -1;
    for (var i = 0; i < valid.length; i++) {
      var x0 = valid[i], y0 = g.a * x0;
      var score = crowdScoreAt(x0, y0, idx, allGraphs, points, unit);
      if (score > bestScore) { bestScore = score; best = x0; }
      if (score >= CLEAR) break;
    }
    return best;
  }

  /* ---- 反比例 y=a/x の片方の枝（x>0 または x<0）の表示区間をクリップ ---- */
  function invBranch(a, outer, isPos, ymin, ymax) {
    var cands = [];
    if (ymin !== 0) {
      var cx = a / ymin;
      if (isFinite(cx) && (isPos ? cx > EPS : cx < -EPS)) cands.push(cx);
    }
    if (ymax !== 0) {
      var cx2 = a / ymax;
      if (isFinite(cx2) && (isPos ? cx2 > EPS : cx2 < -EPS)) cands.push(cx2);
    }
    cands = cands.filter(function (v) {
      return isPos ? (v > EPS && v <= outer) : (v < -EPS && v >= outer);
    });
    var lo, hi;
    if (cands.length === 0) {
      var yAtOuter = a / outer;
      if (yAtOuter >= ymin && yAtOuter <= ymax) {
        lo = isPos ? EPS : outer;
        hi = isPos ? outer : -EPS;
      } else return null;
    } else if (cands.length === 1) {
      var c = cands[0];
      if (isPos) { lo = c; hi = outer; } else { lo = outer; hi = c; }
    } else {
      lo = Math.min(cands[0], cands[1]);
      hi = Math.max(cands[0], cands[1]);
    }
    if (lo >= hi) return null;
    return [lo, hi];
  }

  function drawPlane(containerId, opts) {
    opts = opts || {};
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var xmin = (opts.xmin !== undefined) ? opts.xmin : -6;
    var xmax = (opts.xmax !== undefined) ? opts.xmax : 6;
    var ymin = (opts.ymin !== undefined) ? opts.ymin : -6;
    var ymax = (opts.ymax !== undefined) ? opts.ymax : 6;
    var unit = opts.unit || 32;
    var gridStep = opts.gridStep || 1;
    /* 表示範囲の幅が9を超える軸は目盛の数字を2つおきに間引く（方眼線は常に1ずつ）。
       opts.labelEveryを指定した場合はそちらを両軸に優先適用する。 */
    var labelEveryX = opts.labelEvery || ((xmax - xmin) > 14 ? 2 : 1);
    var labelEveryY = opts.labelEvery || ((ymax - ymin) > 14 ? 2 : 1);
    var graphs = opts.graphs || [];
    var points = opts.points || [];
    var segments = opts.segments || [];
    var polygons = opts.polygons || [];
    var highlight = opts.highlight || null;

    var W = (xmax - xmin) * unit + PAD_L + PAD_R;
    var H = (ymax - ymin) * unit + PAD_T + PAD_B;

    function toPx(x, y) {
      return [PAD_L + (x - xmin) * unit, PAD_T + (ymax - y) * unit];
    }

    var xAxisVisible = (ymin <= 0 && ymax >= 0);
    var yAxisVisible = (xmin <= 0 && xmax >= 0);

    var svg = el('svg', {
      xmlns: SVG_NS,
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%',
      class: 'fn-fig',
      style: 'display:block;max-width:420px;width:100%;height:auto;margin:0 auto',
      'aria-label': opts.ariaLabel || '座標平面の図'
    });

    /* クリップ枠（反比例の曲線が枠外にはみ出さない保険） */
    var clipId = 'clip-' + Math.random().toString(36).slice(2, 9);
    var defs = el('defs');
    var clipRect = el('clipPath', { id: clipId });
    var p0 = toPx(xmin, ymax);
    clipRect.appendChild(el('rect', { x: p0[0], y: p0[1], width: (xmax - xmin) * unit, height: (ymax - ymin) * unit }));
    defs.appendChild(clipRect);
    svg.appendChild(defs);

    /* ---- 方眼 ---- */
    var gGrid = el('g', { class: 'grid' });
    var ix0 = Math.ceil((xmin - EPS) / gridStep);
    var ix1 = Math.floor((xmax + EPS) / gridStep);
    for (var i = ix0; i <= ix1; i++) {
      var gx = i * gridStep;
      var isMajor = (i % 5 === 0);
      var pA = toPx(gx, ymin), pB = toPx(gx, ymax);
      gGrid.appendChild(el('line', {
        x1: pA[0], y1: pA[1], x2: pB[0], y2: pB[1],
        stroke: isMajor ? COLOR_GRID_MAJOR : COLOR_GRID_MINOR, 'stroke-width': 1
      }));
    }
    var iy0 = Math.ceil((ymin - EPS) / gridStep);
    var iy1 = Math.floor((ymax + EPS) / gridStep);
    for (var j = iy0; j <= iy1; j++) {
      var gy = j * gridStep;
      var isMajorY = (j % 5 === 0);
      var pC = toPx(xmin, gy), pD = toPx(xmax, gy);
      gGrid.appendChild(el('line', {
        x1: pC[0], y1: pC[1], x2: pD[0], y2: pD[1],
        stroke: isMajorY ? COLOR_GRID_MAJOR : COLOR_GRID_MINOR, 'stroke-width': 1
      }));
    }
    svg.appendChild(gGrid);

    /* ---- 多角形（面積を薄く塗る） ---- */
    if (polygons.length) {
      var gPoly = el('g', { class: 'polygons' });
      polygons.forEach(function (poly) {
        var ptsStr = poly.pts.map(function (pt) {
          var px = toPx(pt[0], pt[1]);
          return px[0] + ',' + px[1];
        }).join(' ');
        gPoly.appendChild(el('polygon', {
          points: ptsStr,
          fill: poly.fill || COLOR_POLY_FILL,
          stroke: poly.stroke || 'rgba(100,100,100,0.45)',
          'stroke-width': 1
        }));
      });
      svg.appendChild(gPoly);
    }

    /* ---- 補助線（segments） ---- */
    if (segments.length) {
      var gSeg = el('g', { class: 'segments' });
      segments.forEach(function (s) {
        var pA2 = toPx(s.x1, s.y1), pB2 = toPx(s.x2, s.y2);
        var attrs = {
          x1: pA2[0], y1: pA2[1], x2: pB2[0], y2: pB2[1],
          stroke: s.color || COLOR_HELPER, 'stroke-width': 1.5
        };
        if (s.dash) attrs['stroke-dasharray'] = '4,3';
        gSeg.appendChild(el('line', attrs));
      });
      svg.appendChild(gSeg);
    }

    /* ---- 軸 ---- */
    var gAxis = el('g', { class: 'axis' });
    var ARROW = 9, OVER = 12;
    if (xAxisVisible) {
      var axL = toPx(xmin, 0), axR = toPx(xmax, 0);
      var tipX = axR[0] + OVER, tipY = axR[1];
      gAxis.appendChild(el('line', { x1: axL[0], y1: axL[1], x2: tipX, y2: tipY, stroke: COLOR_AXIS, 'stroke-width': 2 }));
      gAxis.appendChild(el('polygon', {
        points: tipX + ',' + tipY + ' ' + (tipX - ARROW) + ',' + (tipY - 4) + ' ' + (tipX - ARROW) + ',' + (tipY + 4),
        fill: COLOR_AXIS
      }));
      var xLabel = el('text', { x: tipX + 6, y: tipY + 8, 'font-size': 22, 'font-style': 'italic', fill: COLOR_AXIS, 'font-family': 'Georgia, "Times New Roman", serif' });
      xLabel.textContent = 'x';
      gAxis.appendChild(xLabel);
    }
    if (yAxisVisible) {
      var ayB = toPx(0, ymin), ayT = toPx(0, ymax);
      var tipYx = ayT[0], tipYy = ayT[1] - OVER;
      gAxis.appendChild(el('line', { x1: ayB[0], y1: ayB[1], x2: tipYx, y2: tipYy, stroke: COLOR_AXIS, 'stroke-width': 2 }));
      gAxis.appendChild(el('polygon', {
        points: tipYx + ',' + tipYy + ' ' + (tipYx - 4) + ',' + (tipYy + ARROW) + ' ' + (tipYx + 4) + ',' + (tipYy + ARROW),
        fill: COLOR_AXIS
      }));
      var yLabel = el('text', { x: tipYx + 7, y: tipYy + 10, 'font-size': 22, 'font-style': 'italic', fill: COLOR_AXIS, 'font-family': 'Georgia, "Times New Roman", serif' });
      yLabel.textContent = 'y';
      gAxis.appendChild(yLabel);
    }
    /* 目盛数字（0は描かない。負のxはその目盛の真下に置く） */
    var tickYPx = xAxisVisible ? toPx(0, 0)[1] : (H - PAD_B + 16);
    var closestNegTickEl = null, closestNegTickVal = -Infinity;
    var tickEls = []; /* グラフ名ラベルとの衝突チェック用に全目盛要素を保持 */
    for (var ti = ix0; ti <= ix1; ti++) {
      if (ti === 0) continue;
      if (ti % labelEveryX !== 0) continue;
      var tvx = ti * gridStep;
      var ptx = toPx(tvx, 0);
      var t = el('text', { x: ptx[0], y: tickYPx + 20, 'font-size': 18, fill: COLOR_TICK, 'text-anchor': 'middle' });
      t.textContent = fmtNum(tvx);
      gAxis.appendChild(t);
      tickEls.push(t);
      if (tvx < 0 && tvx > closestNegTickVal) { closestNegTickVal = tvx; closestNegTickEl = t; }
    }
    var tickXPx = yAxisVisible ? toPx(0, 0)[0] : (PAD_L - 8);
    for (var tj = iy0; tj <= iy1; tj++) {
      if (tj === 0) continue;
      if (tj % labelEveryY !== 0) continue;
      var tvy = tj * gridStep;
      var pty = toPx(0, tvy);
      var t2 = el('text', { x: tickXPx - 9, y: pty[1] + 6, 'font-size': 18, fill: COLOR_TICK, 'text-anchor': 'end' });
      t2.textContent = fmtNum(tvy);
      gAxis.appendChild(t2);
      tickEls.push(t2);
    }
    /* 原点O：x軸の目盛数字と同じ行（軸の下）、軸から左へ9px */
    var oLabel = null;
    if (xAxisVisible && yAxisVisible) {
      var pO = toPx(0, 0);
      oLabel = el('text', { x: pO[0] - 9, y: tickYPx + 20, 'font-size': 18, fill: COLOR_AXIS, 'text-anchor': 'end' });
      oLabel.textContent = 'O';
      gAxis.appendChild(oLabel);
      tickEls.push(oLabel);
    }
    svg.appendChild(gAxis);

    /* ---- グラフ（比例・反比例） ---- */
    var gGraphs = el('g', { class: 'graphs', 'clip-path': 'url(#' + clipId + ')' });
    var graphPaths = []; /* highlight参照用に保持 */
    var pendingLabels = []; /* クリップの外に置くのでgGraphsとは別groupへ後で描く */
    graphs.forEach(function (g, idx) {
      var color = resolveColor(g.color, g.type === 'inv' ? COLOR_ORANGE : COLOR_BLUE);
      var style = g.style || (idx === 0 ? 'solid' : 'dash');
      var dash = (style === 'dash') ? '7,5' : null;
      var pathInfo = { type: g.type, a: g.a, color: color };

      if (g.type === 'prop') {
        var rng = propRange(g.a, xmin, xmax, ymin, ymax);
        pathInfo.range = rng;
        if (rng) {
          var lo = rng[0], hi = rng[1];
          var pS = toPx(lo, g.a * lo), pE = toPx(hi, g.a * hi);
          var lineAttrs = { x1: pS[0], y1: pS[1], x2: pE[0], y2: pE[1], stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round' };
          if (dash) lineAttrs['stroke-dasharray'] = dash;
          gGraphs.appendChild(el('line', lineAttrs));
          if (g.label) {
            var x0p = (g.labelAt !== undefined) ? Math.min(hi, Math.max(lo, g.labelAt)) : pickPropLabelX(rng, g, idx, graphs, points, unit);
            if (x0p !== null) {
              pendingLabels.push({ x0: x0p, y0: evalGraphAt(g, x0p), text: g.label, color: color, g: g });
            }
          }
        }
      } else if (g.type === 'inv') {
        var branches = [];
        if (xmax > EPS) {
          var rp = invBranch(g.a, xmax, true, ymin, ymax);
          if (rp) branches.push(rp.concat([true]));
        }
        if (xmin < -EPS) {
          var rn = invBranch(g.a, xmin, false, ymin, ymax);
          if (rn) branches.push(rn.concat([false]));
        }
        pathInfo.branches = branches;
        branches.forEach(function (b) {
          var lo2 = b[0], hi2 = b[1];
          var N = 60;
          var pts = [];
          for (var k = 0; k < N; k++) {
            var xx = lo2 + (hi2 - lo2) * (k / (N - 1));
            var yy = g.a / xx;
            pts.push(toPx(xx, yy));
          }
          var d = 'M ' + pts.map(function (pt) { return pt[0].toFixed(2) + ',' + pt[1].toFixed(2); }).join(' L ');
          var pathAttrs = { d: d, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
          if (dash) pathAttrs['stroke-dasharray'] = dash;
          gGraphs.appendChild(el('path', pathAttrs));
        });
        if (g.label) {
          var x0i = (g.labelAt !== undefined) ? g.labelAt : pickAutoLabelX(branches.map(function (b) { return [b[0], b[1]]; }), g, idx, graphs, points, unit);
          if (x0i !== null && x0i !== undefined) {
            var y0i = evalGraphAt(g, x0i);
            if (y0i !== null && isFinite(y0i)) {
              pendingLabels.push({ x0: x0i, y0: y0i, text: g.label, color: color, g: g });
            }
          }
        }
      }
      graphPaths.push(pathInfo);
    });
    svg.appendChild(gGraphs);

    /* ---- 変域の強調（highlight） ---- */
    if (highlight && graphs[highlight.graphIndex]) {
      var hg = graphs[highlight.graphIndex];
      var hColor = resolveColor(hg.color, hg.type === 'inv' ? COLOR_ORANGE : COLOR_BLUE);
      var xFrom = highlight.xFrom, xTo = highlight.xTo;
      var gH = el('g', { class: 'highlight', 'clip-path': 'url(#' + clipId + ')' });
      if (hg.type === 'prop') {
        var pF = toPx(xFrom, hg.a * xFrom), pT = toPx(xTo, hg.a * xTo);
        gH.appendChild(el('line', { x1: pF[0], y1: pF[1], x2: pT[0], y2: pT[1], stroke: hColor, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      } else if (hg.type === 'inv') {
        var Nh = 30;
        var ptsH = [];
        for (var kh = 0; kh < Nh; kh++) {
          var xh = xFrom + (xTo - xFrom) * (kh / (Nh - 1));
          ptsH.push(toPx(xh, hg.a / xh));
        }
        var dH = 'M ' + ptsH.map(function (pt) { return pt[0].toFixed(2) + ',' + pt[1].toFixed(2); }).join(' L ');
        gH.appendChild(el('path', { d: dH, fill: 'none', stroke: hColor, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      }
      svg.appendChild(gH);
      /* 端点の●○（範囲に含む/含まない） */
      var yFrom = (hg.type === 'prop') ? hg.a * xFrom : hg.a / xFrom;
      var yTo = (hg.type === 'prop') ? hg.a * xTo : hg.a / xTo;
      drawEndpointMarker(svg, toPx(xFrom, yFrom), hColor, !!highlight.fromOpen);
      drawEndpointMarker(svg, toPx(xTo, yTo), hColor, !!highlight.toOpen);
    }

    /* ---- グラフのラベル（枠でクリップしない。labelAtで置くx座標を指定、labelDx/labelDy/labelAnchorで最終手動調整） ---- */
    var graphLabelEls = [];
    if (pendingLabels.length) {
      var gLabels = el('g', { class: 'graph-labels' });
      pendingLabels.forEach(function (lb) {
        var lEl = placeGraphLabel(gLabels, lb.x0, lb.y0, toPx(lb.x0, lb.y0), lb.text, lb.color, W, lb.g);
        graphLabelEls.push(lEl);
      });
      svg.appendChild(gLabels);
    }

    /* ---- 点 ---- */
    if (points.length) {
      var gPts = el('g', { class: 'points' });
      points.forEach(function (p) {
        var pc = toPx(p.x, p.y);
        var color = p.color || COLOR_POINT;
        gPts.appendChild(el('circle', { cx: pc[0], cy: pc[1], r: 4, fill: color }));
        if (p.name) {
          var pos = p.pos || 'ne';
          var anchor = p.anchor || ((pos === 'ne' || pos === 'se') ? 'start' : 'end');
          var dx = (p.dx !== undefined) ? p.dx : ((pos === 'ne' || pos === 'se') ? 10 : -10);
          var dy = (p.dy !== undefined) ? p.dy : ((pos === 'ne' || pos === 'nw') ? -11 : 19);
          var label = p.name + (p.coord ? '(' + fmtNum(p.x) + ', ' + fmtNum(p.y) + ')' : '');
          var t3 = el('text', {
            x: pc[0] + dx, y: pc[1] + dy, 'font-size': 20, 'font-weight': 700,
            fill: color, 'text-anchor': anchor,
            stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke'
          });
          t3.textContent = label;
          gPts.appendChild(t3);
        }
      });
      svg.appendChild(gPts);
    }

    container.innerHTML = '';
    container.appendChild(svg);

    /* 原点Oと、その左にあるx軸の負の目盛（例:-1）の実測ギャップが4px未満なら、目盛側を左へ寄せる。
       getBBoxはDOMに接続後でないと使えない環境があるため、appendChildの後・実測できる場合のみ調整する。 */
    if (oLabel && closestNegTickEl) {
      try {
        var oBox = oLabel.getBBox();
        var tBox = closestNegTickEl.getBBox();
        var gap = oBox.x - (tBox.x + tBox.width);
        if (gap < 4) {
          var curX = parseFloat(closestNegTickEl.getAttribute('x'));
          closestNegTickEl.setAttribute('x', curX - (4 - gap + 1));
        }
      } catch (e) { /* 測れない環境では現状のまま（元の位置でも大きな重なりにはならない既定値を使用済み） */ }
    }

    /* グラフ名ラベルが目盛数字・O・軸文字と実測で重なっていたら、重なっている目盛から遠ざかる向きへ押し出す（最大8回） */
    if (graphLabelEls.length && tickEls.length) {
      graphLabelEls.forEach(function (lEl) {
        if (!lEl) return;
        try {
          for (var tries = 0; tries < 8; tries++) {
            var lb = lEl.getBBox();
            var hit = null;
            for (var ti2 = 0; ti2 < tickEls.length; ti2++) {
              try {
                var tb = tickEls[ti2].getBBox();
                var overlap = !(lb.x + lb.width + 2 < tb.x || tb.x + tb.width + 2 < lb.x ||
                                 lb.y + lb.height + 2 < tb.y || tb.y + tb.height + 2 < lb.y);
                if (overlap) { hit = tb; break; }
              } catch (e2) { /* skip */ }
            }
            if (!hit) break;
            var lcx = lb.x + lb.width / 2, lcy = lb.y + lb.height / 2;
            var tcx = hit.x + hit.width / 2, tcy = hit.y + hit.height / 2;
            var vx = lcx - tcx, vy = lcy - tcy;
            var vlen = Math.sqrt(vx * vx + vy * vy);
            var ux2 = vlen > 0.01 ? vx / vlen : 0;
            var uy2 = vlen > 0.01 ? vy / vlen : -1;
            var curX = parseFloat(lEl.getAttribute('x'));
            var curY = parseFloat(lEl.getAttribute('y'));
            lEl.setAttribute('x', curX + ux2 * 8);
            lEl.setAttribute('y', curY + uy2 * 8);
          }
        } catch (e) { /* 測れない環境では既定位置のまま */ }
      });
    }
  }

  function drawEndpointMarker(svg, px, color, isOpen) {
    var c = el('circle', {
      cx: px[0], cy: px[1], r: 4.5,
      fill: isOpen ? '#ffffff' : color,
      stroke: color, 'stroke-width': 2
    });
    svg.appendChild(c);
  }

  /* グラフ名ラベルの位置：既定は接線の法線方向に12px（線と重ならない側）。
     srcGraph.labelDx/labelDyが指定されていればそちらを優先（最終手動調整用）。 */
  function placeGraphLabel(parent, x0, y0, pxPoint, text, color, W, srcGraph) {
    var dx, dy, anchor;
    var manual = srcGraph && (srcGraph.labelDx !== undefined || srcGraph.labelDy !== undefined);
    if (manual) {
      dx = (srcGraph.labelDx !== undefined) ? srcGraph.labelDx : 8;
      dy = (srcGraph.labelDy !== undefined) ? srcGraph.labelDy : -7;
      anchor = srcGraph.labelAnchor || (dx >= 0 ? 'start' : 'end');
    } else {
      var slope = (srcGraph.type === 'prop') ? srcGraph.a : (-srcGraph.a / (x0 * x0));
      var ddx = 1, ddy = -slope;
      var len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var ux = ddx / len, uy = ddy / len;
      /* 法線ベクトルの2択のうち、y0>=0なら上向き（pxのyが減る側）、y0<0なら下向きを選ぶ */
      var perp = (y0 >= 0) ? [uy, -ux] : [-uy, ux];
      var DIST = 14;
      dx = perp[0] * DIST;
      dy = perp[1] * DIST;
      anchor = (srcGraph && srcGraph.labelAnchor) || (Math.abs(dx) < 2 ? 'middle' : (dx > 0 ? 'start' : 'end'));
    }
    var fx = pxPoint[0] + dx, fy = pxPoint[1] + dy;
    if (fx > W - 10 && anchor === 'start') anchor = 'end';
    var t = el('text', {
      x: fx, y: fy, 'font-size': 20, 'font-weight': 700,
      fill: color, 'text-anchor': anchor,
      stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke'
    });
    t.textContent = text;
    parent.appendChild(t);
    return t;
  }

  global.drawPlane = drawPlane;
  /* テスト用に内部関数も公開 */
  global.__drawPlaneInternal = { propRange: propRange, invBranch: invBranch };
})(window);
