const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQFB9Oo2EhWm2QUQq-mOdNuYQTswwbyQ3Qt8CkHGLL33uSBm49Snp7IlugyYkuIp3ZmdYCm2WUkb3/pub?output=csv';
const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSesYIiGj31EF4-7wD03_QB-5gWAsLck6FYUQu4qVk50KbZc-Q/viewform';

let allData = [];

document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
});

async function loadData() {
  document.getElementById('results').innerHTML = '<div class="loading">載入資料中...</div>';

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    allData = parseCSV(text);

    document.getElementById('stats').textContent =
      `目前共 ${allData.length} 筆真實回覆，來自 ${getUniqueCompanies().length} 家公司`;

    document.getElementById('results').innerHTML = '';
    renderCompanyList();
  } catch (err) {
    document.getElementById('results').innerHTML =
      '<div class="loading">資料載入失敗，請重新整理頁面</div>';
  }
}

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

function getUniqueCompanies() {
  const map = {};
  allData.forEach(d => {
    const name = d.company;
    map[name] = (map[name] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) {
    document.getElementById('results').innerHTML = '';
    document.getElementById('companyListTitle').textContent = '所有公司';
    renderCompanyList();
    return;
  }

  const matches = allData.filter(d =>
    d.company.toLowerCase().includes(query.toLowerCase())
  );

  renderResults(matches, query);
  document.getElementById('companyListTitle').textContent = '';
  document.getElementById('companyList').innerHTML = '';
}

function searchCompany(name) {
  document.getElementById('searchInput').value = name;
  doSearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResults(data, query) {
  const container = document.getElementById('results');

  if (data.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <p>找不到「${escapeHTML(query)}」的資料</p>
        <p style="margin-top:8px">
          <a href="${FORM_URL}" target="_blank">成為第一個填寫的人</a>
        </p>
      </div>`;
    return;
  }

  container.innerHTML = `<p style="margin-bottom:16px;color:#666">找到 ${data.length} 筆「${escapeHTML(query)}」的回覆</p>`;

  data.forEach(d => {
    container.innerHTML += createCard(d);
  });
}

function createCard(d) {
  return `
    <div class="review-card">
      <div class="company-name">${escapeHTML(d.company)}</div>
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

function ratingTag(label, value) {
  const num = parseInt(value) || 3;
  return `<span class="rating-tag rating-${num}">${label}：${escapeHTML(value)}</span>`;
}

function renderCompanyList() {
  const companies = getUniqueCompanies();
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

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
