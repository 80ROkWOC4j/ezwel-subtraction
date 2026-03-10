# ezwel-deducter

`Violentmonkey`/`Tampermonkey`에 넣어 사용하는 EZWEL 차감신청 userscript입니다.

현재 접속 중인 EZWEL 도메인의 복지카드 차감신청 화면을 대상으로 동작합니다.

## 설치

1. 브라우저에 `Violentmonkey` 또는 `Tampermonkey`를 설치합니다.
    > https://violentmonkey.github.io/get-it/
3. https://greasyfork.org/ko/scripts/569046-ezwel-subtraction-autofill 에서 설치합니다.
4. 로그인된 `https://*.ezwel.com/*` 탭에서 사용합니다.

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
