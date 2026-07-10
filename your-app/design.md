# 私のアプリ設計

## 1. 題材（一文で）
ゲームのジャンル、プレイ済みかを記録するサイト

## 2. テーブル設計
テーブル名: library
カラム: id / games(ゲーム名)/　ジャンル（マルチ、FPS、ホラーなど）/ played（プレイ済み 0 or 1）

## 3. 変換表
todos → library, done → played, todo.db → library, /todos → /library
