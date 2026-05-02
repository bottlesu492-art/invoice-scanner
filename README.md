# 發票記帳掃描

這個 repo 是 GitHub Pages 前端，用來掃描台灣電子發票 QR、傳統發票 OCR，並把確認後的資料送到 Google Apps Script 寫入 Google Sheet。

## 架構

- GitHub Pages：前端網頁、即時相機掃描、拍照掃 QR、選相簿 QR、OCR、確認表單。
- Google Apps Script：後端 `Code.gs`，接收資料並寫入 Google Sheet / Google Drive。

## GAS 後端

前端已內建目前的 GAS `/exec` 網址，不會在畫面上顯示後端設定欄位。

```text
https://script.google.com/macros/s/AKfycbzzMQAZGkKTLwQfVctseKg7lFSY2TJBiyKL2tVNwIG74ZFJxOs78f6L0yDbmM4I6wXl/exec
```

如果 GAS 重新部署後換了網址，需要更新 `index.html` 裡的 `DEFAULT_GAS_URL`。

## 開啟 GitHub Pages

1. 進入 repo 的 `Settings`。
2. 左側選 `Pages`。
3. `Build and deployment` 選 `Deploy from a branch`。
4. Branch 選 `main`。
5. Folder 選 `/root`。
6. 按 `Save`。
7. 等 1 到 3 分鐘，GitHub 會產生網址：

```text
https://bottlesu492-art.github.io/invoice-scanner/
```

手機請用 Chrome 或 Safari 直接開這個網址，不要用 LINE 或 Messenger 內建瀏覽器。

## 使用

1. QR 發票：可用「即時掃描」、「拍照掃 QR」或「選相簿 QR」。
2. 傳統發票：切到 OCR，選「拍照辨識」或「選相簿辨識」，再按「辨識文字」。
3. 手動資料：切到手動，選「拍照附圖」或「選相簿附圖」。
4. 檢查右側欄位。
5. 按「儲存」。
6. 到 Google Sheet 確認資料是否寫入。

## 注意

GAS Web App 的存取權需要允許前端送資料。若儲存後 Google Sheet 沒出現資料，請回 GAS 檢查部署設定，通常需要「知道連結的任何人」或公司網域可存取。
