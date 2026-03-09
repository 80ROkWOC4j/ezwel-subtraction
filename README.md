# ezwel-deducter

`Violentmonkey`/`Tampermonkey`에 넣어 사용하는 EZWEL 차감신청 userscript입니다.

현재 접속 중인 EZWEL 도메인의 복지카드 차감신청 화면을 대상으로 동작합니다.

## 설치

1. 브라우저에 `Violentmonkey` 또는 `Tampermonkey`를 설치합니다.
2. [ezwel-subtraction.user.js](/home/td/ezwel-deducter/ezwel-subtraction.user.js) 파일을 새 스크립트로 등록합니다.
3. 로그인된 `https://*.ezwel.com/*` 탭에서 사용합니다.

## 동작

- 우하단에 상태가 함께 표시되는 `차감 자동입력` 버튼이 나타납니다.
- 어느 `*.ezwel.com` 페이지에서 누르든 현재 접속한 도메인을 유지한 채 아래 경로로 이동한 뒤 자동 실행합니다.

```text
https://{current-domain}.ezwel.com/pc/customer/welfarecard/subtraction-requisition?topMenuCd=1005171232&hezoMenuCd=1005171236
```

자동화는 여기까지만 합니다.

1. `3개월` 선택
2. `조회하기` 클릭
3. 현재 테이블의 visible row 전부 체크
4. 각 row의 `결제` 금액을 첫 번째 활성 `신청` 입력칸에 입력

마지막 `차감 신청하기` 버튼은 누르지 않습니다.

## 안전 장치

- 로그인되어 있지 않으면 자동화는 멈추고 `로그인 후 다시 실행해 주세요.` 상태를 표시합니다.
- 이미 체크된 row라도 현재 화면 기준으로 다시 덮어써서 최신 조회 결과에 맞춰 입력합니다.
- 두 번째 비활성 입력칸은 건드리지 않습니다.
- 합계가 반영되지 않으면 오류 상태를 표시합니다.

## 현재 확인한 페이지 구조

- 대상 pathname: `/pc/customer/welfarecard/subtraction-requisition`
- 기간 선택: `1개월`, `3개월` 버튼
- 조회 버튼: `조회하기`
- 결과 API: `GET /customer/api/v1/private/welfarecard/subtraction-requisition/list?...`
- 결과 테이블: 첫 번째 `table`
- row 구조:
  - `checkbox` 1개
  - `결제` 금액은 5번째 셀
  - checkbox 체크 후 첫 번째 text input 이 활성화됨
  - 이 활성 input 이 `신청 복지포인트` 입력칸

## 파일

- [ezwel-subtraction.user.js](/home/td/ezwel-deducter/ezwel-subtraction.user.js): 실제 배포용 userscript
- [LICENSE](/home/td/ezwel-deducter/LICENSE): MIT 라이선스
- userscript 자체는 설정 파일을 읽지 않으며, 로그인된 브라우저 세션만 사용합니다.
