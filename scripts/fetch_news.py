#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIニュース自動収集・要約スクリプト
RSSフィードから最新のAI関連ニュースを収集し、Gemini API（無料枠）で日本語3行要約・分類を行います。
APIキーがない場合でも自動フォールバックで動作します。
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
import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

# 日本標準時 (JST)
JST = timezone(timedelta(hours=9))

# データ保存先パス
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "news.json")

# 巡回するRSSフィードの定義
RSS_FEEDS = [
    # 国内AIニュース
    {
        "name": "ITmedia AI+",
        "url": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
        "lang": "ja",
        "default_category": "ビジネス・社会"
    },
    {
        "name": "はてなブックマーク (AI人気)",
        "url": "https://b.hatena.ne.jp/q/AI?sort=hot&target=title&mode=rss",
        "lang": "ja",
        "default_category": "ツール・活用"
    },
    {
        "name": "GIGAZINE (AIタグ)",
        "url": "https://gigazine.net/news/rss_2.0/",
        "lang": "ja",
        "filter_ai": True,  # タイトルにAI関連語を含むものだけ抽出
        "default_category": "研究・テクノロジー"
    },
    # 海外公式・先端AIメディア
    {
        "name": "OpenAI Blog",
        "url": "https://openai.com/news/rss.xml",
        "lang": "en",
        "default_category": "LLM・対話AI"
    },
    {
        "name": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "lang": "en",
        "default_category": "研究・テクノロジー"
    },
    {
        "name": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "lang": "en",
        "default_category": "ビジネス・社会"
    },
    {
        "name": "MIT Technology Review (AI)",
        "url": "https://www.technologyreview.com/topic/artificial-intelligence/feed",
        "lang": "en",
        "default_category": "研究・テクノロジー"
    }
]

AI_KEYWORDS = [
    "ai", "人工知能", "gpt", "llm", "claude", "gemini", "openai", "deepseek",
    "機械学習", "ディープラーニング", "generative", "生成ai", "copilot", "agent",
    "nvidia", "anthropic", "diffusion", "rag", "chatgpt"
]

CATEGORIES = [
    "LLM・対話AI",
    "画像・動画・音声",
    "ツール・活用",
    "ビジネス・社会",
    "研究・テクノロジー"
]


def clean_html(raw_html: str) -> str:
    """HTMLタグを除去してプレーンテキストにする"""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_ai_relevant(title: str, summary: str) -> bool:
    """タイトルや概要にAI関連のキーワードが含まれているかチェック"""
    text = (title + " " + summary).lower()
    return any(keyword in text for keyword in AI_KEYWORDS)


def parse_published_date(entry: Any) -> datetime:
    """RSSエントリから公開日時を抽出し、UTC日時に変換"""
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
    """URLやタイトルから一意のハッシュIDを生成"""
    raw = f"{url}_{title}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def load_existing_cache() -> Dict[str, Dict[str, Any]]:
    """既存の news.json を読み込み、すでに要約済みの記事をキャッシュとして保持"""
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


def fallback_summary(title: str, text: str, default_cat: str) -> Dict[str, Any]:
    """Gemini APIキーがない場合、または失敗した場合の自動フォールバック"""
    cleaned = text if text else title
    sentences = re.split(r"[。！？.!?\n]", cleaned)
    bullets = [s.strip() for s in sentences if len(s.strip()) > 10][:3]
    if not bullets:
        bullets = [cleaned[:100] + "..." if len(cleaned) > 100 else cleaned]

    category = default_cat
    t_lower = (title + " " + text).lower()
    if any(k in t_lower for k in ["gpt", "claude", "gemini", "llm", "chatgpt", "deepseek"]):
        category = "LLM・対話AI"
    elif any(k in t_lower for k in ["image", "video", "画像", "動画", "音声", "midjourney", "sora"]):
        category = "画像・動画・音声"
    elif any(k in t_lower for k in ["tool", "app", "サービス", "アプリ", "拡張", "活用"]):
        category = "ツール・活用"
    elif any(k in t_lower for k in ["research", "paper", "論文", "モデル", "アルゴリズム"]):
        category = "研究・テクノロジー"

    return {
        "title_ja": title,
        "summary_bullets": bullets,
        "category": category
    }


def summarize_with_gemini(api_key: str, title: str, text: str, source_lang: str, default_cat: str) -> Dict[str, Any]:
    """Gemini API (無料枠) を呼び出して日本語3行要約とカテゴリ分類を実施"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    prompt = f"""以下のAI関連記事を分析し、日本のビジネスパーソンや技術者がスマホで30秒で理解できるように要約してください。

【タイトル】
{title}

【本文・概要】
{text[:2500]}

【出力フォーマット】
以下のJSONフォーマットのみを出力してください（Markdownコードブロック ```json ``` などの修飾は不要です）。
{{
  "title_ja": "魅力的な日本語タイトル（元のタイトルが英語の場合は自然な日本語訳。元が日本語なら洗練したタイトル）",
  "category": "{' / '.join(CATEGORIES)} のいずれか1つ",
  "summary_bullets": [
    "要点1（簡潔に何が起きたか・発表されたか）",
    "要点2（特徴や従来との違い・具体的な数値など）",
    "要点3（どのような影響があるか・注目ポイント）"
  ]
}}
"""

    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=25)
        if resp.status_code != 200:
            # もし2.0-flashがエラーの場合は1.5-flashを試す
            url_fallback = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            resp = requests.post(url_fallback, headers=headers, json=payload, timeout=25)
            if resp.status_code != 200:
                print(f"Gemini API Error ({resp.status_code}): {resp.text[:120]}")
                return fallback_summary(title, text, default_cat)

        res_json = resp.json()
        raw_content = res_json["candidates"][0]["content"]["parts"][0]["text"]
        # JSONパース
        clean_json_str = raw_content.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.startswith("```"):
            clean_json_str = clean_json_str[3:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        
        parsed = json.loads(clean_json_str.strip())
        
        # 検証・補正
        category = parsed.get("category", default_cat)
        if category not in CATEGORIES:
            category = default_cat
        
        bullets = parsed.get("summary_bullets", [])
        if not isinstance(bullets, list) or len(bullets) == 0:
            bullets = [parsed.get("title_ja", title)]

        return {
            "title_ja": parsed.get("title_ja", title),
            "summary_bullets": bullets[:3],
            "category": category
        }
    except Exception as e:
        print(f"Failed to summarize with Gemini: {e}")
        return fallback_summary(title, text, default_cat)


def fetch_all_feeds() -> List[Dict[str, Any]]:
    """全RSSフィードから記事を取得"""
    articles = []
    seen_urls = set()

    for feed_info in RSS_FEEDS:
        print(f"Fetching: {feed_info['name']} ({feed_info['url']}) ...")
        try:
            # タイムアウト付きでフィードを取得
            resp = requests.get(feed_info["url"], timeout=15, headers={"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"})
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

                # フィルターが必要なメディアの場合
                if feed_info.get("filter_ai") and not is_ai_relevant(title, cleaned_text):
                    continue

                pub_date = parse_published_date(entry)
                
                # 古すぎる記事（7日以上前）は除外
                now_utc = datetime.now(timezone.utc)
                if (now_utc - pub_date).days > 7:
                    continue

                article_id = generate_article_id(url, title)
                seen_urls.add(url)

                articles.append({
                    "id": article_id,
                    "title": title,
                    "url": url,
                    "source": feed_info["name"],
                    "source_lang": feed_info["lang"],
                    "default_category": feed_info["default_category"],
                    "raw_text": cleaned_text,
                    "published_at": pub_date.isoformat(),
                    "published_display": pub_date.astimezone(JST).strftime("%Y/%m/%d %H:%M")
                })
                count += 1
                if count >= 8:  # 各メディアから最大8件
                    break

            print(f"  -> {count} articles fetched.")
        except Exception as e:
            print(f"  Error fetching feed: {e}")

    return articles


def main():
    print("=== AI News Fetcher & Summarizer ===")
    os.makedirs(DATA_DIR, exist_ok=True)

    gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        print("[Info] GEMINI_API_KEY detected. AI 3-line summaries will be generated.")
    else:
        print("[Info] No GEMINI_API_KEY found. Running in fallback mode (extracting excerpts).")

    cached_articles = load_existing_cache()
    print(f"[Info] {len(cached_articles)} cached articles loaded.")

    raw_articles = fetch_all_feeds()
    print(f"[Info] Total fetched articles: {len(raw_articles)}")

    processed_articles = []
    summarized_count = 0

    for idx, item in enumerate(raw_articles):
        art_id = item["id"]

        # キャッシュがあればそれを利用（API消費削減）
        if art_id in cached_articles:
            cached = cached_articles[art_id]
            # 最新のURLやメタ情報は更新しつつ要約結果を再利用
            item["title_ja"] = cached.get("title_ja", item["title"])
            item["summary_bullets"] = cached.get("summary_bullets", [])
            item["category"] = cached.get("category", item["default_category"])
            processed_articles.append(item)
            continue

        print(f"[{idx+1}/{len(raw_articles)}] Summarizing: {item['title'][:40]}...")

        if gemini_api_key:
            res = summarize_with_gemini(
                api_key=gemini_api_key,
                title=item["title"],
                text=item["raw_text"],
                source_lang=item["source_lang"],
                default_cat=item["default_category"]
            )
            summarized_count += 1
            # 無料枠のレートリミット（15 RPM）を守るため間隔を空ける
            time.sleep(4.2)
        else:
            res = fallback_summary(
                title=item["title"],
                text=item["raw_text"],
                default_cat=item["default_category"]
            )

        item["title_ja"] = res["title_ja"]
        item["summary_bullets"] = res["summary_bullets"]
        item["category"] = res["category"]
        processed_articles.append(item)

    # 公開日時順（新しい順）にソート
    processed_articles.sort(key=lambda x: x["published_at"], reverse=True)

    # raw_text など巨大な生テキストは出力から省いて軽量化
    clean_output_articles = []
    for a in processed_articles[:50]:  # 最新50件
        clean_output_articles.append({
            "id": a["id"],
            "title": a["title"],
            "title_ja": a.get("title_ja", a["title"]),
            "url": a["url"],
            "source": a["source"],
            "source_lang": a["source_lang"],
            "category": a.get("category", "ツール・活用"),
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
