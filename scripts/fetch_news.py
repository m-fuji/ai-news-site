#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIニュース自動収集・要約スクリプト (業務特化＆新カテゴリ版)
・Google Cloud / Vertex AI および パートナー（Accenture, Deloitte, NRI等）動向を強化収集
・Geminiと他社LLMを明確にカテゴリ分離
・海外最新ニュースの収集＆日本語翻訳フラグ（🌐）対応
"""

import os
import sys
import json
import time
import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import requests
import urllib.parse
import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

# 日本標準時 (JST)
JST = timezone(timedelta(hours=9))

# データ保存先パス
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "news.json")

# 新カテゴリ体系
CATEGORIES = [
    "✨ Gemini・Google AI",
    "🤖 他社LLM・フロンティア",
    "🏢 パートナー・クラウド動向",
    "🎨 画像・動画・マルチモーダル",
    "🛠️ 活用ツール・エージェント"
]

# パートナー・クラウド関連キーワード
PARTNER_KEYWORDS = [
    "accenture", "アクセンチュア",
    "deloitte", "デロイト",
    "nri", "野村総合研究所",
    "google cloud", "グーグルクラウド", "vertex ai",
    "パートナー", "アライアンス", "協業", "提携", "導入事例", "エンタープライズ"
]

# 巡回するRSSフィードの定義
RSS_FEEDS = [
    # --- Google Cloud & パートナー特化フィード ---
    {
        "name": "Google Cloud Blog (公式)",
        "url": "https://cloudblog.withgoogle.com/rss/",
        "lang": "en",
        "is_foreign": True,
        "default_category": "✨ Gemini・Google AI"
    },
    {
        "name": "Google Cloud & Vertex AI ニュース",
        "url": "https://news.google.com/rss/search?q=Google+Cloud+AI+OR+Vertex+AI&hl=ja&gl=JP&ceid=JP:ja",
        "lang": "ja",
        "is_foreign": False,
        "default_category": "✨ Gemini・Google AI"
    },
    {
        "name": "パートナー動向 (Accenture / Deloitte / NRI)",
        "url": "https://news.google.com/rss/search?q=(アクセンチュア+OR+デロイト+OR+野村総合研究所+OR+NRI)+(AI+OR+クラウド)&hl=ja&gl=JP&ceid=JP:ja",
        "lang": "ja",
        "is_foreign": False,
        "default_category": "🏢 パートナー・クラウド動向"
    },
    {
        "name": "ITmedia エンタープライズ",
        "url": "https://rss.itmedia.co.jp/rss/2.0/enterprise.xml",
        "lang": "ja",
        "is_foreign": False,
        "filter_keywords": ["ai", "クラウド", "dx", "生成ai", "アクセンチュア", "デロイト", "nri", "google"],
        "default_category": "🏢 パートナー・クラウド動向"
    },

    # --- 国内主要AIメディア ---
    {
        "name": "ITmedia AI+",
        "url": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
        "lang": "ja",
        "is_foreign": False,
        "default_category": "🤖 他社LLM・フロンティア"
    },
    {
        "name": "はてなブックマーク (AI人気)",
        "url": "https://b.hatena.ne.jp/q/AI?sort=hot&target=title&mode=rss",
        "lang": "ja",
        "is_foreign": False,
        "default_category": "🛠️ 活用ツール・エージェント"
    },
    {
        "name": "GIGAZINE (AI)",
        "url": "https://gigazine.net/news/rss_2.0/",
        "lang": "ja",
        "is_foreign": False,
        "filter_keywords": ["ai", "人工知能", "gemini", "gpt", "claude", "llm", "モデル"],
        "default_category": "🤖 他社LLM・フロンティア"
    },

    # --- 海外最新・先端AIメディア (翻訳対象) ---
    {
        "name": "OpenAI Blog",
        "url": "https://openai.com/news/rss.xml",
        "lang": "en",
        "is_foreign": True,
        "default_category": "🤖 他社LLM・フロンティア"
    },
    {
        "name": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "lang": "en",
        "is_foreign": True,
        "default_category": "✨ Gemini・Google AI"
    },
    {
        "name": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "lang": "en",
        "is_foreign": True,
        "default_category": "🤖 他社LLM・フロンティア"
    },
    {
        "name": "The Verge (AI)",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "lang": "en",
        "is_foreign": True,
        "default_category": "🤖 他社LLM・フロンティア"
    },
    {
        "name": "MIT Technology Review (AI)",
        "url": "https://www.technologyreview.com/topic/artificial-intelligence/feed",
        "lang": "en",
        "is_foreign": True,
        "default_category": "🤖 他社LLM・フロンティア"
    },
    {
        "name": "AWS Machine Learning Blog",
        "url": "https://aws.amazon.com/jp/blogs/machine-learning/feed/",
        "lang": "ja",
        "is_foreign": False,
        "default_category": "🏢 パートナー・クラウド動向"
    }
]


def clean_html(raw_html: str) -> str:
    """HTMLタグを除去してプレーンテキストにする"""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def matches_filter(title: str, text: str, keywords: List[str]) -> bool:
    """指定キーワードのいずれかが含まれているか"""
    combined = (title + " " + text).lower()
    return any(k.lower() in combined for k in keywords)


def detect_partner_tags(title: str, text: str) -> List[str]:
    """記事内のパートナー・主要キーワードを抽出"""
    combined = (title + " " + text).lower()
    tags = []
    if "google cloud" in combined or "vertex ai" in combined or "gcp" in combined:
        tags.append("Google Cloud")
    if "accenture" in combined or "アクセンチュア" in combined:
        tags.append("Accenture")
    if "deloitte" in combined or "デロイト" in combined:
        tags.append("Deloitte")
    if "nri" in combined or "野村総合研究所" in combined:
        tags.append("NRI")
    return tags


def classify_category(title: str, text: str, default_cat: str) -> str:
    """ルールベースで記事を新カテゴリに分類"""
    combined = (title + " " + text).lower()

    # 1. Gemini / Google AI
    if any(k in combined for k in ["gemini", "vertex ai", "google ai", "deepmind", "gemma", "google workspace", "google cloud ai"]):
        return "✨ Gemini・Google AI"

    # 2. パートナー・クラウド動向 (Accenture, Deloitte, NRI, クラウド協業)
    if any(k in combined for k in ["accenture", "アクセンチュア", "deloitte", "デロイト", "nri", "野村総合研究所", "google cloud", "パートナー", "アライアンス", "エンタープライズ", "協業", "sier", "コンサル"]):
        return "🏢 パートナー・クラウド動向"

    # 3. 画像・動画・マルチモーダル
    if any(k in combined for k in ["image", "video", "画像生成", "動画生成", "音声合成", "midjourney", "sora", "runway", "dall-e", "diffusion"]):
        return "🎨 画像・動画・マルチモーダル"

    # 4. 他社LLM (OpenAI, Claude, DeepSeek, Llama等)
    if any(k in combined for k in ["chatgpt", "openai", "gpt-4", "gpt-5", "claude", "anthropic", "deepseek", "llama", "meta ai", "copilot", "grok", "mistral", "qwen"]):
        return "🤖 他社LLM・フロンティア"

    # 5. 活用ツール・エージェント
    if any(k in combined for k in ["agent", "エージェント", "tool", "ツール", "github", "cursor", "sdk", "api", "フレームワーク"]):
        return "🛠️ 活用ツール・エージェント"

    return default_cat


def parse_published_date(entry: Any) -> datetime:
    """公開日時を抽出してUTC日時に変換"""
    for date_field in ["published", "updated", "created", "pubDate"]:
        if hasattr(entry, date_field):
            date_str = getattr(entry, date_field)
            try:
                dt = date_parser.parse(date_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                pass
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)


def generate_article_id(url: str, title: str) -> str:
    raw = f"{url}_{title}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def load_existing_cache() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(OUTPUT_FILE):
        return {}
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            articles = data.get("articles", [])
            return {a["id"]: a for a in articles if "id" in a and "summary_bullets" in a}
    except Exception as e:
        print(f"Warning: Failed to load existing cache: {e}")
        return {}


def is_mostly_ascii(text: str) -> bool:
    if not text:
        return False
    ascii_count = sum(1 for c in text if ord(c) < 128)
    return (ascii_count / len(text)) > 0.75


def translate_en_to_ja(text: str) -> str:
    """英語テキストを日本語に無料API（MyMemory）で翻訳"""
    if not text or not is_mostly_ascii(text):
        return text
    try:
        truncated = text[:450].strip()
        url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(truncated)}&langpair=en|ja"
        r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            res = r.json()
            t = res.get("responseData", {}).get("translatedText", "")
            if t and not is_mostly_ascii(t):
                return t
    except Exception as e:
        pass
    return text


def fallback_summary(title: str, text: str, default_cat: str, is_foreign: bool) -> Dict[str, Any]:
    """Gemini APIキーがない場合、または失敗した場合の自動フォールバック翻訳"""
    cleaned = text if text else title
    sentences = re.split(r"[。！？.!?\n]", cleaned)
    bullets = [s.strip() for s in sentences if len(s.strip()) > 10][:3]
    if not bullets:
        bullets = [cleaned[:120] + "..." if len(cleaned) > 120 else cleaned]

    category = classify_category(title, text, default_cat)

    title_ja = title
    if is_foreign or is_mostly_ascii(title):
        print(f"  [Translate] Translating title: {title[:30]}...")
        title_ja = translate_en_to_ja(title)
        ja_bullets = []
        for b in bullets:
            print(f"  [Translate] Translating bullet: {b[:30]}...")
            tr = translate_en_to_ja(b)
            ja_bullets.append(tr)
            time.sleep(0.4)
        bullets = ja_bullets

    return {
        "title_ja": title_ja,
        "summary_bullets": bullets,
        "category": category
    }


def summarize_with_gemini(api_key: str, title: str, text: str, is_foreign: bool, default_cat: str) -> Dict[str, Any]:
    """Gemini API (無料枠) を使って自然な日本語タイトル、3行要約、新カテゴリ分類を生成"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    prompt = f"""あなたはGoogle Cloudのパートナー担当（Accenture, Deloitte, NRI等と協業するビジネスパーソン）を支援するプロのAIアナリストです。
以下の記事を分析し、日本のビジネスパーソンがスマホで30秒で理解できるよう要約してください。

【元記事情報】
海外記事フラグ: {"はい（必ず自然な魅力的な日本語タイトルに翻訳してください）" if is_foreign else "いいえ（国内記事）"}
タイトル: {title}
本文・概要: {text[:2500]}

【カテゴリ選択肢（この中から1つだけ選ぶ）】
- ✨ Gemini・Google AI (Gemini, Vertex AI, Google Workspace, DeepMind等)
- 🤖 他社LLM・フロンティア (OpenAI, Claude, DeepSeek, Llama, Copilot等)
- 🏢 パートナー・クラウド動向 (Accenture, Deloitte, NRI, クラウド協業, エンタープライズDX等)
- 🎨 画像・動画・マルチモーダル (画像/動画生成, 音声AI等)
- 🛠️ 活用ツール・エージェント (日常の業務ツール, 開発ツール等)

【出力フォーマット】
以下のJSONフォーマットのみを出力してください（Markdownコードブロックは不要）。
{{
  "title_ja": "自然でわかりやすい日本語タイトル（海外記事は日本語翻訳。国内記事は洗練された見出し）",
  "category": "上記5つのカテゴリから1つ",
  "summary_bullets": [
    "要点1（何が発表されたか・決定されたか）",
    "要点2（特徴・従来との違い・パートナーやエンタープライズへの影響）",
    "要点3（ビジネスや技術面での注目すべきインサイト）"
  ]
}}
"""

    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=25)
        if resp.status_code != 200:
            url_fb = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            resp = requests.post(url_fb, headers=headers, json=payload, timeout=25)
            if resp.status_code != 200:
                print(f"Gemini API Error ({resp.status_code})")
                return fallback_summary(title, text, default_cat, is_foreign)

        res_json = resp.json()
        raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        parsed = json.loads(raw_text.strip())
        cat = parsed.get("category", default_cat)
        if cat not in CATEGORIES:
            cat = classify_category(title, text, default_cat)

        bullets = parsed.get("summary_bullets", [])
        if not isinstance(bullets, list) or len(bullets) == 0:
            bullets = [parsed.get("title_ja", title)]

        return {
            "title_ja": parsed.get("title_ja", title),
            "summary_bullets": bullets[:3],
            "category": cat
        }
    except Exception as e:
        print(f"Failed to summarize with Gemini: {e}")
        return fallback_summary(title, text, default_cat, is_foreign)


def fetch_all_feeds() -> List[Dict[str, Any]]:
    """全フィードから記事を取得"""
    articles = []
    seen_urls = set()

    for feed_info in RSS_FEEDS:
        print(f"Fetching: {feed_info['name']} ...")
        try:
            resp = requests.get(
                feed_info["url"],
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
            )
            if resp.status_code != 200:
                print(f"  HTTP Error {resp.status_code}")
                continue

            feed = feedparser.parse(resp.content)
            count = 0

            for entry in feed.entries:
                url = getattr(entry, "link", "")
                if not url or url in seen_urls:
                    continue

                title = getattr(entry, "title", "").strip()
                if not title:
                    continue

                raw_summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
                cleaned_text = clean_html(raw_summary)

                # キーワードフィルター
                if "filter_keywords" in feed_info:
                    if not matches_filter(title, cleaned_text, feed_info["filter_keywords"]):
                        continue

                pub_date = parse_published_date(entry)
                now_utc = datetime.now(timezone.utc)
                # 過去7日以内
                if (now_utc - pub_date).days > 7:
                    continue

                article_id = generate_article_id(url, title)
                seen_urls.add(url)

                partner_tags = detect_partner_tags(title, cleaned_text)
                is_partner = len(partner_tags) > 0

                articles.append({
                    "id": article_id,
                    "title": title,
                    "url": url,
                    "source": feed_info["name"],
                    "source_lang": feed_info["lang"],
                    "is_foreign": feed_info.get("is_foreign", False),
                    "default_category": feed_info["default_category"],
                    "partner_tags": partner_tags,
                    "is_partner_related": is_partner,
                    "raw_text": cleaned_text,
                    "published_at": pub_date.isoformat(),
                    "published_display": pub_date.astimezone(JST).strftime("%Y/%m/%d %H:%M")
                })
                count += 1
                if count >= 8:
                    break

            print(f"  -> {count} articles fetched.")
        except Exception as e:
            print(f"  Error fetching feed: {e}")

    return articles


def main():
    print("=== AI News Fetcher & Summarizer (Business Edition) ===")
    os.makedirs(DATA_DIR, exist_ok=True)

    gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        print("[Info] GEMINI_API_KEY detected. AI 3-line summaries & translations active.")
    else:
        print("[Info] No GEMINI_API_KEY found. Running in fallback mode.")

    cached_articles = load_existing_cache()
    print(f"[Info] {len(cached_articles)} cached articles loaded.")

    raw_articles = fetch_all_feeds()
    print(f"[Info] Total fetched articles: {len(raw_articles)}")

    processed_articles = []

    for idx, item in enumerate(raw_articles):
        art_id = item["id"]

        # カテゴリの自動決定
        assigned_cat = classify_category(item["title"], item["raw_text"], item["default_category"])
        item["category"] = assigned_cat

        if art_id in cached_articles:
            cached = cached_articles[art_id]
            cached_bullets = cached.get("summary_bullets", [])
            # 海外記事で箇条書きが英語のままの場合は自動で日本語に再翻訳
            is_bullets_english = any(is_mostly_ascii(b) for b in cached_bullets)
            if item.get("is_foreign") and is_bullets_english:
                print(f"  [Re-translating English article] {item['title'][:30]}...")
                item["title_ja"] = translate_en_to_ja(cached.get("title_ja", item["title"]))
                ja_bullets = []
                for b in cached_bullets:
                    ja_bullets.append(translate_en_to_ja(b))
                    time.sleep(0.3)
                item["summary_bullets"] = ja_bullets
            else:
                item["title_ja"] = cached.get("title_ja", item["title"])
                item["summary_bullets"] = cached_bullets

            if cached.get("category") in CATEGORIES:
                item["category"] = cached["category"]
            processed_articles.append(item)
            continue

        print(f"[{idx+1}/{len(raw_articles)}] Processing: {item['title'][:35]}...")

        if gemini_api_key:
            res = summarize_with_gemini(
                api_key=gemini_api_key,
                title=item["title"],
                text=item["raw_text"],
                is_foreign=item["is_foreign"],
                default_cat=assigned_cat
            )
            time.sleep(4.2)
        else:
            res = fallback_summary(
                title=item["title"],
                text=item["raw_text"],
                default_cat=assigned_cat,
                is_foreign=item["is_foreign"]
            )

        item["title_ja"] = res["title_ja"]
        item["summary_bullets"] = res["summary_bullets"]
        item["category"] = res["category"]
        processed_articles.append(item)

    # 公開日時順にソート
    processed_articles.sort(key=lambda x: x["published_at"], reverse=True)

    clean_output_articles = []
    for a in processed_articles[:65]:  # 最大65件
        clean_output_articles.append({
            "id": a["id"],
            "title": a["title"],
            "title_ja": a.get("title_ja", a["title"]),
            "url": a["url"],
            "source": a["source"],
            "source_lang": a["source_lang"],
            "is_foreign": a.get("is_foreign", False),
            "category": a.get("category", "✨ Gemini・Google AI"),
            "partner_tags": a.get("partner_tags", []),
            "is_partner_related": a.get("is_partner_related", False),
            "summary_bullets": a.get("summary_bullets", []),
            "published_at": a["published_at"],
            "published_display": a["published_display"]
        })

    output_data = {
        "updated_at": datetime.now(JST).strftime("%Y/%m/%d %H:%M (JST)"),
        "total_count": len(clean_output_articles),
        "articles": clean_output_articles
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"=== Successfully saved {len(clean_output_articles)} articles to {OUTPUT_FILE} ===")


if __name__ == "__main__":
    main()
