const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQFB9Oo2EhWm2QUQq-mOdNuYQTswwbyQ3Qt8CkHGLL33uSBm49Snp7IlugyYkuIp3ZmdYCm2WUkb3/pub?output=csv';
const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSesYIiGj31EF4-7wD03_QB-5gWAsLck6FYUQu4qVk50KbZc-Q/viewform';

let allData = [];
let pendingSearch = null;

document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Smooth scroll for hero CTA button
  const heroCta = document.querySelector('.cta-primary-hero');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('featured');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Check URL params for ?company=XXX deep link
  const urlParams = new URLSearchParams(window.location.search);
  const companyParam = urlParams.get('company');
  if (companyParam) {
    pendingSearch = companyParam;
  }

  // Back to top button
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }, { passive: true });
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.getElementById('searchBtn').addEventListener('click', doSearch);
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // Live search suggestions
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    const sugBox = document.getElementById('searchSuggestions');
    if (!query || query.length < 1) {
      sugBox.innerHTML = '';
      sugBox.style.display = 'none';
      return;
    }
    const companies = getUniqueCompanies();
    const matches = companies.filter(([name]) =>
      name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    if (matches.length === 0) {
      sugBox.innerHTML = '';
      sugBox.style.display = 'none';
      return;
    }
    sugBox.style.display = 'block';
    sugBox.innerHTML = matches.map(([name, count]) =>
      `<div class="suggestion-item" onclick="searchCompany('${escapeAttr(name)}')">${escapeHTML(name)} <span class="suggestion-count">(${count} 筆)</span></div>`
    ).join('');
  });

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      const sugBox = document.getElementById('searchSuggestions');
      sugBox.innerHTML = '';
      sugBox.style.display = 'none';
    }
  });
});

async function loadData() {
  document.getElementById('results').innerHTML = '<div class="loading">載入資料中<span class="loading-dots"><span></span><span></span><span></span></span></div>';

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    allData = parseCSV(text);

    const companies = getUniqueCompanies();

    // Hero stats with count-up animation
    animateCountUp(document.getElementById('heroReviewCount'), allData.length);
    animateCountUp(document.getElementById('heroCompanyCount'), companies.length);
    const lastDate = allData.length > 0 ? allData[allData.length - 1].timestamp.split(' ')[0] : '';
    document.getElementById('heroUpdateDate').textContent = lastDate || '今天';

    // Render sections
    document.getElementById('results').innerHTML = '';
    renderFeatured();
    renderLatest();
    renderCharts();
    renderCompanyList(companies);

    // Auto-search if deep link ?company=XXX
    if (pendingSearch) {
      document.getElementById('searchInput').value = pendingSearch;
      pendingSearch = null;
      doSearch();
      setTimeout(() => {
        document.getElementById('searchArea').scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  } catch (err) {
    document.getElementById('results').innerHTML =
      '<div class="loading">資料載入失敗，請重新整理頁面</div>';
  }
}

// ===========================
// Featured Reviews (best content)
// ===========================
function renderFeatured() {
  const featured = allData
    .filter(d => d.honestWord && d.honestWord.trim() && d.honestWord.trim() !== '無' && d.honestWord.trim().length > 15)
    .sort((a, b) => b.honestWord.length - a.honestWord.length)
    .slice(0, 3);

  if (featured.length === 0) return;

  const container = document.getElementById('results');
  container.innerHTML = '<h2 class="section-title">真實分享長這樣</h2>';
  featured.forEach(d => {
    container.innerHTML += createCard(d);
  });
}

// ===========================
// Latest Reviews (newest 5)
// ===========================
function renderLatest() {
  const container = document.getElementById('latestReviews');
  const latest = allData.slice(-5).reverse();

  if (latest.length === 0) {
    container.innerHTML = '<div class="loading">暫無資料</div>';
    return;
  }

  latest.forEach(d => {
    container.innerHTML += createCard(d);
  });
}

// ===========================
// Data Charts (pure CSS bars)
// ===========================
function renderCharts() {
  const managerLabels = {
    '1': '什麼都要管',
    '2': '偏嚴格',
    '3': '適中',
    '4': '偏放手',
    '5': '完全放手'
  };

  const overtimeLabels = {
    '1': '根本被騙',
    '2': '差蠻多',
    '3': '偶爾加班',
    '4': '大致符合',
    '5': '完全如面試所說'
  };

  const managerCounts = countByRating(allData, 'managerStyle');
  const overtimeCounts = countByRating(allData, 'overtimeReality');

  document.getElementById('managerChart').innerHTML = renderBarChart(managerCounts, managerLabels, allData.length);
  document.getElementById('overtimeChart').innerHTML = renderBarChart(overtimeCounts, overtimeLabels, allData.length);
}

function countByRating(data, field) {
  const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  data.forEach(d => {
    const num = String(parseInt(d[field]) || 3);
    if (counts[num] !== undefined) counts[num]++;
  });
  return counts;
}

function renderBarChart(counts, labels, total) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const count = counts[String(i)] || 0;
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    html += `
      <div class="bar-row">
        <span class="bar-label">${labels[String(i)]}</span>
        <div class="bar-track">
          <div class="bar-fill bar-color-${i}" style="width:${pct}%"></div>
        </div>
        <span class="bar-pct">${pct}%</span>
      </div>`;
  }
  return html;
}

// ===========================
// CSV Parser
// ===========================
function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length >= 8 && row[1].trim()) {
      data.push({
        timestamp: row[0],
        company: row[1].trim(),
        department: row[2],
        tenure: row[3],
        managerStyle: row[4],
        teamVibe: row[5],
        overtimeReality: row[6],
        honestWord: row[7]
      });
    }
  }
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ===========================
// Company Helpers
// ===========================
function getUniqueCompanies() {
  const map = {};
  allData.forEach(d => {
    const name = d.company;
    map[name] = (map[name] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ===========================
// Search
// ===========================
function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  const container = document.getElementById('searchResults');

  // Close suggestions
  const sugBox = document.getElementById('searchSuggestions');
  sugBox.innerHTML = '';
  sugBox.style.display = 'none';

  if (!query) {
    container.innerHTML = '';
    document.getElementById('companyListTitle').textContent = '所有公司';
    renderCompanyList();
    return;
  }

  const matches = allData.filter(d =>
    d.company.toLowerCase().includes(query.toLowerCase())
  );

  if (typeof gtag === 'function') {
    gtag('event', 'search', { search_term: query, results_count: matches.length });
  }

  // Update URL for shareable deep link
  const newUrl = new URL(window.location);
  newUrl.searchParams.set('company', query);
  history.replaceState(null, '', newUrl);

  renderResults(matches, query);
  document.getElementById('companyListTitle').textContent = '';
  document.getElementById('companyList').innerHTML = '';
}

function searchCompany(name) {
  document.getElementById('searchInput').value = name;
  doSearch();
  document.getElementById('searchArea').scrollIntoView({ behavior: 'smooth' });
}

function renderResults(data, query) {
  const container = document.getElementById('searchResults');

  if (data.length === 0) {
    container.innerHTML = `
      <div class="no-results-enhanced">
        <div class="no-results-icon">🔍</div>
        <h3>「${escapeHTML(query)}」還沒有人分享過</h3>
        <p>成為第一個分享這間公司真實工作體驗的人，幫助其他人做出更好的職涯選擇。</p>
        <a href="#formSection" class="cta-btn cta-primary-inline" onclick="document.getElementById('formSection').scrollIntoView({behavior:'smooth'});return false;">我來分享「${escapeHTML(query)}」的經驗</a>
        <p class="no-results-hint">填寫只需 30 秒，完全匿名</p>
      </div>`;
    return;
  }

  // Aggregate scores for this company
  const avgManager = avgRating(data, 'managerStyle');
  const avgVibe = avgRating(data, 'teamVibe');
  const avgOvertime = avgRating(data, 'overtimeReality');

  const shareUrl = `${window.location.origin}${window.location.pathname}?company=${encodeURIComponent(query)}`;

  container.innerHTML = `
    <div class="company-summary">
      <div class="company-summary-header">
        <h3>${escapeHTML(query)} — ${data.length} 筆回覆</h3>
        <button class="share-btn" onclick="shareCompany('${escapeAttr(query)}', '${shareUrl}')" title="分享這間公司的評價">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>分享</span>
        </button>
      </div>
      <div class="summary-scores">
        <div class="summary-score">
          <span class="summary-label">主管風格</span>
          <span class="summary-value rating-tag rating-${Math.round(avgManager)}">${avgManager.toFixed(1)}</span>
        </div>
        <div class="summary-score">
          <span class="summary-label">團隊氣氛</span>
          <span class="summary-value rating-tag rating-${Math.round(avgVibe)}">${avgVibe.toFixed(1)}</span>
        </div>
        <div class="summary-score">
          <span class="summary-label">加班真實度</span>
          <span class="summary-value rating-tag rating-${Math.round(avgOvertime)}">${avgOvertime.toFixed(1)}</span>
        </div>
      </div>
    </div>`;

  data.forEach(d => {
    container.innerHTML += createCard(d);
  });

  // Related companies
  const matchedCompanies = new Set(data.map(d => d.company));
  const allCompanies = getUniqueCompanies();
  const related = allCompanies
    .filter(([name]) => !matchedCompanies.has(name))
    .slice(0, 6);

  if (related.length > 0) {
    container.innerHTML += `
      <div class="related-section">
        <h3>也有人評了這些公司</h3>
        <div class="company-grid">
          ${related.map(([name, count]) =>
            `<span class="company-chip" onclick="searchCompany('${escapeAttr(name)}')">${escapeHTML(name)}<span class="count">(${count})</span></span>`
          ).join('')}
        </div>
      </div>`;
  }
}

function avgRating(data, field) {
  let sum = 0, count = 0;
  data.forEach(d => {
    const num = parseInt(d[field]);
    if (num >= 1 && num <= 5) { sum += num; count++; }
  });
  return count > 0 ? sum / count : 3;
}

// ===========================
// Card Rendering
// ===========================
function createCard(d) {
  const timeStr = formatTime(d.timestamp);
  return `
    <div class="review-card">
      <div class="card-header">
        <div class="company-name">${escapeHTML(d.company)}</div>
        <div class="card-time">${timeStr}</div>
      </div>
      <div class="meta">${escapeHTML(d.department)} · ${escapeHTML(d.tenure)}</div>
      <div class="ratings">
        ${ratingTag('主管', d.managerStyle)}
        ${ratingTag('氣氛', d.teamVibe)}
        ${ratingTag('加班', d.overtimeReality)}
      </div>
      ${d.honestWord && d.honestWord.trim() && d.honestWord.trim() !== '無'
        ? `<div class="quote">${escapeHTML(d.honestWord)}</div>`
        : ''}
    </div>`;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  // Format: "2026/4/6 下午 3:42:50" -> "4/6"
  const match = timestamp.match(/(\d+)\/(\d+)\/(\d+)/);
  if (match) return `${match[2]}/${match[3]}`;
  return '';
}

function ratingTag(label, value) {
  const num = parseInt(value) || 3;
  return `<span class="rating-tag rating-${num}">${label}：${escapeHTML(value)}</span>`;
}

// ===========================
// Company List
// ===========================
function renderCompanyList(companies) {
  companies = companies || getUniqueCompanies();
  const container = document.getElementById('companyList');

  if (companies.length === 0) {
    container.innerHTML = '<div class="loading">暫無資料</div>';
    return;
  }

  container.innerHTML = '<div class="company-grid">' +
    companies.map(([name, count]) =>
      `<span class="company-chip" onclick="searchCompany('${escapeAttr(name)}')">${escapeHTML(name)}<span class="count">(${count})</span></span>`
    ).join('') +
    '</div>';
}

// ===========================
// Utils
// ===========================
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===========================
// Share
// ===========================
function shareCompany(companyName, url) {
  const shareData = {
    title: `${companyName} 的職場真心話`,
    text: `看看 ${companyName} 的匿名職場評價 — 主管風格、團隊氣氛、加班真實度`,
    url: url
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      showToast('連結已複製！可以分享給朋友');
    }).catch(() => {
      // Final fallback
      prompt('複製這個連結分享給朋友：', url);
    });
  }

  if (typeof gtag === 'function') {
    gtag('event', 'share', { method: navigator.share ? 'native' : 'clipboard', content_type: 'company', item_id: companyName });
  }
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===========================
// Count-up Animation
// ===========================
function animateCountUp(el, target) {
  if (!el || typeof target !== 'number' || target <= 0) {
    if (el) el.textContent = target;
    return;
  }
  const duration = 1000;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}
