# Rebel 500 Custom Studio

繁體中文 Rebel 500 互動改裝預覽。使用 Three.js 建立可旋轉的完整立體幾何，包含獨立車體、輪胎、引擎、車架及可拆卸配件。

目前版本依 Honda 台灣、Honda 日本 2025 發表圖與零件特寫重新建模，優先改善外觀、材質與色彩：水滴油箱及翼形標誌、厚度較完整的低座墊、連續後土除、左右不同的引擎鑄件、四眼 LED 頭燈、成對鑄造輪輻、凹入的胎紋與胎壁字樣、細密散熱器、錐形排氣管及銀色尾蓋。黑色烤漆、鑄件、橡膠、鍍鉻及皮革採用分開的材質；攝影棚使用柔光反射與依車體生成的接地陰影。

## 開啟

線上版：[Rebel 500 Custom Studio](https://eddielu0524.github.io/Rebel500/)。

在此資料夾開啟終端機：

```powershell
npm install
npm run dev
```

瀏覽器開啟 http://127.0.0.1:5173 。若已安裝依賴，只需 `npm run dev`。也可以執行 `start-studio.ps1`。

## GitHub Pages 部署

此專案需要 Vite 建置，不能直接將原始碼根目錄當作靜態網站發布。Pages 的 Source 設為 **GitHub Actions**，推送 `main` 後，`.github/workflows/deploy-pages.yml` 會執行 `npm ci`、測試、建置，然後將 `dist` 部署到 Pages。

正式版資源路徑使用 `/Rebel500/`，本機開發維持 `/`。用 `npm run build` 及 `npm run preview` 可在本機檢查正式版；預覽網址為 `http://127.0.0.1:4173/Rebel500/`。

## 操作

- 拖曳旋轉；滾輪縮放；右鍵平移。手機支援單指旋轉及雙指縮放。
- 左側、右側、正面與車尾快捷視角、自動旋轉、車燈與兩種攝影棚光線。
- 八種選配：頭燈罩、短風鏡、前叉護套、棕色菱格坐墊、後座坐墊、雙側馬鞍包、後靠背、後貨架。
- 頭燈罩與風鏡為本預覽的互斥配置；馬鞍包預覽含支架。
- 原廠對照會暫時隱藏配件，保留目前車色，且不修改方案。
- 儲存方案使用此瀏覽器的 localStorage；也可匯出、匯入 JSON 保存多個方案。
- 在「查看我的改裝方案」匯出目前配置的 GLB，保留可見部件與材質，單位為公尺。
- 相機按鈕下載目前角度的 PNG。
- 「車款資料」可切換七張官方參考照片，比較整車、引擎、輪框、油箱及頭燈罩細節。

## 還原程度

**目前是參考照片重建的 3D 外觀預覽，並非所有細節 1:1 真實還原。**

參考來源：[Honda 台灣 Rebel500 官方頁面](https://moto.honda-taiwan.com.tw/motor/Detail/681dd145-be45-4248-a34e-8c554ccc8e8b)、[Honda 日本 2025 官方發表照片](https://global.honda/jp/news/2025/2250206-rebel500/image_download.html)、[Honda 日本車款細節](https://www.honda.co.jp/Rebel500/features01.html)。查閱日期：2026-09-30。完整照片來源與造型觀察記於 `public/references/sources.md`。台灣標準車為基礎，日本照片只補充角度與表面細節，各地配備可能不同。

- 以公尺建模；軸距 1.490 m。
- 前輪 130/90-16 → 輪胎名義外半徑 0.3202 m；後輪 150/80-16 → 0.3232 m。
- 原廠整車尺寸 2.205 × 0.820 × 1.090 m 與座高 0.690 m 為造型及顯示參考；沒有把每個曲面與安裝點當成實測值。
- 油箱、座墊、引擎、車架與配件是自製估算幾何；未使用原廠 CAD、掃描或付費第三方模型。
- 自訂配色不代表台灣原廠實際販售色。配件互斥規則是此預覽的視覺設計，不代表所有品牌商品的相容性。
- 不能用於判斷螺絲孔位、干涉、安全間隙、承重或直接製造。
- 要完成精確還原，需要相同年式的授權 CAD／實車 3D 掃描，以及選配商品的實測尺寸和安裝點。

官方參考照片 © Honda Motor Co., Ltd.，僅作本地參考。公開部署時請確認該照片的使用權，或將照片改為官方來源連結。

## 技術與驗證

Node.js 22.12+ 或 24、Vite、Three.js、Lucide。所有幾何與材質在本機產生，攝影棚環境沒有外部模型依賴。字型使用 Google Fonts，無網路時回退系統字型。

```powershell
npm test
npm run build
npm run preview
```

單元測試涵蓋配件互斥、可逆安裝、JSON 驗證、儲存失敗與輪胎尺寸。瀏覽器互動檢查及截圖位於 `output/playwright`。

`src/model.js`：車架、配件與幾何整合；`src/bodywork.js`：油箱／座墊／土除；`src/engine.js`：引擎鑄件；`src/wheels.js`：輪胎與煞車；`src/cockpit.js`：前叉、燈具與把手；`src/mechanical-details.js`：散熱器、排氣管與尾燈；`src/viewer.js`：場景、光線、鏡頭與匯出；`src/config.js`：規格、選配與方案驗證；`src/main.js`：介面與狀態。

`models/rebel-500-stock.glb` 與 `models/rebel-500-travel.glb` 為已匯出的素車、旅行搭配模型。兩者都是參考重建模型，不是製造或裝配用 CAD。
