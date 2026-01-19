# Google Calendar Sync for Obsidian

Obsidian 데일리 노트와 Google Calendar를 양방향 동기화하는 플러그인입니다.

## 기능

- **Calendar to Obsidian**: Google Calendar 이벤트를 데일리 노트로 가져오기
- **Push to Calendar**: 데일리 노트의 새 이벤트를 Google Calendar에 추가

### 노트 형식

```markdown
## Daily Plan
- 10:00 - 12:00 업무 계획
- 14:00 - 16:00 문서 작성

## Daily Log
- 12:00 - 13:00 점심 [식단]
- 15:00 - 17:00 미팅 [회의]
    - 회의 내용 메모
    - 다음 액션 아이템
```

- **Daily Plan**: 지정된 '계획' 캘린더의 이벤트 (캘린더명 없음)
- **Daily Log**: 나머지 모든 캘린더의 이벤트 (캘린더명 + 설명 포함)

---

## 기술 스택

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian Plugin                          │
│                   (Electron/Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  TypeScript + esbuild                                       │
├─────────────────────────────────────────────────────────────┤
│  googleapis (Google Calendar API v3)                        │
│  @aws-sdk/client-secrets-manager (AWS SDK v3)               │
└─────────────────────────────────────────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│   AWS Secrets Manager   │   │     Google Calendar API     │
│                         │   │                             │
│ Google Service Account  │   │ - calendarList.list()       │
│ Key 저장소              │   │ - events.list()             │
│                         │   │ - events.insert()           │
└─────────────────────────┘   └─────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────────────┐
                              │   Google Workspace          │
                              │   Domain-Wide Delegation    │
                              └─────────────────────────────┘
```

**모든 API 호출은 로컬(사용자 PC)에서 직접 실행됩니다. 별도 서버가 필요 없습니다.**

---

## 인증 흐름

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Obsidian   │     │     AWS      │     │   Google     │     │   Google     │
│   Plugin     │     │   Secrets    │     │   OAuth      │     │   Calendar   │
│   (Local)    │     │   Manager    │     │   Server     │     │   API        │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. GetSecretValue  │                    │                    │
       │ ─────────────────► │                    │                    │
       │                    │                    │                    │
       │ 2. Service Account │                    │                    │
       │    JSON Key        │                    │                    │
       │ ◄───────────────── │                    │                    │
       │                    │                    │                    │
       │ 3. JWT 생성 + 서명 │                    │                    │
       │ ─────────────────────────────────────► │                    │
       │                    │                    │                    │
       │ 4. Access Token    │                    │                    │
       │ ◄─────────────────────────────────────  │                    │
       │                    │                    │                    │
       │ 5. API Request     │                    │                    │
       │ ────────────────────────────────────────────────────────────►│
       │                    │                    │                    │
       │ 6. Calendar Events │                    │                    │
       │ ◄────────────────────────────────────────────────────────────│
```

### Domain-Wide Delegation

- Service Account 자체는 캘린더가 없음
- `subject` 파라미터로 실제 사용자를 "임퍼슨(impersonate)"
- Google Admin Console에서 Service Account에 calendar 스코프 위임 필요

---

## Calendar to Obsidian 워크플로우

```
1. 사용자가 리본 아이콘 클릭 또는 명령 실행
                    │
                    ▼
2. 현재 노트 파일명에서 날짜 추출 (예: "2026-01-19.md")
                    │
                    ▼
3. AWS Secrets Manager에서 Google Service Account 키 가져오기
                    │
                    ▼
4. Google Calendar API 인증 (JWT + Domain-Wide Delegation)
                    │
                    ▼
5. 모든 캘린더에서 해당 날짜 이벤트 조회
                    │
                    ▼
6. 이벤트 분류
   - '계획' 캘린더 → Daily Plan
   - 나머지 캘린더 → Daily Log
                    │
                    ▼
7. 마크다운 포맷 변환 및 노트 업데이트
```

---

## Push to Calendar 워크플로우

```
1. "Push to Calendar" 명령 실행
                    │
                    ▼
2. 노트에서 Daily Plan / Daily Log 섹션 파싱
   정규식: /^- (\d{1,2}:\d{2}) - (\d{1,2}:\d{2}) (.+?) \[(.+?)\]$/
                    │
                    ▼
3. Google Calendar에서 기존 이벤트 조회
                    │
                    ▼
4. 비교 및 동기화
   - 노트에만 있는 이벤트 → 새로 생성
   - 이미 존재하면 → 스킵
                    │
                    ▼
5. 결과 알림
```

---

## 설치

### BRAT 사용 (권장)

1. Obsidian → Settings → Community plugins → BRAT
2. "Add Beta Plugin" 클릭
3. `logos1012/obsidian-google-calendar-sync` 입력

### 수동 설치

1. [Releases](https://github.com/logos1012/obsidian-google-calendar-sync/releases)에서 `main.js`, `manifest.json` 다운로드
2. Vault의 `.obsidian/plugins/google-calendar-sync/` 폴더에 복사
3. Obsidian 재시작 후 플러그인 활성화

---

## 설정

Settings → Google Calendar Sync

| 설정 | 설명 |
|------|------|
| AWS Access Key ID | AWS 자격 증명 |
| AWS Secret Access Key | AWS 자격 증명 |
| AWS Region | Secrets Manager 리전 |
| AWS Secret Name | Service Account 키가 저장된 시크릿 이름 |
| Impersonate Email | Google Workspace 사용자 이메일 |
| Plan Calendar ID | '계획' 캘린더 ID |

---

## 사전 요구사항

1. **Google Cloud Project**
   - Google Calendar API 활성화
   - Service Account 생성 및 JSON 키 발급

2. **Google Workspace Admin**
   - Domain-Wide Delegation 설정
   - Service Account Client ID에 `https://www.googleapis.com/auth/calendar` 스코프 위임

3. **AWS**
   - Secrets Manager에 Service Account JSON 키 저장
   - IAM 사용자에 Secrets Manager 읽기 권한

---

## 보안

```
Layer 1: AWS 자격 증명
├── Obsidian 설정에 로컬 저장 (data.json)
├── Git에 커밋되지 않음
└── IAM 정책으로 최소 권한 설정 가능

Layer 2: Google Service Account 키
├── AWS Secrets Manager에 암호화 저장
├── 런타임에만 메모리에 존재
└── 코드에 하드코딩되지 않음

Layer 3: Google API 접근
├── Domain-Wide Delegation으로 특정 사용자만 접근
├── calendar 스코프만 허용
└── Google Admin Console에서 관리
```

---

## 파일 구조

```
src/
├── main.ts              # 플러그인 진입점, 명령어 등록
├── settings.ts          # 설정 UI
├── google-calendar.ts   # Google Calendar API 래퍼
├── parser.ts            # 노트 ↔ 이벤트 변환
└── types.ts             # TypeScript 타입 정의
```

---

## License

MIT
