// ==UserScript==
// @name         EZWEL Subtraction Autofill
// @namespace    https://github.com/80ROkWOC4j/ezwel-subtraction
// @homepageURL  https://github.com/80ROkWOC4j/ezwel-subtraction
// @supportURL   https://github.com/80ROkWOC4j/ezwel-subtraction/issues
// @version      0.1.4
// @description  EZWEL 복지몰 최근 3개월 카드 사용 내역 자동 차감 스크립트. 설치하면 이지웰 접속 시 우측 하단에 차감 버튼 생기고 이거 누르면 차감 버튼만 누르면 되게 셋팅 해줌.
// @license      MIT
// @match        https://*.ezwel.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__ezwelSubtractionAutofillLoaded) {
    return;
  }
  window.__ezwelSubtractionAutofillLoaded = true;

  const TARGET_PATHNAME = '/pc/customer/welfarecard/subtraction-requisition';
  const TARGET_QUERY = 'topMenuCd=1005171232&hezoMenuCd=1005171236';
  const AUTOSTART_PARAM = 'ezwelAutofill';

  const UI_IDS = {
    root: 'ezwel-subtraction-autofill-root',
    button: 'ezwel-subtraction-autofill-button',
    style: 'ezwel-subtraction-autofill-style',
  };

  const TIMEOUTS = {
    pageReadyMs: 20_000,
    queryResultsMs: 30_000,
    inputEnableMs: 5_000,
    inputCommitMs: 5_000,
    sumUpdateMs: 5_000,
    actionRetryMs: 1_000,
    actionRetryCount: 8,
    readyStableMs: 500,
    pollMs: 150,
  };

  const TRACKED_REQUEST_PATTERNS = {
    pageReady: [
      '/bff/customer/private/welfarecard/subtraction-requisition/title',
      '/bff/customer/private/welfarecard/subtraction-requisition/content',
      '/customer/api/v1/private/welfarecard/setting',
      '/mypage/api/v1/private/personal-information/user-info',
      '/customer/api/v1/private/certificate/valid-adult-verification',
    ],
    query: [
      '/customer/api/v1/private/welfarecard/subtraction-requisition/list',
    ],
  };

  const runtime = {
    running: false,
    root: null,
    button: null,
    requestBuckets: {
      pageReady: createRequestBucket(),
      query: createRequestBucket(),
    },
    requestedPointTotalElement: null,
  };

  bootstrap();

  function bootstrap() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize, { once: true });
      return;
    }

    initialize();
  }

  function initialize() {
    installRequestTracker();
    injectStyles();
    ensureUi();
    syncUi('idle');

    if (hasAutostartFlag()) {
      if (isTargetPage()) {
        void runAutofillFlow();
        return;
      }

      if (isLoginPage()) {
        clearAutostartFlag();
        syncUi('error', '로그인 후 다시 실행해 주세요.');
      }
    }
  }

  function injectStyles() {
    if (document.getElementById(UI_IDS.style)) {
      return;
    }

    const style = document.createElement('style');
    style.id = UI_IDS.style;
    style.textContent = `
      #${UI_IDS.root} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        font-family: "Segoe UI", "Apple SD Gothic Neo", sans-serif;
      }

      #${UI_IDS.button} {
        min-width: 160px;
        max-width: 280px;
        padding: 12px 18px;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.45;
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.24);
        cursor: pointer;
        white-space: normal;
        text-align: center;
      }

      #${UI_IDS.button}[data-state="running"],
      #${UI_IDS.button}[data-state="pending-navigation"] {
        background: linear-gradient(135deg, #1d4ed8, #2563eb);
      }

      #${UI_IDS.button}[data-state="done"] {
        background: linear-gradient(135deg, #047857, #059669);
      }

      #${UI_IDS.button}[data-state="error"] {
        background: linear-gradient(135deg, #b91c1c, #dc2626);
      }

      #${UI_IDS.button}:disabled {
        cursor: wait;
        opacity: 0.92;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureUi() {
    if (runtime.root && runtime.button) {
      return;
    }

    const root = document.createElement('div');
    root.id = UI_IDS.root;
    root.style.position = 'fixed';
    root.style.right = '20px';
    root.style.bottom = '20px';
    root.style.zIndex = '2147483647';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'flex-end';
    root.style.gap = '8px';
    root.style.fontFamily = '"Segoe UI", "Apple SD Gothic Neo", sans-serif';

    const button = document.createElement('button');
    button.id = UI_IDS.button;
    button.type = 'button';
    button.style.minWidth = '160px';
    button.style.maxWidth = '280px';
    button.style.padding = '12px 18px';
    button.style.border = '0';
    button.style.borderRadius = '14px';
    button.style.background = 'linear-gradient(135deg, #0f172a, #1e293b)';
    button.style.color = '#fff';
    button.style.fontSize = '14px';
    button.style.fontWeight = '700';
    button.style.lineHeight = '1.45';
    button.style.boxShadow = '0 14px 30px rgba(15, 23, 42, 0.24)';
    button.style.cursor = 'pointer';
    button.style.whiteSpace = 'normal';
    button.style.textAlign = 'center';
    button.addEventListener('click', onActionClick);
    root.appendChild(button);
    document.body.appendChild(root);

    runtime.root = root;
    runtime.button = button;
  }

  function onActionClick() {
    if (runtime.running) {
      return;
    }

    if (!isTargetPage()) {
      syncUi('pending-navigation', '차감신청 페이지로 이동 중...');
      window.location.href = buildTargetUrl({ autostart: true });
      return;
    }

    void runAutofillFlow();
  }

  async function runAutofillFlow() {
    if (runtime.running) {
      return;
    }

    runtime.running = true;
    syncUi('running', '진행 중...');

    try {
      if (isLoginPage()) {
        throw new Error('로그인 후 다시 실행해 주세요.');
      }

      await waitForPageReady();
      clearAutostartFlag();
      await selectThreeMonths();
      const rows = await queryRows();

      if (rows.length === 0) {
        syncUi('done', '조회 결과 없음');
        return;
      }

      const result = await fillAllRows(rows);
      syncUi('done', `${result.count}건 입력 완료 / 합계 ${formatMoney(result.total)}원`);
    } catch (error) {
      syncUi('error', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      runtime.running = false;
      clearAutostartFlag();
      if (runtime.button) {
        runtime.button.disabled = false;
      }
    }
  }

  async function waitForPageReady() {
    let lastSignature = '';
    let stableSince = 0;

    await waitForCondition(() => {
      const signature = getPageReadySignature();
      if (!signature) {
        lastSignature = '';
        stableSince = 0;
        return false;
      }

      if (signature !== lastSignature) {
        lastSignature = signature;
        stableSince = Date.now();
        return false;
      }

      return Date.now() - stableSince >= TIMEOUTS.readyStableMs;
    }, {
      timeoutMs: TIMEOUTS.pageReadyMs,
      description: '차감신청 화면 준비',
    });
  }

  async function selectThreeMonths() {
    await waitForCondition(() => findButtonByText('3개월'), {
      timeoutMs: TIMEOUTS.pageReadyMs,
      description: '3개월 버튼',
    });

    const initialRange = getSearchDateRange();
    await clickUntil(
      () => findButtonByText('3개월'),
      () => isThreeMonthsSelected(initialRange),
      '3개월 선택',
    );
  }

  async function queryRows() {
    await waitForCondition(() => findButtonByText('조회하기'), {
      timeoutMs: TIMEOUTS.pageReadyMs,
      description: '조회하기 버튼',
    });

    const initialState = inspectTableState();
    const queryBucket = runtime.requestBuckets.query;
    const startedBefore = queryBucket.started;
    const finishedBefore = queryBucket.finished;

    await clickUntil(() => findButtonByText('조회하기'), () => {
      if (queryBucket.started > startedBefore) {
        return true;
      }

      const currentState = inspectTableState();
      return hasTableStateMeaningfullyChanged(initialState, currentState);
    }, '조회하기 클릭');

    const state = await waitForCondition(() => {
      const currentState = inspectTableState();

      if (queryBucket.started > startedBefore && queryBucket.pending > 0) {
        return null;
      }

      if (queryBucket.finished > finishedBefore || hasTableStateMeaningfullyChanged(initialState, currentState)) {
        return finalizeQueryState(currentState);
      }

      return null;
    }, {
      timeoutMs: TIMEOUTS.queryResultsMs,
      description: '조회 결과',
    });

    return state.rows;
  }

  async function fillAllRows(rows) {
    let count = 0;
    let total = 0;

    for (const row of rows) {
      const amount = extractPaymentAmount(row);
      if (amount <= 0) {
        continue;
      }

      const checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox) {
        continue;
      }

      if (!checkbox.checked) {
        clickElement(checkbox);
      }

      const input = await waitForCondition(() => getEditableAmountInput(row), {
        timeoutMs: TIMEOUTS.inputEnableMs,
        description: '입력 가능한 신청 복지포인트 칸',
      });

      await setInputValue(input, amount);
      count += 1;
      total += amount;
    }

    await waitForCondition(() => readRequestedPointTotal() === total, {
      timeoutMs: TIMEOUTS.sumUpdateMs,
      description: '신청 복지포인트 합계 반영',
    }).catch(() => {
      const displayed = readRequestedPointTotal();
      throw new Error(`합계 반영 실패: 예상 ${formatMoney(total)}원, 화면 ${formatMoney(displayed)}원`);
    });

    return { count, total };
  }

  function buildTargetUrl(options) {
    const url = new URL(TARGET_PATHNAME, window.location.origin);
    url.search = TARGET_QUERY;
    if (options && options.autostart) {
      url.searchParams.set(AUTOSTART_PARAM, '1');
    }
    return url.toString();
  }

  function isTargetPage() {
    return window.location.pathname === TARGET_PATHNAME;
  }

  function isLoginPage() {
    return window.location.pathname.includes('/pc/mypage/auth/login/');
  }

  function hasAutostartFlag() {
    return new URL(window.location.href).searchParams.get(AUTOSTART_PARAM) === '1';
  }

  function clearAutostartFlag() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(AUTOSTART_PARAM)) {
      return;
    }
    url.searchParams.delete(AUTOSTART_PARAM);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function getResultTable() {
    return document.querySelector('table');
  }

  function getVisibleTableRows(table) {
    return Array.from(table.querySelectorAll('tbody tr')).filter(isVisible);
  }

  function inspectTableState() {
    const table = getResultTable();
    if (!table) {
      return {
        table: null,
        visibleRows: [],
        dataRows: [],
        hasPlaceholder: false,
        signature: '',
      };
    }

    const visibleRows = getVisibleTableRows(table);
    const dataRows = visibleRows.filter(isDataRow);
    return {
      table,
      visibleRows,
      dataRows,
      hasPlaceholder: visibleRows.some(isPlaceholderRow),
      signature: getTableSignature(table),
    };
  }

  function getTableSignature(table) {
    const body = table.querySelector('tbody');
    return cleanText(body ? body.innerText : table.innerText);
  }

  function hasTableStateMeaningfullyChanged(previousState, currentState) {
    return (
      previousState.signature !== currentState.signature ||
      previousState.dataRows.length !== currentState.dataRows.length ||
      previousState.hasPlaceholder !== currentState.hasPlaceholder
    );
  }

  function finalizeQueryState(state) {
    if (!state.table) {
      return { rows: [] };
    }

    if (state.dataRows.length > 0) {
      return { rows: state.dataRows };
    }

    if (state.hasPlaceholder) {
      return null;
    }

    return { rows: [] };
  }

  function isDataRow(row) {
    return Boolean(row.querySelector('input[type="checkbox"]') && row.querySelectorAll('td').length >= 8);
  }

  function isPlaceholderRow(row) {
    return cleanText(row.innerText).includes('조회하기 버튼을 클릭하세요');
  }

  function getEditableAmountInput(row) {
    return Array.from(row.querySelectorAll('input[type="text"]')).find((input) => {
      return isVisible(input) && !input.readOnly && !input.disabled;
    }) || null;
  }

  function extractPaymentAmount(row) {
    const paymentCell = row.querySelector('td:nth-child(5)');
    return parseMoney(paymentCell ? paymentCell.innerText : '');
  }

  async function setInputValue(input, amount) {
    const rawValue = String(amount);
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    const setValue = descriptor && descriptor.set;

    input.focus();
    if (setValue) {
      setValue.call(input, rawValue);
    } else {
      input.value = rawValue;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();

    await waitForCondition(() => parseMoney(input.value) === amount, {
      timeoutMs: TIMEOUTS.inputCommitMs,
      description: '입력값 반영',
    });
  }

  function readRequestedPointTotal() {
    const totalElement = getRequestedPointTotalElement();
    const sourceText = totalElement ? totalElement.innerText : document.body.innerText;
    const match = cleanText(sourceText).match(/신청\s*복지포인트\s*합계\s*([0-9,]+)\s*원/);
    return match ? parseMoney(match[1]) : 0;
  }

  function getRequestedPointTotalElement() {
    if (runtime.requestedPointTotalElement && runtime.requestedPointTotalElement.isConnected) {
      return runtime.requestedPointTotalElement;
    }

    const candidates = Array.from(document.querySelectorAll('div, li, p, span, strong, em, dd'));
    runtime.requestedPointTotalElement = candidates.find((element) => {
      const text = cleanText(element.innerText);
      return text.includes('신청 복지포인트 합계') && /\d[\d,]*\s*원/.test(text);
    }) || null;

    return runtime.requestedPointTotalElement;
  }

  function getPageReadySignature() {
    const threeMonthsButton = findButtonByText('3개월');
    const queryButton = findButtonByText('조회하기');
    const table = getResultTable();
    const range = getSearchDateRange();
    const pageReadyBucket = runtime.requestBuckets.pageReady;

    if (!threeMonthsButton || !queryButton || !table || !range || !range.start || !range.end) {
      return null;
    }

    if (hasBlockingOverlay()) {
      return null;
    }

    if (pageReadyBucket.pending > 0) {
      return null;
    }

    return `${range.start}|${range.end}|${pageReadyBucket.finished}|${inspectTableState().signature}`;
  }

  function syncUi(state, detail) {
    ensureUi();

    runtime.button.dataset.state = state;
    runtime.button.disabled = state === 'running' || state === 'pending-navigation';
    runtime.button.textContent = getButtonLabel(state, detail);
    runtime.button.style.opacity = runtime.button.disabled ? '0.92' : '1';
    runtime.button.style.cursor = runtime.button.disabled ? 'wait' : 'pointer';

    if (state === 'done') {
      runtime.button.style.background = 'linear-gradient(135deg, #047857, #059669)';
      return;
    }

    if (state === 'error') {
      runtime.button.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
      return;
    }

    if (state === 'running' || state === 'pending-navigation') {
      runtime.button.style.background = 'linear-gradient(135deg, #1d4ed8, #2563eb)';
      return;
    }

    runtime.button.style.background = 'linear-gradient(135deg, #0f172a, #1e293b)';
  }

  function getButtonLabel(state, detail) {
    switch (state) {
      case 'pending-navigation':
        return detail || '차감신청 페이지로 이동 중...';
      case 'running':
        return detail || '진행 중...';
      case 'done':
        return detail || '완료';
      case 'error':
        return detail || '오류';
      case 'idle':
      default:
        return '차감 자동입력';
    }
  }

  function findButtonByText(text) {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    return candidates.find((element) => isVisible(element) && cleanText(element.textContent) === text) || null;
  }

  function isThreeMonthsSelected(initialRange) {
    const button = findButtonByText('3개월');
    const radio = button ? button.querySelector('input[type="radio"]') : null;
    if (radio && radio.checked) {
      return true;
    }

    const currentRange = getSearchDateRange();
    if (!initialRange || !currentRange) {
      return false;
    }

    if (currentRange.start !== initialRange.start) {
      return true;
    }

    const startDays = parseKoreanDate(currentRange.start);
    const endDays = parseKoreanDate(currentRange.end);
    if (!startDays || !endDays) {
      return false;
    }

    const diffDays = Math.round((endDays - startDays) / 86_400_000);
    return diffDays >= 80;
  }

  function getSearchDateRange() {
    const dateInputs = Array.from(document.querySelectorAll('input[placeholder="날짜"]')).filter(isVisible);
    if (dateInputs.length < 2) {
      return null;
    }

    return {
      start: cleanText(dateInputs[0].value),
      end: cleanText(dateInputs[1].value),
    };
  }

  function parseKoreanDate(value) {
    const match = cleanText(value).match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  function hasBlockingOverlay() {
    const selectors = [
      '.ezwel-until-dimm',
      '[class*="dimm"]',
      '[class*="overlay"]',
      '[class*="loading"]',
    ];

    const elements = [...new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))))];
    return elements.some((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.position !== 'fixed' && Number(style.zIndex || 0) < 1000) {
        return false;
      }

      return rect.width >= window.innerWidth * 0.5 && rect.height >= window.innerHeight * 0.4;
    });
  }

  async function clickUntil(getElement, predicate, description) {
    let lastError = null;

    for (let attempt = 0; attempt < TIMEOUTS.actionRetryCount; attempt += 1) {
      const element = getElement();
      if (!element) {
        throw new Error(`${description} 요소를 찾을 수 없습니다.`);
      }

      clickElement(element);

      try {
        await waitForCondition(predicate, {
          timeoutMs: TIMEOUTS.actionRetryMs,
          description,
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${description}에 실패했습니다.`);
  }

  function clickElement(element) {
    if (element.matches('button')) {
      const nestedInput = element.querySelector('input[type="radio"], input[type="checkbox"]');
      if (nestedInput && !nestedInput.disabled) {
        nestedInput.click();
        return;
      }
    }

    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.click();
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function installRequestTracker() {
    if (window.__ezwelSubtractionRequestTrackerInstalled) {
      return;
    }

    window.__ezwelSubtractionRequestTrackerInstalled = true;

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (originalFetch) {
      window.fetch = async function trackedFetch(...args) {
        const url = extractRequestUrl(args[0]);
        const requestType = classifyTrackedRequest(url);
        if (!requestType) {
          return originalFetch(...args);
        }

        markTrackedRequestStart(requestType);
        try {
          return await originalFetch(...args);
        } finally {
          markTrackedRequestFinish(requestType);
        }
      };
    }

    const originalOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
    const originalSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
    if (originalOpen && originalSend) {
      window.XMLHttpRequest.prototype.open = function trackedOpen(method, url, ...rest) {
        this.__ezwelTrackedRequest = classifyTrackedRequest(extractRequestUrl(url));
        return originalOpen.call(this, method, url, ...rest);
      };

      window.XMLHttpRequest.prototype.send = function trackedSend(...args) {
        if (!this.__ezwelTrackedRequest) {
          return originalSend.apply(this, args);
        }

        const requestType = this.__ezwelTrackedRequest;
        markTrackedRequestStart(requestType);
        this.addEventListener('loadend', () => markTrackedRequestFinish(requestType), { once: true });
        return originalSend.apply(this, args);
      };
    }
  }

  function classifyTrackedRequest(url) {
    if (typeof url !== 'string') {
      return null;
    }

    if (TRACKED_REQUEST_PATTERNS.query.some((pattern) => url.includes(pattern))) {
      return 'query';
    }

    if (TRACKED_REQUEST_PATTERNS.pageReady.some((pattern) => url.includes(pattern))) {
      return 'pageReady';
    }

    return null;
  }

  function extractRequestUrl(input) {
    if (typeof input === 'string') {
      return input;
    }

    if (input && typeof input.url === 'string') {
      return input.url;
    }

    return '';
  }

  function markTrackedRequestStart(type) {
    const bucket = runtime.requestBuckets[type];
    if (!bucket) {
      return;
    }

    bucket.started += 1;
    bucket.pending += 1;
    bucket.lastStartedAt = Date.now();
  }

  function markTrackedRequestFinish(type) {
    const bucket = runtime.requestBuckets[type];
    if (!bucket) {
      return;
    }

    bucket.finished += 1;
    bucket.pending = Math.max(0, bucket.pending - 1);
    bucket.lastFinishedAt = Date.now();
  }

  function createRequestBucket() {
    return {
      pending: 0,
      started: 0,
      finished: 0,
      lastStartedAt: 0,
      lastFinishedAt: 0,
    };
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseMoney(value) {
    const digits = cleanText(value).replace(/[^\d-]/g, '');
    return digits ? Number(digits) : 0;
  }

  function formatMoney(value) {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString('ko-KR');
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForCondition(check, options) {
    const timeoutMs = options && options.timeoutMs ? options.timeoutMs : TIMEOUTS.pageReadyMs;
    const description = options && options.description ? options.description : '조건';
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const value = check();
      if (value) {
        return value;
      }
      await wait(TIMEOUTS.pollMs);
    }

    throw new Error(`${description} 대기 시간이 초과되었습니다.`);
  }
})();
