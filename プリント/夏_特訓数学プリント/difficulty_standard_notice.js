(function () {
  "use strict";

  var loader = document.currentScript;
  var auditStatus = loader && loader.getAttribute("data-audit-status") || "unreviewed";
  var auditedUnits = loader && loader.getAttribute("data-audited-units") || "";

  var STATUS_TEXT = {
    "full-n1": "監査状態：全採点単位をv3単独評定済（n=1候補・要監査）。独立3評定未完了のため確定Lではありません。",
    "lite-rated": "監査状態：L7-lite-v1.0による単独評定済（±1許容・2026-07-18）。精密な独立3評定は未実施です。",
    "partial-n1": "監査状態：このページで旧L4/L5が付いていた採点単位は全件、v3単独評定済（候補レベルは監査報告参照、n=1・要監査）。それ以外は新L未監査です。",
    "unreviewed": "監査状態：新L未監査です。画面上の旧Lから現行Lへ自動換算しません。",
    "reference": "監査状態：参考資料（採点単位0）のためL判定対象外です。"
  };

  function removePreviousNotice() {
    var divs = document.querySelectorAll("div");
    for (var i = 0; i < divs.length; i += 1) {
      var strong = divs[i].querySelector("strong");
      if (strong && strong.textContent.trim() === "難易度表示の注意" &&
          divs[i].textContent.indexOf("difficulty_standard=L7-v3.0") !== -1) {
        divs[i].parentNode.removeChild(divs[i]);
      }
    }
  }

  function addStyles() {
    if (document.getElementById("difficulty-standard-notice-style")) return;
    var style = document.createElement("style");
    style.id = "difficulty-standard-notice-style";
    style.textContent =
      ".difficulty-audit-banner{display:block;max-width:1100px;margin:10px auto 12px;padding:10px 12px;" +
      "border:2px solid #9a5b24;border-radius:10px;background:#fff7e8;color:#5d3818;" +
      "font:600 12.5px/1.65 -apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;" +
      "box-shadow:0 2px 8px rgba(94,56,24,.08)}" +
      ".difficulty-audit-banner strong{font-weight:900}.difficulty-audit-banner code{font-weight:800;color:#713f17}" +
      ".difficulty-audit-banner .difficulty-audit-state{display:block;margin-top:2px}" +
      ".difficulty-audit-banner a{color:#74420f;text-decoration:underline}" +
      ".difficulty-legacy-token{display:inline-flex;align-items:baseline;gap:.18em;padding:0 .24em;border:1px solid #a77a53;" +
      "border-radius:.35em;background:#f4eee8;color:#5f4938;white-space:nowrap;font:inherit}" +
      ".difficulty-legacy-token .difficulty-legacy-prefix{font-size:.68em;font-weight:900;letter-spacing:.02em;color:#8b3f24}" +
      "@media print{.difficulty-audit-banner{margin:4mm 0 3mm;padding:2.5mm 3mm;box-shadow:none;break-inside:avoid}" +
      ".difficulty-legacy-token{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";
    document.head.appendChild(style);
  }

  function addBanner() {
    var banner = document.createElement("aside");
    banner.className = "difficulty-audit-banner";
    banner.setAttribute("role", "note");
    banner.setAttribute("aria-label", "難易度監査状態");
    banner.setAttribute("data-difficulty-standard", "L7-v3.0");
    banner.setAttribute("data-audit-status", auditStatus);

    var countText = auditedUnits ? "（対象 " + auditedUnits + "単位）" : "";
    banner.innerHTML =
      "<strong>難易度規格：<code>difficulty_standard=L7-v3.0</code></strong>　" +
      "この画面の「旧表示 Lx」は2026-07-16以前の旧・無版ラベルで、現行Lではありません。" +
      "<span class=\"difficulty-audit-state\">" + (STATUS_TEXT[auditStatus] || STATUS_TEXT.unreviewed) +
      countText + "　<a href=\"../../../../分析/2026-07-16_夏プリント数学_v3難易度監査と特訓突破カバレッジ.md\">監査報告</a></span>";
    document.body.insertBefore(banner, document.body.firstChild);
    return banner;
  }

  function markLegacyLabels(root, banner) {
    var SHOW_TEXT = window.NodeFilter ? NodeFilter.SHOW_TEXT : 4;
    var FILTER_ACCEPT = window.NodeFilter ? NodeFilter.FILTER_ACCEPT : 1;
    var FILTER_REJECT = window.NodeFilter ? NodeFilter.FILTER_REJECT : 2;
    var candidates = [];
    var walker = document.createTreeWalker(root, SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (!p || p.namespaceURI !== "http://www.w3.org/1999/xhtml") return FILTER_REJECT;
        if (banner.contains(p) || p.closest("script,style,textarea,code,pre,.difficulty-legacy-token")) return FILTER_REJECT;
        return /(^|[^A-Za-z0-9])L[1-7](?![0-9])/.test(node.nodeValue) ? FILTER_ACCEPT : FILTER_REJECT;
      }
    });
    while (walker.nextNode()) candidates.push(walker.currentNode);

    for (var i = 0; i < candidates.length; i += 1) {
      var node = candidates[i];
      var text = node.nodeValue;
      var re = /(^|[^A-Za-z0-9])(L[1-7])(?![0-9])/g;
      var frag = document.createDocumentFragment();
      var last = 0;
      var match;
      while ((match = re.exec(text)) !== null) {
        var tokenStart = match.index + match[1].length;
        if (tokenStart > last) frag.appendChild(document.createTextNode(text.slice(last, tokenStart)));
        var token = document.createElement("span");
        token.className = "difficulty-legacy-token";
        token.setAttribute("aria-label", "旧・無版ラベル " + match[2]);
        var prefix = document.createElement("span");
        prefix.className = "difficulty-legacy-prefix";
        prefix.textContent = "旧表示";
        token.appendChild(prefix);
        token.appendChild(document.createTextNode(match[2]));
        frag.appendChild(token);
        last = tokenStart + match[2].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  function init() {
    if (!document.body || document.querySelector(".difficulty-audit-banner")) return;
    removePreviousNotice();
    addStyles();
    var banner = addBanner();
    markLegacyLabels(document.body, banner);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
