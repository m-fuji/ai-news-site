/**
 * AI Daily Pulse - Client Application (Business Edition)
 * 未読・既読管理、海外記事の日本語翻訳・🌐アイコン、Google Cloud＆パートナー動向対応
 */

// Target Hash for "0310" (SHA-256)
const CORRECT_PIN_HASH = '408a5ee676694af19215cb22b2cd871e39c693f907933583ece00eda8d73ee16';

const STATE = {
  articles: [],
  filteredArticles: [],
  currentCategory: 'ALL',
  searchQuery: '',
  currentView: 'feed', // 'feed' or 'bookmarks'
  bookmarks: JSON.parse(localStorage.getItem('ai_news_bookmarks') || '[]'),
  readArticles: JSON.parse(localStorage.getItem('ai_news_read_articles') || '[]'),
  isFilterUnreadOnly: false,
  enteredPin: '',
  isUnlocked: false,
};

// DOM Elements - Auth
const lockScreen = document.getElementById('lock-screen');
const appContent = document.getElementById('app-content');
const pinDots = document.querySelectorAll('.pin-dot');
const pinDotsContainer = document.getElementById('pin-dots');
const pinError = document.getElementById('pin-error');
const rememberMeCheckbox = document.getElementById('remember-me');
const keypadBtns = document.querySelectorAll('.keypad-btn');
const keypadDelBtn = document.getElementById('keypad-del');
const lockBtn = document.getElementById('lock-btn');

// DOM Elements - Main App
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

// Unread Controls
const toggleUnreadFilterBtn = document.getElementById('toggle-unread-filter');
const unreadCountBadge = document.getElementById('unread-count-badge');
const unreadFilterLabel = document.getElementById('unread-filter-label');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

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
  initAuth();
});

// --- Authentication / PIN Code Logic ---
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function initAuth() {
  const isSavedLocal = localStorage.getItem('ai_pulse_unlocked') === CORRECT_PIN_HASH;
  const isSavedSession = sessionStorage.getItem('ai_pulse_unlocked') === CORRECT_PIN_HASH;

  if (isSavedLocal || isSavedSession) {
    unlockApp(false);
  } else {
    setupKeypad();
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      lockApp();
    });
  }
}

function setupKeypad() {
  keypadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      handlePinInput(btn.dataset.val);
    });
  });

  keypadDelBtn.addEventListener('click', () => {
    handlePinDelete();
  });

  window.addEventListener('keydown', (e) => {
    if (STATE.isUnlocked) return;
    if (/^[0-9]$/.test(e.key)) {
      handlePinInput(e.key);
    } else if (e.key === 'Backspace') {
      handlePinDelete();
    }
  });
}

function handlePinInput(digit) {
  if (STATE.enteredPin.length >= 4) return;
  STATE.enteredPin += digit;
  updatePinDots();

  if (STATE.enteredPin.length === 4) {
    validatePin();
  }
}

function handlePinDelete() {
  if (STATE.enteredPin.length === 0) return;
  STATE.enteredPin = STATE.enteredPin.slice(0, -1);
  pinError.classList.add('opacity-0');
  updatePinDots();
}

function updatePinDots() {
  pinDots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < STATE.enteredPin.length);
  });
}

async function validatePin() {
  const hash = await sha256(STATE.enteredPin);
  if (hash === CORRECT_PIN_HASH) {
    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
      localStorage.setItem('ai_pulse_unlocked', CORRECT_PIN_HASH);
    } else {
      sessionStorage.setItem('ai_pulse_unlocked', CORRECT_PIN_HASH);
    }
    unlockApp(true);
  } else {
    pinError.classList.remove('opacity-0');
    pinDotsContainer.classList.add('shake');
    setTimeout(() => {
      pinDotsContainer.classList.remove('shake');
      STATE.enteredPin = '';
      updatePinDots();
    }, 450);
  }
}

function unlockApp(showToastNotice = true) {
  STATE.isUnlocked = true;
  lockScreen.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => {
    lockScreen.classList.add('hidden');
  }, 300);
  appContent.classList.remove('hidden');

  initPwa();
  setupEventListeners();
  loadNewsData();

  if (showToastNotice) {
    showToast('ロックを解除しました');
  }
}

function lockApp() {
  localStorage.removeItem('ai_pulse_unlocked');
  sessionStorage.removeItem('ai_pulse_unlocked');
  STATE.isUnlocked = false;
  STATE.enteredPin = '';
  updatePinDots();
  pinError.classList.add('opacity-0');

  appContent.classList.add('hidden');
  lockScreen.classList.remove('hidden', 'pointer-events-none');
  setTimeout(() => {
    lockScreen.classList.remove('opacity-0');
  }, 50);

  showToast('ロックしました');
}

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
    updatedAtEl.textContent = `更新日時: ${data.updated_at || '本日'}`;
    countAllEl.textContent = STATE.articles.length;

    updateBookmarkBadge();
    updateUnreadBadge();
    applyFilterAndRender();
  } catch (err) {
    console.error('Failed to load news:', err);
    newsContainer.innerHTML = `
      <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-center">
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">ニュースデータを読み込めませんでした</p>
        <p class="text-xs text-amber-600 dark:text-amber-400 mb-3">再読み込みをお試しください。</p>
        <button onclick="loadNewsData()" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium">再試行</button>
      </div>
    `;
  }
}

// --- Read / Unread Management ---
function isArticleRead(id) {
  return STATE.readArticles.includes(id);
}

window.markAsRead = function(id, silent = false) {
  if (!STATE.readArticles.includes(id)) {
    STATE.readArticles.push(id);
    localStorage.setItem('ai_news_read_articles', JSON.stringify(STATE.readArticles));
    updateUnreadBadge();
    if (!silent) {
      applyFilterAndRender();
    }
  }
};

window.toggleReadStatus = function(id, event) {
  if (event) event.stopPropagation();
  const idx = STATE.readArticles.indexOf(id);
  if (idx > -1) {
    STATE.readArticles.splice(idx, 1);
    showToast('未読に戻しました');
  } else {
    STATE.readArticles.push(id);
    showToast('既読にしました');
  }
  localStorage.setItem('ai_news_read_articles', JSON.stringify(STATE.readArticles));
  updateUnreadBadge();
  applyFilterAndRender();
};

function updateUnreadBadge() {
  const unreadCount = STATE.articles.filter(a => !isArticleRead(a.id)).length;
  if (unreadCountBadge) {
    unreadCountBadge.textContent = unreadCount;
  }
}

// --- Filter and Render ---
function applyFilterAndRender() {
  let list = STATE.currentView === 'bookmarks'
    ? STATE.articles.filter(a => STATE.bookmarks.includes(a.id))
    : STATE.articles;

  // Unread Only Filter
  if (STATE.isFilterUnreadOnly) {
    list = list.filter(a => !isArticleRead(a.id));
  }

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
      const matchTags = (a.partner_tags || []).some(t => t.toLowerCase().includes(query));
      return matchTitle || matchSource || matchBullets || matchTags;
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
    case '✨ Gemini・Google AI':
      return 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
    case '🤖 他社LLM・フロンティア':
      return 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
    case '🏢 パートナー・クラウド動向':
      return 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50';
    case '🎨 画像・動画・マルチモーダル':
      return 'bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50';
    case '🛠️ 活用ツール・エージェント':
      return 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
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
    const isRead = isArticleRead(art.id);
    const displayTitle = art.title_ja || art.title;
    const catClass = getCategoryColorClass(art.category);
    const timeDisplay = timeAgo(art.published_at);
    const isForeign = art.is_foreign || art.source_lang === 'en';

    // Partner Tags (Accenture, Deloitte, NRI, Google Cloud)
    const partnerTagsHtml = (art.partner_tags && art.partner_tags.length > 0)
      ? art.partner_tags.map(tag => `
          <span class="px-1.5 py-0.5 text-[10px] font-bold rounded partner-badge">
            🏢 ${tag}
          </span>
        `).join('')
      : '';

    // 3-Bullet Summary
    const bulletsHtml = (art.summary_bullets && art.summary_bullets.length > 0)
      ? `
        <div class="mt-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800/80">
          <p class="text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase mb-1.5 flex items-center">
            <span class="mr-1">🤖</span> 3行要点まとめ
          </p>
          <ul class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            ${art.summary_bullets.map(b => `<li class="flex items-start"><span class="text-indigo-500 mr-1.5 font-bold">•</span><span>${b}</span></li>`).join('')}
          </ul>
        </div>
      ` : '';

    return `
      <article class="article-card ${isRead ? 'is-read' : ''} bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/90 shadow-sm shadow-slate-200/40 dark:shadow-none relative">
        
        <!-- Top Meta: Badges, Source, Time, Read Status -->
        <div class="flex items-center justify-between gap-1.5 mb-2.5">
          <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
            <!-- Unread / Read Indicator -->
            ${!isRead ? `
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white animate-pulse">
                ● 未読
              </span>
            ` : `
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                ✓ 既読
              </span>
            `}

            <!-- Foreign Badge -->
            ${isForeign ? `
              <span class="px-1.5 py-0.5 text-[10px] font-bold rounded foreign-badge">
                🌐 海外
              </span>
            ` : ''}

            <!-- Category Badge -->
            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-md border ${catClass}">
              ${art.category || 'AIニュース'}
            </span>

            <!-- Partner Tags -->
            ${partnerTagsHtml}
          </div>

          <span class="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            ${timeDisplay}
          </span>
        </div>

        <!-- Title (Japanese Main) -->
        <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
          <a href="${art.url}" target="_blank" rel="noopener noreferrer" onclick="markAsRead('${art.id}', true)" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            ${displayTitle}
          </a>
        </h2>

        <!-- Original English Title for Foreign News -->
        ${isForeign && art.title && art.title !== displayTitle ? `
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1 italic">
            🌐 原文: ${art.title}
          </p>
        ` : ''}

        <!-- Media Source -->
        <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
          配信元: <span class="text-slate-600 dark:text-slate-300">${art.source}</span>
        </p>

        <!-- 3-Bullet Summary -->
        ${bulletsHtml}

        <!-- Bottom Action Bar -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <a href="${art.url}" target="_blank" rel="noopener noreferrer" onclick="markAsRead('${art.id}', true)" class="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
            <span>記事を読む</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>

          <div class="flex items-center space-x-1">
            <!-- Read / Unread Manual Toggle -->
            <button onclick="toggleReadStatus('${art.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="${isRead ? '未読に戻す' : '既読にする'}">
              <svg class="w-4 h-4 ${isRead ? 'text-blue-500 dark:text-blue-400' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

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

  // Unread Toggle Button
  if (toggleUnreadFilterBtn) {
    toggleUnreadFilterBtn.addEventListener('click', () => {
      STATE.isFilterUnreadOnly = !STATE.isFilterUnreadOnly;
      if (STATE.isFilterUnreadOnly) {
        toggleUnreadFilterBtn.classList.add('bg-blue-600', 'text-white');
        toggleUnreadFilterBtn.classList.remove('bg-slate-200/70', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
        unreadFilterLabel.textContent = '未読中';
        showToast('未読記事のみ表示しています');
      } else {
        toggleUnreadFilterBtn.classList.remove('bg-blue-600', 'text-white');
        toggleUnreadFilterBtn.classList.add('bg-slate-200/70', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
        unreadFilterLabel.textContent = '未読のみ';
      }
      applyFilterAndRender();
    });
  }

  // Mark All As Read
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', () => {
      STATE.articles.forEach(a => {
        if (!STATE.readArticles.includes(a.id)) {
          STATE.readArticles.push(a.id);
        }
      });
      localStorage.setItem('ai_news_read_articles', JSON.stringify(STATE.readArticles));
      updateUnreadBadge();
      applyFilterAndRender();
      showToast('すべての記事を既読にしました');
    });
  }

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

  document.getElementById('reset-filter-btn').addEventListener('click', () => {
    searchInput.value = '';
    STATE.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    STATE.currentCategory = 'ALL';
    STATE.isFilterUnreadOnly = false;
    if (toggleUnreadFilterBtn) {
      toggleUnreadFilterBtn.classList.remove('bg-blue-600', 'text-white');
      toggleUnreadFilterBtn.classList.add('bg-slate-200/70', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
      unreadFilterLabel.textContent = '未読のみ';
    }
    categoryBtns.forEach(b => b.classList.toggle('active', b.dataset.category === 'ALL'));
    applyFilterAndRender();
  });

  refreshBtn.addEventListener('click', () => {
    showToast('最新データを取得中...');
    loadNewsData();
  });

  navFeed.addEventListener('click', () => {
    switchView('feed');
  });

  navBookmarks.addEventListener('click', () => {
    switchView('bookmarks');
  });

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
