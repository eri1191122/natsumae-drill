const CACHE='natsumae-v8';
const ASSETS=["./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-512.png", "./プリント/数学/Day01_数学_正負の数_除法逆数.html", "./プリント/数学/Day03_数学_正負の数_意味と文章を式に.html", "./プリント/横断/復習01_小学校算数スタート_中1単語熟語.html", "./プリント/横断/復習02_分数の計算.html", "./プリント/横断/復習03_割合と百分率.html", "./プリント/横断/復習04_概数と数直線.html", "./プリント/横断/復習05_倍数約数と単位換算.html", "./プリント/横断/復習06_速さと比_小学校総まとめ.html", "./プリント/横断/復習07_図形_面積と複合図形.html", "./プリント/横断/復習08_場合の数と規則性.html", "./プリント/横断/復習09_速さと割合の応用.html", "./プリント/横断/通常01_数学四則混合と英語疑問詞.html", "./プリント/横断/通常02_正負の数の利用と英語複数形.html", "./プリント/横断/通常03_英作文と数学ミニ.html", "./プリント/横断/通常04_正負の数まとめと速さのグラフ復習.html", "./プリント/横断/通常05_文字式の表し方1と三単現.html", "./プリント/横断/通常06_文字式で数量を表す.html", "./プリント/横断/通常07_代入と式の値.html", "./プリント/横断/通常08_一次式の加法減法.html", "./プリント/横断/通常09_一次式の計算と分配.html", "./プリント/横断/通常10_文字式の利用_文章を式に.html", "./プリント/横断/通常11_夏前総合_正負と文字式.html", "./プリント/横断/週末復習01_第1週.html", "./プリント/英語/Day02_英語_スペリングとbe動詞.html", "./プリント/夏_特訓数学プリント/特訓P1_正負の数_L3L4.html", "./プリント/夏_特訓数学プリント/特訓P2a_文字式_演習.html", "./プリント/夏_特訓数学プリント/特訓P2b_文字式_特訓_立式.html", "./プリント/夏_特訓数学プリント/特訓P3_方程式の解法_演習.html", "./プリント/夏_特訓数学プリント/特訓P4_文章を式に1_型カード_個数過不足.html", "./プリント/夏_特訓数学プリント/特訓P5_文章を式に2_速さ_割合利益.html", "./プリント/夏_特訓数学プリント/特訓P6_文章を式に3_正負の文章.html", "./プリント/夏_特訓数学プリント/特訓P7_方程式の利用_4型混合演習.html", "./プリント/夏_特訓数学プリント/特訓P8a_図形_演習.html", "./プリント/夏_特訓数学プリント/特訓P8_複合図形_円_折り返し角.html", "./プリント/夏_特訓数学プリント/特訓P9a_規則性_演習.html", "./プリント/夏_特訓数学プリント/特訓P9_規則性_n式.html", "./プリント/夏_特訓数学プリント/特訓P10a_速さグラフ_水そう_演習.html", "./プリント/夏_特訓数学プリント/特訓P10_速さグラフ_水そう.html", "./プリント/夏_特訓数学プリント/特訓P11_ケアレス潰し_答案化.html", "./プリント/夏_特訓数学プリント/特訓P12_過去問形式_通しセット.html", "./プリント/夏_特訓数学プリント/特訓P12b_過去問形式_通しセット2.html", "./プリント/夏_特訓数学プリント/特訓P12c_過去問形式_通しセット3.html", "./記録ボード_毎日プリント集計.html", "./つかいかた.html", "./セットアップ_さいしょの設定.html"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      if(resp.ok){
        const cp=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});
      }
      return resp;
    }).catch(()=>{
      if(e.request.mode==='navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
