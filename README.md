# Daily News Portal

毎日自動更新されるニュースポータル。IT・AI、政治、世界情勢、注目ニュースを各ジャンル3件ずつ、合計15件配信します。

## 構成

```
.
├── index.html      # メインページ
├── style.css       # スタイル（ライト/ダークモード対応）
├── script.js       # data.json を読み込み描画
├── data.json       # 日次更新されるニュースデータ（自動更新）
└── README.md
```

## 公開方法（GitHub Pages）

1. このリポジトリの **Settings → Pages** を開く
2. Source を `Deploy from a branch` にする
3. Branch を `main` / フォルダを `/ (root)` にして Save
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

## 自動更新

`data.json` は Claude のスケジュールタスク `daily-ai-news` により毎朝自動的に最新化されます。
