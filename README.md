# Brew by Feel — 手沖咖啡直覺挑戰

> 沒有秤，沒有計時器。你能只憑感覺沖出一杯好咖啡嗎？

失控手沖升級版：**選豆 → 研磨 → 倒粉 → 準備熱水 → 手沖 → 結算**。

親手轉動磨豆機、移動粉杯、掌握水溫，再控制水壺與粉床上的落點。所有材料、粉床、液面與滴漏都有實際狀態，會共同影響風味及成績。無店鋪經營、貨幣、會員、後端或付費 API。

**已在本機實作並使用 Chrome 自動化操作驗證；尚未上傳或公開部署 GitHub Pages。**

## 啟動遊戲

在 VS Code 開啟此資料夾，對 index.html 按右鍵 → **Open with Live Server**。若沒有此擴充套件，可在專案終端機執行：

    python -m http.server 5500

開啟 http://localhost:5500/；終端機按 Ctrl+C 可停止。本機 HTTP 只用來提供靜態檔案，正式遊戲沒有伺服器邏輯。

也支援直接以瀏覽器開啟 index.html。file:// 的 localStorage 政策依瀏覽器而異，作業展示建議使用 Live Server 或 GitHub Pages。

## 完整玩法

| 階段 | 你需要做的事 |
| --- | --- |
| 選豆 | 閱讀六款卡片介紹，選擇配方與正式／練習模式 |
| 研磨 | 設定粗細，放入豆子，拖曳木質手柄繞中心轉動 |
| 倒粉 | 按住粉杯移到濾杯上方，傾斜讓粉落下，再輕晃濾杯鋪平 |
| 熱水 | 開始／停止加熱，觀察類比溫度錶、蒸氣與冷卻，自行決定開始 |
| 手沖 | 先潤濕、停水悶蒸，再分段續注，觀察積水及滴漏 |
| 結算 | 自行完成，閱讀品質輪廓、參數、風味與建議，再挑戰 |

必要準備沒有完成，就不能進入下一階段。固定一份豆子，實際研磨及倒入的份量會帶進沖煮模型。

## 操作方式

### 手沖

| 操作 | 效果 |
| --- | --- |
| 按住綠色水壺 | 按目前設定出水 |
| 前後左右拖曳 | 在二維粉床上移動目標、畫圈；快速甩動有慣性 |
| 滾輪向上／向下 | 增強／減弱流量；強流水柱更粗、更快，也更容易偏離瞄準處 |
| W／S | 增強／減弱流量 |
| 放開滑鼠或手指 | 立即停水；萃取與排水仍持續 |
| 前後落點滑桿、方向鍵或點粉床 | 設定前後位置與落點 |
| 操作模式選單 | 可改用上下拖曳調流量；前後位置改用滑桿或方向鍵 |
| 全景／俯視／近看粉床 | 切換觀察角度，先停水並保留進度 |
| 完成沖煮 | 自行收尾並查看結果 |

目標與實際落點分開管理：虛線小環是瞄準處，水柱末端才是真正落點。壺嘴仍有幾何補償；柔和靜止的水流準確，急甩產生慣性，大流量帶來可預期、有上限的偏流。減弱水流、放慢移動即可重新掌握。俯視最容易觀察前後、內外圈及局部變化。

觸控可先用獨立滑桿調整強弱與前後位置，再按住水壺前後左右移動。鍵盤先聚焦水壺，按住空白鍵出水、放開停止；方向鍵調落點，W/S 調流量。Esc 或暫停按鈕暫停。

### 研磨與倒粉

- 磨豆機：拖曳木質手柄繞圈；也可聚焦手柄按住空白鍵。開始轉動後固定研磨設定。暴力快速連甩會累積壓力，手柄可能真的飛走！按住「裝回手柄」可修復，豆粉不會消失。正式約需 1.4 秒，練習約 0.9 秒；放慢後繼續研磨。
- 粉杯：按住拖移到濾杯上方，滾輪或傾角滑桿控制傾倒，放開停止。觸控可先調傾角再拖移。
- 鍵盤倒粉：聚焦粉杯，用方向鍵移動，按住空白鍵傾倒；傾角由滑桿設定。
- 鋪平：按住濾杯左右輕晃；鍵盤聚焦濾杯後使用左右鍵。

### 暫停與中斷

準備及沖煮都能暫停。切換分頁、視窗失焦或偵測長畫面中斷時自動凍結，返回須明確繼續。看指南會暫停；只有放開水壺不會停止時間。

## 這次會發生什麼事？

- 不是只有左右：前後左右拖壺、畫圈，俯視及近看可分辨局部濕粉、乾粉與氣泡。
- 同一點沖太久，粉床會出坑、變深並留下通道；強流會翻攪與噴濺。
- 靠邊會打濕濾紙、留下器具水痕與滑落水珠；沖出去會逐漸累積桌面水灘。
- 「濾杯：我在這裡」「這不是手沖，這是水災」等提示最多每 5 秒出現一次，約 2.6 秒消失。減少動畫設定會關閉事故震動。
- 暴力磨豆會咔啦斷柄、手柄飛落；修好能繼續，不重置材料。
- 水壺往前緣伸時會降低；低壺快速甩進杯緣會把濾杯撞倒，更猛烈會連帶撞倒分享壺。器具會保持倒下、液體實際灑出；放開後按「扶正器具」再繼續，水灘和事故紀錄保留。慢慢靠近、一般小圈不會任意觸發。
- 結算新增現場紀錄：灑出比例、邊緣命中、桌面水量、事故次數、通道、翻攪、水流穩定度及斷柄。

實際灑水會減少有效入床水，也降低原有控制與平衡分；另外依事故程度扣分。練習只將「事故額外扣分」減半，不會憑空補回灑掉的水。完整公式見 [SPEC](./docs/SPEC.md)。所有水痕由實際損失水量累積，固定最多 48 區，不會不斷新增 DOM 或粒子物件。

## 六款示範配方

| 咖啡 | 品種 | 處理／烘焙 | 代表性風味 |
| --- | --- | --- | --- |
| 衣索比亞耶加雪菲 | 地方品系示範組合 | 水洗／淺焙 | 佛手柑、茉莉、蜂蜜 |
| 哥倫比亞薇拉 | Caturra | 水洗／中焙 | 紅蘋果、焦糖、可可 |
| 肯亞奈里 | SL28 | 水洗／中淺焙 | 黑醋栗、葡萄柚、黑糖 |
| 巴西南米納斯 | Mundo Novo | 日曬／中深焙 | 堅果、黑巧克力、熟果 |
| 瓜地馬拉安提瓜 | Bourbon | 水洗／中焙 | 橙皮、太妃糖、可可 |
| 巴拿馬波奎特 | Geisha 巴拿馬系 | 水洗／淺焙 | 白花、柑橘、紅茶 |

這些不是販售批次，不杜撰莊園、海拔或得獎紀錄。風味是遊戲代表性描述，並非品種的必然結果。品種背景參考 [World Coffee Research 品種目錄](https://worldcoffeeresearch.org/resources/coffee-varieties-catalog)，各卡片提供對應資料來源。

不同配方有不同溶解性、滲透率、釋氣、悶蒸與節奏參數。研磨改變排水及接觸；水溫連續影響萃取速率，無單一固定配方能保證所有豆子滿分。

## 正式挑戰與練習

正式挑戰的水溫錶不顯示精確數字，也不標示最佳溫度；沒有水量、秒數、倒數或最佳進度線。練習模式可看水溫與該示範配方的參考範圍，練習的斷柄門檻較高，事故額外扣分減半，其他物理與核心操作相同。

結算揭露豆種、烘焙、研磨、起始／平均／結束水溫、注水量、時間、段數、五項指標、準備表現及主要失分因素。模擬萃取進度是遊戲內無因次數值，不能當成真實萃取率。

本版正式最佳記錄使用 localStorage 的 brew-by-feel.best.v3；練習不覆寫正式成績。前版 v2／v1 紀錄保留，沒有 v3 時首頁會提示前版成績，不直接比較不同模型。

## 技術與架構

純 HTML5、CSS3、原生 JavaScript、Canvas 2D、SVG、Pointer Events、Web Audio、localStorage。無需 Node.js、npm、打包工具、資料庫、登入或 API 金鑰。圖片與音效皆由程式繪製／合成，不需載入第三方素材。

    coffee-brewing-game/
    ├─ index.html
    ├─ style.css
    ├─ js/
    │  ├─ beans.js                  六款資料與遊戲參數
    │  ├─ chaos.js                  事故、濕痕、侵蝕、模式與額外扣分
    │  ├─ controls.js               目標、流量與壺身幾何補償
    │  ├─ preparation.js            豆粉、研磨、倒粉、加熱狀態
    │  ├─ preparation-renderer.js   準備階段向量與粒子
    │  ├─ model.js                  水量、溫度、萃取與獨立評分
    │  ├─ renderer.js               三視角、液面、滴漏與粉床
    │  └─ game.js                   流程、輸入、UI、音效、紀錄
    ├─ assets/favicon.svg
    ├─ docs/
    │  ├─ SPEC.md
    │  ├─ DEVELOPMENT.md
    │  ├─ REPORT.md
    │  └─ TESTING.md
    ├─ tests/                       開發測試，不是網站依賴
    ├─ .gitignore
    └─ .nojekyll

## GitHub Pages 部署

### 建立 Repository 與上傳

1. 登入 GitHub，選 **New repository**。
2. 名稱可用 **coffee-brewing-game**，選 **Public**，建立 Repository。
3. 選 **uploading an existing file**，或 **Add file → Upload files**。
4. 上傳 index.html、style.css、js/、assets/、docs/、README.md、tests/、.gitignore、.nojekyll，保留資料夾結構。**index.html 要直接位於 Repository 根目錄。**
5. 不要上傳 .tools/、tests/artifacts/、__pycache__/；它們含本機測試套件、備份及產出，均非部署所需。
6. 填入提交說明，按 **Commit changes**。

若已安裝 Git，也可從終端機上傳到自己建立的空 Repository，先將 YOUR_ACCOUNT 換成帳號：

    git init
    git add .
    git commit -m "完成失控手沖升級"
    git branch -M main
    git remote add origin https://github.com/YOUR_ACCOUNT/coffee-brewing-game.git
    git push -u origin main

本次工作環境未提供可直接使用的 Git／GitHub CLI；沒有執行登入、遠端建立或推送。修改前已建立本機 ZIP 安全備份，歷程見開發紀錄。

### 設定 Pages

1. Repository → **Settings → Pages**。
2. **Build and deployment → Source → Deploy from a branch**。
3. **Branch → main**，資料夾 **/ (root)**。
4. 按 **Save**，到 **Actions** 等待 Pages 工作完成。
5. 回 **Settings → Pages**，複製真正提供的公開網址。

一般專案網址格式為 https://YOUR_ACCOUNT.github.io/coffee-brewing-game/；這只是格式示例，並非已部署網址。設定依據：[GitHub Pages 官方發佈來源說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

### 驗證公開網站

- 無痕開啟實際網址，確認首頁、字型、圖示及器具正常。
- 完成一次選豆、研磨、倒粉、熱水、手沖及結算。
- 測試三視角、停水、指南、暫停及再挑戰。
- 在 Console／Network 確認無例外、404 或失敗資源。
- 重整與縮放，確認 Repository 子路徑依然載入正常。
- 回填 REPORT.md 的真實連結與公開驗收紀錄。

所有檔案使用相對路徑，已在 /coffee-brewing-game/ 子路徑測試。不需設定 base URL 或後端。若出現 404，先確認 main / (root)、index.html 位置與部署狀態；更新後可強制重新整理。

## 測試與作業文件

遊戲本身不用安裝測試工具。若要重跑，需 Python、Chrome 與開發用 Playwright：

    python -m pip install --target .tools/python playwright
    python tests/chaos_test.py
    python tests/collision_test.py
    python tests/chaos_visual_test.py
    python tests/browser_test.py
    python tests/lifecycle_test.py
    python tests/views_test.py
    python tests/full_brew_test.py
    python tests/check_files.py

預設使用 Windows 的 C:\Program Files\Google\Chrome\Application\chrome.exe。測試會啟動並自動關閉暫時的靜態 HTTP，截圖及模型 JSON 產生在被忽略的 tests/artifacts/。tests/calibrate.py 可列出六款模型策略結果。第一階段測試因流程改變已重新整理，舊版保存在備份中。

[遊戲規格](./docs/SPEC.md) · [真實 AI 開發紀錄](./docs/DEVELOPMENT.md) · [成果報告草稿](./docs/REPORT.md) · [已驗證與待測清單](./docs/TESTING.md)

尚需使用者自行完成 GitHub 登入及公開部署、實體手機／其他瀏覽器驗收，並填寫報告的個人資訊與心得。
