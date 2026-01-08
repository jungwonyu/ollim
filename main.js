let visibleCount = 5; // 처음에 보여줄 개수
let trades = JSON.parse(localStorage.getItem('invest_v22')) || [];
let targetAmount = parseInt(localStorage.getItem('target_v22')) || 1000000;
let chart;
let pendingDeleteIdx = null;

// CSV 내보내기
function exportToCSV() {
  if (trades.length === 0) return alert('내보낼 데이터가 없습니다.');
  
  // 1. 첫 줄에 설정 데이터(목표 금액) 포함 (BOM 추가로 한글 깨짐 방지)
  let csvContent = '\uFEFF';

	csvContent += `[CONFIG],목표금액,${targetAmount},시작금액,${trades.length > 0 ? trades[0].balance : 0},,,, \n`;
  // 2. 헤더 추가
  csvContent += '일자,종목명,매수금액,매도금액,수익금,수익률,최종잔고\n';
  
  // 3. 데이터 추가
  trades.forEach((t) => {
    const profit = t.isSeed ? 0 : t.sellAmount - t.buyAmount;
    const rate = t.isSeed || t.buyAmount === 0 ? 0 : ((profit / t.buyAmount) * 100).toFixed(2);
    csvContent += `${t.isSeed ? '시작' : t.date},${t.ticker},${t.buyAmount},${t.sellAmount},${profit},${rate}%,${t.balance}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `OLLIM_DATA_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// CSV 불러오기
function importFromCSV(input) {
  const file = input.files[0];
  if (!file) return;
  if (trades.length > 0 && !confirm('기존 데이터가 삭제되고 파일 내용으로 대체됩니다. 진행할까요?'))
    return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const rows = text.split('\n');
    const newTrades = [];

    // 1. [CONFIG] 줄에서 목표 금액과 시작 금액 복구
    if (rows[0].startsWith('[CONFIG]')) {
      const configCols = rows[0].split(',');
      const importedTarget = parseInt(configCols[2]);
      const importedSeed = parseInt(configCols[4]); // 시작 금액 위치

      if (!isNaN(importedTarget)) {
        targetAmount = importedTarget;
        localStorage.setItem('target_v22', targetAmount);
      }
    }

    const dataRows = rows.slice(2); 

    dataRows.forEach((row) => {
      if (!row.trim()) return;
      const cols = row.split(',');
      const isSeed = cols[0] === '시작';
      newTrades.push({
        date: isSeed ? '1900-01-01' : cols[0],
        ticker: cols[1],
        buyAmount: parseInt(cols[2]) || 0,
        sellAmount: parseInt(cols[3]) || 0,
        // balance는 CSV에 저장된 값을 그대로 가져오므로 시작 금액이 자연스럽게 복구됩니다.
        balance: parseInt(cols[6]) || 0, 
        isSeed: isSeed,
      });
    });

    if (newTrades.length > 0) {
      trades = newTrades;
      saveAndRefresh();
      alert('데이터, 목표 금액, 시작 금액을 모두 불러왔습니다.');
      location.reload();
    }
  };
  reader.readAsText(file);
}

function reCalculateBalances() {
  if (trades.length === 0) return;
  trades.sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = 1; i < trades.length; i++) {
    trades[i].balance = trades[i - 1].balance + (trades[i].sellAmount - trades[i].buyAmount);
  }
}

function updateDashboard() {
  if (trades.length === 0) return;
  const start = trades[0].balance;
  const current = trades[trades.length - 1].balance;
  const progress = Math.min(((current - start) / (targetAmount - start)) * 100, 100);

  let rankText = '🐣 알을 깨는 중';
  if (progress >= 100) rankText = '👑 자산의 지배자';
  else if (progress >= 80) rankText = '🔥 목표 도달 직전';
  else if (progress >= 50) rankText = '⚡ 확신의 매매법';
  else if (progress >= 20) rankText = '🌊 흐름을 타는 중';

  document.getElementById('user-rank').innerText = rankText;
  document.getElementById('progress-bar').style.width = Math.max(1, progress) + '%';
  document.getElementById('start-label').innerText = `ST: ${start.toLocaleString()}`;
  document.getElementById('target-label').innerText = `GOAL: ${targetAmount.toLocaleString()}`;
  document.getElementById('current-balance').innerText = current.toLocaleString() + '원';
  document.getElementById('progress-percent').innerText = Math.floor(progress) + '%';
  document.getElementById('user-level-badge').innerText = `LV.${Math.floor(progress / 20) + 1}`;
}

function renderHistory() {
  const mobileList = document.getElementById('mobile-trade-history');
  let mobileHtml = '';

  // [수정 포인트] 전체 데이터를 역순으로 만든 후, 현재 visibleCount만큼만 자릅니다.
  const displayTrades = [...trades].reverse().slice(0, visibleCount);

  displayTrades.map((t) => {
    const realIdx = trades.indexOf(t);
    const pAmt = t.isSeed ? 0 : t.sellAmount - t.buyAmount;
    const pRate = t.isSeed || t.buyAmount === 0 ? 0 : ((pAmt / t.buyAmount) * 100).toFixed(2);
    const colorClass = pAmt > 0 ? 'text-red-500' : pAmt < 0 ? 'text-blue-500' : 'text-slate-400';

    mobileHtml += `<div class="glass-card p-4 rounded-2xl border-l-4 mb-4 ${
      t.isSeed ? 'border-l-slate-400' : pAmt >= 0 ? 'border-l-red-500' : 'border-l-blue-500'
    } animate-modal shadow-sm">
            <div class="flex justify-between items-start">
                <div><span class="text-[11px] text-slate-400 font-bold uppercase">${
                  t.isSeed ? 'START' : t.date
                }</span><h3 class="font-bold text-base">${t.ticker}</h3></div>
                ${!t.isSeed ? `<button onclick="openModal('delete', ${realIdx})" class="p-2 text-slate-300">✕</button>` : ''}
            </div>
            <div class="grid grid-cols-3 gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <div><p class="text-[10px] text-slate-400 font-bold uppercase">Trade</p><p class="text-[10px] text-slate-500">B: ${
                  t.isSeed ? '-' : t.buyAmount.toLocaleString()
                }</p><p class="text-[10px] text-slate-500">S: ${
                  t.isSeed ? '-' : t.sellAmount.toLocaleString()
                }</p></div>
                <div class="border-x border-slate-100 dark:border-slate-800 flex flex-col justify-center"><p class="text-[10px] text-slate-400 font-bold uppercase">Profit</p><p class="text-[11px] font-black ${colorClass}">${
                  t.isSeed ? '-' : (pAmt > 0 ? '+' : '') + pAmt.toLocaleString()
                }</p><p class="text-[9px] font-bold ${colorClass}">${
                  t.isSeed ? '' : '(' + (pAmt > 0 ? '+' : '') + pRate + '%)'
                }</p></div>
                <div class="flex flex-col justify-center"><p class="text-[10px] text-slate-400 font-bold uppercase">Balance</p><p class="text-[11px] font-black text-emerald-500">${t.balance.toLocaleString()}</p></div>
            </div>
        </div>`;
  });

  // HTML을 먼저 넣고
  mobileList.innerHTML = mobileHtml;

  renderMoreButton();
}

// 2. 더보기 버튼 전용 함수 (추가)
function renderMoreButton() {
  const mobileList = document.getElementById('mobile-trade-history');
  
  if (trades.length <= 5) return;

  const btn = document.createElement('button');
  btn.className = 'w-full py-6 mt-2 mb-10 text-[11px] font-black text-slate-400 hover:text-blue-500 transition-all uppercase tracking-widest';

  // [핵심 로직] 현재 보여주는 개수가 전체 개수보다 적으면 '더보기', 다 보여줬으면 '접기'
  if (visibleCount < trades.length) {
    btn.innerHTML = `Load More Records (${visibleCount} / ${trades.length}) <br> <span class="text-[15px]">▾</span>`;
    btn.onclick = () => {
      visibleCount += 5; 
      renderHistory(); 
      // 추가된 부분: 버튼 클릭 후 버튼 위치로 부드럽게 이동 (선택사항)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };
  } else {
    // 모든 기록을 다 본 상태
    btn.innerHTML = `Close Records (Show First 5) <br> <span class="text-[15px]">▴</span>`;
    btn.onclick = () => {
      visibleCount = 5; // 다시 5개로 초기화
      renderHistory();
      // 접은 후 리스트 상단으로 이동
      document.getElementById('mobile-trade-history').scrollIntoView({ behavior: 'smooth' });
    };
  }
  
  mobileList.appendChild(btn);
}
function addTrade() {
  const t = document.getElementById('ticker').value,
    buy = parseInt(document.getElementById('buy-amount-input').value),
    sell = parseInt(document.getElementById('sell-amount-input').value),
    date = document.getElementById('trade-date').value;
  if (!t || isNaN(buy) || isNaN(sell) || !date) return alert('입력 확인!');
  trades.push({
    date: date,
    ticker: t,
    buyAmount: buy,
    sellAmount: sell,
    balance: 0,
    isSeed: false,
  });
  reCalculateBalances();
  saveAndRefresh();
  document.getElementById('ticker').value = '';
  document.getElementById('buy-amount-input').value = '';
  document.getElementById('sell-amount-input').value = '';
}

function saveAndRefresh() {
  localStorage.setItem('invest_v22', JSON.stringify(trades));
  renderAll();
}

function openModal(type, idx = null) {
  const modal = document.getElementById('confirm-modal');
  const btn = document.getElementById('modal-confirm-btn');
  if (type === 'reset') {
    document.getElementById('modal-icon').innerHTML = '⚠️';
    document.getElementById('modal-title').innerText = '전체 초기화';
    document.getElementById('modal-desc').innerText = '모든 데이터가 삭제됩니다.';
    btn.innerText = '초기화';
    btn.className ='flex-1 bg-red-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all';
    btn.onclick = () => {
      localStorage.clear();
      location.reload();
    };
  } else {
    pendingDeleteIdx = idx;
    document.getElementById('modal-icon').innerHTML = '🗑️';
    document.getElementById('modal-title').innerText = '기록 삭제';
    document.getElementById('modal-desc').innerText = '기록을 삭제하시겠습니까?';
    btn.innerText = '삭제';
    btn.className = 'flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all';
    btn.onclick = () => {
      trades.splice(pendingDeleteIdx, 1);
      reCalculateBalances();
      saveAndRefresh();
      closeModal();
    };
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function openResetModal() {
  openModal('reset');
}

function renderChart() {
  const ctx = document.getElementById('equityChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trades.map((t) => (t.isSeed ? '시작' : t.date)),
      datasets: [
        {
          data: trades.map((t) => t.balance),
          borderColor: '#3b82f6',
          borderWidth: 3,
          pointRadius: 2,
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          tension: 0.4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { font: { size: 9 } } },
        x: { ticks: { font: { size: 9 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function updateChart() {
  chart.data.labels = trades.map((t) => (t.isSeed ? '시작' : t.date));
  chart.data.datasets[0].data = trades.map((t) => t.balance);
  chart.update();
}

function renderAll() {
  updateDashboard();
  if (!chart) renderChart();
  else updateChart();
  renderHistory();
}

function toggleTheme() {
	const isLight = document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('theme_v22', isLight ? 'light' : 'dark');
  updateThemeUI();
  if (chart) chart.update();
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme_v22');
	if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
  }
  updateThemeUI();
}

function updateThemeUI() {
  const isLight = document.documentElement.classList.contains('light-mode');
  document.getElementById('theme-icon').innerText = isLight ? '☀️' : '🌙';
  document.getElementById('theme-text').innerText = isLight ? 'Light Mode' : 'Dark Mode';
}

function saveInitialSetup() {
  const initial = parseInt(document.getElementById('initial-input').value), target = parseInt(document.getElementById('target-input').value);
  if (!initial || !target) return alert('금액을 입력하세요.');
	targetAmount = target;
  localStorage.setItem('target_v22', target);
  trades.push({ date: '1900-01-01', ticker: '종목명', buyAmount: 0, sellAmount: 0, balance: initial, isSeed: true });
  saveAndRefresh();
  document.getElementById('setup-modal').classList.add('hidden');
  document.getElementById('main').classList.remove('hidden');
}

function verifyPassword() { // 보안 체크
  const val = document.getElementById('pass-input').value;
  if (val === MASTER_KEY) {
    sessionStorage.setItem('ollim_auth', 'true');
    document.getElementById('auth-overlay').style.display = 'none';
    initApp();
  } else {
    alert('비밀번호가 올바르지 않습니다.');
  }
}

function checkAuth() {
  if (sessionStorage.getItem('ollim_auth') === 'true') {
    document.getElementById('auth-overlay').style.display = 'none';
    initApp();
  } else {
		document.getElementById('auth-overlay').style.display = 'flex';
	}
}

function initApp() { // 앱 초기화 로직
	if (trades.length === 0) {
		console.log('ㅎㅎ')
		document.getElementById('setup-modal').classList.remove('hidden');
	} else {
		document.getElementById('main').classList.remove('hidden');
		renderAll();
	}
}

// ---------------------------------------------------------------------------------- 실행
window.onload = () => {
  applySavedTheme(); // 테마 먼저 적용
  checkAuth();       // 그다음 보안 체크
};

document.getElementById('trade-date').valueAsDate = new Date();
document.querySelector('.js-openResetModal').addEventListener('click', openResetModal);
document.querySelector('.js-addTrade').addEventListener('click', addTrade);
document.querySelector('.js-closeModal').addEventListener('click', closeModal);
document.querySelector('.js-exportCSV').addEventListener('click', exportToCSV);
document.querySelector('.js-toggleTheme').addEventListener('click', toggleTheme);
document.querySelector('.js-saveInitialSetup').addEventListener('click', saveInitialSetup);
document.getElementById('import-csv').addEventListener('change', function() {
  importFromCSV(this);
}); // CSV 파일 input change 이벤트 연결
document.querySelector('.js-verifyPassword').addEventListener('click', verifyPassword);

const MASTER_KEY = '1234'; // 마스터 비밀번호 설정!

const modal = document.getElementById("guideModal");
const btn = document.getElementById("guideBtn");
const span = document.getElementsByClassName("ollim-close")[0];

// 모달 제어
btn.onclick = () => {
  modal.style.display = "block";
  document.body.style.overflow = 'hidden';
};
span.onclick = () => {
  modal.style.display = "none";
  document.body.style.overflow = '';
};
window.onclick = (e) => {
  if (e.target == modal) {
    modal.style.display = "none";
    document.body.style.overflow = '';
  }
}

// 탭 전환 로직
function openTab(evt, tabName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; }
  tablinks = document.getElementsByClassName("tab-link");
  for (i = 0; i < tablinks.length; i++) { tablinks[i].className = tablinks[i].className.replace(" active", ""); }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

window.openModal = openModal;
window.openTab = openTab;