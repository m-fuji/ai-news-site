/**
 * AI Daily Pulse - Client Application
 */

const STATE = {
  articles: [],
  filteredArticles: [],
  currentCategory: 'ALL',
  searchQuery: '',
  currentView: 'feed', // 'feed' or 'bookmarks'
  bookmarks: JSON.parse(localStorage.getItem('ai_news_bookmarks') || '[]'),
};

// DOM Elements
const newsContainer = document.getElementById('news-container');
const emptyState = document.getElementById('empty-state');
const currentCountEl = document.getElementById('current-count');
const countAllEl = document.getElementById('count-all');
const updatedAtEl = document.getElementById('updated-at');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const categoryBtns = document.querySelectorAll('.category-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');
const refreshBtn = document.getElementById('refresh-btn');
const toastEl = document.getElementById('toast');
const pwaBanner = document.getElementById('pwa-banner');
const pwaDismiss = document.getElementById('pwa-dismiss');
const bookmarkBadge = document.getElementById('bookmark-badge');

// Navigation
const navFeed = document.getElementById('nav-feed');
const navBookmarks = document.getElementById('nav-bookmarks');
const navAbout = document.getElementById('nav-about');
const aboutModal = document.getElementById('about-modal');
const closeAboutModal = document.getElementById('close-about-modal');
const closeAboutBtn = document.getElementById('close-about-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPwa();
  setupEventListeners();
  loadNewsData();
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
    themeIconSun.classList.remove('hidden');
    themeIconMoon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    themeIconSun.classList.add('hidden');
    themeIconMoon.classList.remove('hidden');
  }
}

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeIconSun.classList.toggle('hidden', !isDark);
  themeIconMoon.classList.toggle('hidden', isDark);
});

// --- Toast Notification ---
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('opacity-0', 'pointer-events-none');
  setTimeout(() => {
    toastEl.classList.add('opacity-0', 'pointer-events-none');
  }, 2200);
}

// --- Fetch News Data ---
async function loadNewsData() {
  newsContainer.innerHTML = `
    <div class="animate-pulse space-y-4">
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800">
        <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-3"></div>
        <div class="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-3"></div>
        <div class="space-y-2">
          <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`data/news.json?t=${new Date().getTime()}`);
    if (!res.ok) throw new Error('News data not found');
    const data = await res.json();

    STATE.articles = data.articles || [];
    updatedAtEl.textContent = `最終更新: ${data.updated_at || '今朝'}`;
    countAllEl.textContent = STATE.articles.length;

    updateBookmarkBadge();
    applyFilterAndRender();
  } catch (err) {
    console.error('Failed to load news:', err);
    newsContainer.innerHTML = `
      <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-center">
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">ニュースデータを読み込めませんでした</p>
        <p class="text-xs text-amber-600 dark:text-amber-400 mb-3">スクリプトの実行前か、データがまだありません。</p>
        <button onclick="loadNewsData()" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium">再試行</button>
      </div>
    `;
  }
}

// --- Filter and Render ---
function applyFilterAndRender() {
  let list = STATE.currentView === 'bookmarks'
    ? STATE.articles.filter(a => STATE.bookmarks.includes(a.id))
    : STATE.articles;

  // Category Filter
  if (STATE.currentCategory !== 'ALL') {
    list = list.filter(a => a.category === STATE.currentCategory);
  }

  // Keyword Search
  if (STATE.searchQuery.trim() !== '') {
    const query = STATE.searchQuery.toLowerCase();
    list = list.filter(a => {
      const matchTitle = (a.title_ja || a.title || '').toLowerCase().includes(query);
      const matchSource = (a.source || '').toLowerCase().includes(query);
      const matchBullets = (a.summary_bullets || []).some(b => b.toLowerCase().includes(query));
      return matchTitle || matchSource || matchBullets;
    });
  }

  STATE.filteredArticles = list;
  currentCountEl.textContent = list.length;

  if (list.length === 0) {
    newsContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    renderArticles(list);
  }
}

function getCategoryColorClass(category) {
  switch (category) {
    case 'LLM・対話AI':
      return 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
    case '画像・動画・音声':
      return 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/40';
    case 'ツール・活用':
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
    case 'ビジネス・社会':
      return 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
    case '研究・テクノロジー':
      return 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

function timeAgo(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    if (diffHours < 1) return '数十分前';
    if (diffHours < 24) return `${diffHours}時間前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  } catch (e) {
    return '最近';
  }
}

function renderArticles(articles) {
  newsContainer.innerHTML = articles.map(art => {
    const isBookmarked = STATE.bookmarks.includes(art.id);
    const displayTitle = art.title_ja || art.title;
    const catClass = getCategoryColorClass(art.category);
    const timeDisplay = timeAgo(art.published_at);

    const bulletsHtml = (art.summary_bullets && art.summary_bullets.length > 0)
      ? `
        <div class="mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800/80">
          <p class="text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase mb-1.5 flex items-center">
            <span class="mr-1">🤖</span> 3行要点まとめ
          </p>
          <ul class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            ${art.summary_bullets.map(b => `<li class="flex items-start"><span class="text-indigo-500 mr-1.5 font-bold">•</span><span>${b}</span></li>`).join('')}
          </ul>
        </div>
      ` : '';

    return `
      <article class="article-card bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/90 shadow-sm shadow-slate-200/50 dark:shadow-none relative">
        <!-- Top Meta: Source, Date, Category -->
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center space-x-1.5 overflow-hidden">
            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-md border ${catClass}">
              ${art.category || 'AIニュース'}
            </span>
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              ${art.source}
            </span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            ${timeDisplay}
          </span>
        </div>

        <!-- Title -->
        <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
          <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            ${displayTitle}
          </a>
        </h2>

        ${art.source_lang === 'en' && art.title_ja && art.title !== art.title_ja ? `
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1 italic">
            原文: ${art.title}
          </p>
        ` : ''}

        <!-- 3-Bullet Summary -->
        ${bulletsHtml}

        <!-- Bottom Action Bar -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
            <span>記事を読む</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>

          <div class="flex items-center space-x-2">
            <!-- Share Button -->
            <button onclick="shareArticle('${encodeURIComponent(displayTitle)}', '${encodeURIComponent(art.url)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="シェア">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            </button>

            <!-- Bookmark Button -->
            <button onclick="toggleBookmark('${art.id}')" class="p-1.5 rounded-lg transition-colors ${isBookmarked ? 'text-pink-500' : 'text-slate-400 hover:text-pink-500'}" title="${isBookmarked ? '保存解除' : 'ブックマーク'}">
              <svg class="w-4 h-4 ${isBookmarked ? 'fill-current' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// --- Bookmarking Logic ---
window.toggleBookmark = function(articleId) {
  const index = STATE.bookmarks.indexOf(articleId);
  if (index > -1) {
    STATE.bookmarks.splice(index, 1);
    showToast('ブックマークから削除しました');
  } else {
    STATE.bookmarks.push(articleId);
    showToast('ブックマークに保存しました');
  }
  localStorage.setItem('ai_news_bookmarks', JSON.stringify(STATE.bookmarks));
  updateBookmarkBadge();
  applyFilterAndRender();
};

function updateBookmarkBadge() {
  if (STATE.bookmarks.length > 0) {
    bookmarkBadge.classList.remove('hidden');
  } else {
    bookmarkBadge.classList.add('hidden');
  }
}

// --- Share Logic ---
window.shareArticle = function(title, url) {
  const decodedTitle = decodeURIComponent(title);
  const decodedUrl = decodeURIComponent(url);

  if (navigator.share) {
    navigator.share({
      title: decodedTitle,
      text: `${decodedTitle} | AI Daily Pulse`,
      url: decodedUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${decodedTitle}\n${decodedUrl}`).then(() => {
      showToast('リンクをコピーしました');
    });
  }
};

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Category Buttons
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentCategory = btn.dataset.category;
      applyFilterAndRender();
    });
  });

  // Search Input
  searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    clearSearchBtn.classList.toggle('hidden', !STATE.searchQuery);
    applyFilterAndRender();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    STATE.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    applyFilterAndRender();
  });

  // Reset Filter Button
  document.getElementById('reset-filter-btn').addEventListener('click', () => {
    searchInput.value = '';
    STATE.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    STATE.currentCategory = 'ALL';
    categoryBtns.forEach(b => b.classList.toggle('active', b.dataset.category === 'ALL'));
    applyFilterAndRender();
  });

  // Refresh Button
  refreshBtn.addEventListener('click', () => {
    showToast('最新データを取得中...');
    loadNewsData();
  });

  // Navigation Switching
  navFeed.addEventListener('click', () => {
    switchView('feed');
  });

  navBookmarks.addEventListener('click', () => {
    switchView('bookmarks');
  });

  // About Modal
  navAbout.addEventListener('click', () => {
    aboutModal.classList.remove('hidden');
  });
  closeAboutModal.addEventListener('click', () => {
    aboutModal.classList.add('hidden');
  });
  closeAboutBtn.addEventListener('click', () => {
    aboutModal.classList.add('hidden');
  });
}

function switchView(view) {
  STATE.currentView = view;
  if (view === 'feed') {
    navFeed.classList.add('active');
    navBookmarks.classList.remove('active');
  } else {
    navBookmarks.classList.add('active');
    navFeed.classList.remove('active');
  }
  applyFilterAndRender();
}

// --- PWA Helper ---
function initPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  }

  // Show banner if on mobile iOS/Android and not standalone
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  
  if (isIos && !isStandalone && !sessionStorage.getItem('pwa_banner_dismissed')) {
    pwaBanner.classList.remove('hidden');
  }

  pwaDismiss.addEventListener('click', () => {
    pwaBanner.classList.add('hidden');
    sessionStorage.setItem('pwa_banner_dismissed', '1');
  });
}
