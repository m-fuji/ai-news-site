# ⚡️ AI Daily Pulse - 最新AIニュース自動配信サイト

毎日世界中と国内の最新AIニュースを自動収集・要約し、スマホからアプリ感覚で快適に閲覧できるWebサイトです。
**サーバー代・ドメイン代・API利用料すべて「完全無料（0円）」** で運用できます。

---

## 📱 主な機能
- **毎朝の自動更新**: GitHub Actions により、毎朝自動で最新ニュースを収集・要約・サイト反映（完全放置で運用可能）。
- **日本語3行要約 & カテゴリ自動分類**: Google Gemini API（無料枠）で要点をスマートに箇条書きまとめ。
- **スマホ特化UI**: アプリのような操作感、カード型デザイン、親指で押しやすいナビゲーション。
- **PWA対応**: スマホの「ホーム画面に追加」で全画面ネイティブアプリ化。
- **ダークモード / ライトモード**: 端末設定に連動しつつ手動切り替え可能。
- **ブックマーク機能**: 気に入った記事を端末内（LocalStorage）に安全に保存。
- **即座に共有**: Web Share API 対応で、ワンタップでLINEやX、メッセージに送信。

---

## 🚀 【はじめての方向け】GitHubを使った無料公開手順

GitHubを使ったことがない方でも、以下のステップ通りに進めるだけで数分で自分のサイトをインターネット上に無料公開できます！

### ステップ 1: GitHub アカウントを作成する（無料）
1. [GitHub公式サイト (github.com)](https://github.com/) にアクセスします。
2. 「Sign up」をクリックし、メールアドレス・パスワード・ユーザー名（半角英数字）を入力してアカウントを作成します。
3. 登録したメールアドレスに届く認証コードを入力すれば完了です。

---

### ステップ 2: 新しいリポジトリ（置き場）を作る
1. GitHubにログインした状態で、画面右上の「**＋**」アイコンをクリックし、「**New repository**」を選択します。
2. 以下のように設定します：
   - **Repository name**: `ai-news-site` （お好みの名前でOK）
   - **Public** を選択（Publicにすると、GitHub ActionsもGitHub Pagesも完全無料で無制限に利用できます）
   - ※「Add a README file」等のチェックは外したままで大丈夫です。
3. 緑色の「**Create repository**」ボタンを押します。

---

### ステップ 3: このPCのファイルをGitHubに送信（プッシュ）する
お使いのMacのターミナル（またはVS Code / Antigravityのターミナル）で、以下のコマンドを順に実行します。
*(※ `YOUR_USERNAME` の部分をご自身のGitHubユーザー名に変更してください)*

```bash
cd /Users/yasuyuki/Documents/Antigravity/NeweSite

# Gitの初期設定（初回のみ）
git init
git add .
git commit -m "feat: first commit for AI Daily Pulse"
git branch -M main

# あなたのGitHubリポジトリと紐付け
git remote add origin https://github.com/YOUR_USERNAME/ai-news-site.git

# 送信（プッシュ）
git push -u origin main
```

*(※初回プッシュ時にGitHubへのログイン確認画面またはパスワード入力が出た場合は、ブラウザでサインインを許可してください)*

---

### ステップ 4: GitHub Pages を有効化する（サイト無料公開！）
1. GitHub上のご自身のリポジトリページを開きます。
2. 上部タブの「**Settings**」をクリックします。
3. 左サイドバーの「**Pages**」をクリックします。
4. **Build and deployment** の設定：
   - **Source**: `Deploy from a branch` を選択
   - **Branch**: `main` を選択し、フォルダは `/ (root)` のまま「**Save**」をクリックします。
5. 1〜2分待つと、画面上部にあなたのサイトURLが表示されます！
   - 例: `https://YOUR_USERNAME.github.io/ai-news-site/`
   - このURLにスマホのブラウザからアクセスすれば、どこからでも閲覧できます！

---

### ステップ 5: 自動コミット権限を許可する
GitHub Actionsが毎朝記事を自動更新して保存できるように、以下の設定を1箇所だけ確認・許可します：
1. リポジトリの「**Settings**」タブを開きます。
2. 左サイドバーの「**Actions**」 > 「**General**」をクリックします。
3. ページ下部の **Workflow permissions** で、
   - **「Read and write permissions」** を選択して「**Save**」をクリックします。

---

### ステップ 6 (任意): Gemini APIでさらに賢く3行要約させる
※この設定を行わなくても、元の記事概要を使って正常に自動更新されます。
さらに高品質な「日本語3行要約」と「高精度カテゴリ分類」を効かせたい場合は、無料のGemini APIキーを設定します。

1. [Google AI Studio (aistudio.google.com)](https://aistudio.google.com/) にGoogleアカウントでログインします。
2. 「**Get API key**」をクリックし、「**Create API key**」でキーを発行・コピーします（完全無料です）。
3. GitHubのリポジトリに戻り、「**Settings**」タブを開きます。
4. 左サイドバーの「**Secrets and variables**」 > 「**Actions**」をクリックします。
5. 「**New repository secret**」ボタンをクリックし、
   - **Name**: `GEMINI_API_KEY`
   - **Secret**: コピーしたAPIキーを貼り付け
6. 「**Add secret**」をクリックすれば設定完了です！

---

## ⏰ 自動更新のタイミングと手動更新

- **自動更新**: 毎朝 日本時間 7:00 AM に自動実行されます。
- **手動更新**: 今すぐ更新したい場合は、GitHubのリポジトリ画面上部の「**Actions**」タブ > 「**Daily AI News Auto-Update**」 > 「**Run workflow**」ボタンを押すと、いつでも即座に更新できます。

---

## 📱 スマホのホーム画面に追加してアプリ化する手順

- **iPhone (Safari)**:
  1. Safariで公開されたサイトURLを開きます。
  2. 画面下部中央の共有ボタン（四角から上矢印が飛び出ているアイコン）をタップします。
  3. メニューを少しスクロールして「**ホーム画面に追加**」をタップします。
  4. 右上の「追加」を押すと、アプリアイコンがホーム画面に並び、全画面で起動できるようになります。

- **Android (Chrome)**:
  1. Chromeでサイトを開きます。
  2. 画面右上の3点リーダー（メニュー）をタップします。
  3. 「**ホーム画面に追加**」または「**アプリをインストール**」をタップします。

---

## 💻 ローカル（このPC）で動作確認したいとき
Mac上で画面を確認したい場合は、ターミナルで以下を実行するだけです：

```bash
cd /Users/yasuyuki/Documents/Antigravity/NeweSite
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000` を開くと、実際の動作を確認できます。
