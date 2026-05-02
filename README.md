# 發票記帳掃描

這個 repo 是 GitHub Pages 前端，用來掃描台灣電子發票 QR、傳統發票 OCR，並把確認後的資料送到 Google Apps Script 寫入 Google Sheet。

## 架構

- GitHub Pages：前端網頁、即時相機掃描、拍照掃 QR、選相簿 QR、OCR、確認表單。
- Google Apps Script：後端 `Code.gs`，接收資料並寫入 Google Sheet / Google Drive。

## 隱私與安全

這個 repo 如果是 Public，程式碼和 GitHub Pages 網站都可能被其他人看到。不要把 GAS `/exec` 網址、token、公司資料或私人資訊 commit 到 repo。

目前前端不再把 GAS 網址寫在公開程式碼裡。第一次使用時，網頁會要求貼上 GAS `/exec` 網址，並只存在該裝置瀏覽器的 localStorage。

如果 GAS 網址曾經 commit 到公開 repo，請重新建立一個新的 GAS Web App 部署網址，並停止使用舊網址。

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

1. 第一次開啟時，貼上新的 GAS `/exec` 網址並按「記住」。
2. QR 發票：可用「即時掃描」、「拍照掃 QR」或「選相簿 QR」。
3. 傳統發票：切到 OCR，選「拍照辨識」或「選相簿辨識」，再按「辨識文字」。
4. 手動資料：切到手動，選「拍照附圖」或「選相簿附圖」。
5. 檢查右側欄位。
6. 按「儲存」。
7. 到 Google Sheet 確認資料是否寫入。

## 注意

GAS Web App 的存取權需要允許前端送資料。若儲存後 Google Sheet 沒出現資料，請回 GAS 檢查部署設定，通常需要「知道連結的任何人」或公司網域可存取。
