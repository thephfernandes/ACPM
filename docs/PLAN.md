# ACPM Flight Schedule: Evaluation and Plan

_Evaluated at commit `9b5de75` (2026-11-09). Live at https://gdruumond.github.io/ACPM/_

## 1. What the app is today

A single file, `index.html`, of about 3,200 lines (125 KB). It holds the CSS, the markup and around 2,300 lines of vanilla JavaScript. It has no build step, no dependencies besides jsPDF (from cdnjs) and Google Fonts, and no tests. GitHub Pages serves the file as it is.

The app plans **tomorrow's flight schedule** for the ACPM flight school (CIAC). It has six tabs:

| Tab | What it does |
|---|---|
| 1 · Recursos | Turns the 9 daily time slots (06:30 to 17:30, night slot) on or off, and the fleet (13 × C152, 6 × C172, 3 × PA-34, 4 simulators). This is how an aircraft is marked as in maintenance. |
| 2 · Instrutores | The 40 instructors: active flag, level A01–A09, weight, availability per slot. |
| 3 · Alunos | Students: name, weight, and instructors they must not be paired with. |
| 4 · Demanda | Each student's requests for the day. A student can have several missions (Ground + flight + night), each with a mission type, aircraft, 2 preferred slots, hours, sessions and priority. |
| 5 · Escala | Generated schedule: an official table, a timeline by aircraft or by instructor, a status per flight (Confirmado / Em Voo / Pendente / Cancelado), the day's change log with revert, and CSV and PDF export. |
| 6 · BI | Utilisation dashboard built from saved past days, with a "simulate 30 days" button, and the user manual. |

### Key functionality worth protecting

- **`runAllocationEngine(state)`** (around line 1498, 380 lines). This is the core of the app: a deterministic greedy scheduler. It already enforces:
  - Ground School before flight: a 90-minute class shared by several students with one instructor. A student's Ground is scheduled before that student's flight on the same subject.
  - The cumulative instructor level matrix (A01–A09) per mission and per aircraft, choosing the **lowest qualified level** so senior instructors stay free.
  - Crew weight limits: C152 170 kg, C172 222 kg, PA-34 250 kg.
  - The PR-JPL acrobatic aircraft is used only for Parafuso (spin) missions, by A06+ instructors.
  - Student/instructor block lists, instructor slot availability, no double-booking of a student, and priority ordering.

  It is a **pure function of `state`**, which makes it easy to extract and test. That is the most important property to keep.
- **Operador / Gestor roles.** Gestor is read-only. A "share" link puts the whole day's state into the URL as base64 and opens it locked in Gestor mode.
- **Undo** (30 steps) and an **audit log** with per-entry revert.
- **The `ApiClient` object** is already an async storage layer. Its `REMOTE_ENDPOINT` hook does `GET`/`PUT /state`. The author planned for a backend, and this is the point where one can be plugged in.

## 2. Problems found

### Data and storage (the main issue)
1. **All data lives in one browser's `localStorage`** under these keys: `acpm3` (state), `acpm3_res` (last result), `acpm3_audit`, `acpm3_bi`, `acpm3_theme`. Because of that:
   - Two operators on two machines see two **different** rosters and schedules.
   - Clearing the browser or switching computers loses everything, including BI history.
   - The share link is the only way to hand off data. It is a snapshot, so it goes stale as soon as the operator changes anything.
2. **Only one "current day" exists.** Changing the date does not load that date's schedule; the result is simply overwritten. BI history keeps copies per date, but they cannot be edited.
3. **No concurrency model.** `saveState` writes the whole state blob. With a remote backend added naively, the last writer wins and silently overwrites a colleague's changes.
4. **BI history grows without limit** in `localStorage`, which caps at about 5 MB per origin.

### Security and privacy
5. **Personal data is in a public repository.** The full names and body weights of all 40 instructors are hardcoded in `INS_DATA`, and the repo is public on GitHub. Weight counts as personal data under the LGPD, so this should be moved out of the source and out of the git history.
6. **The Gestor lock works only in the browser.** Removing `?share=` from the URL gives full Operador mode. That is harmless today because every browser has its own data. **Once storage is shared, it becomes real write access for anyone with the URL.** A shared backend therefore requires authentication.
7. **The share link carries student names and weights** in a readable base64 query string. That data ends up in chat apps and browser history.

### Code health
8. **Instructor levels are placeholders.** Fresh state assigns `lv: (i % 9) + 1`, so instructor levels cycle by alphabetical order. The real levels exist only in someone's `localStorage`.
9. **The whole file is uploaded through the GitHub web UI.** Commit `9b5de75` rewrote all 3,236 lines because of a line-ending change (CRLF to LF), so `git diff` and `git blame` are useless across it.
10. **Business rules are spread across separate constants:** `MIS`, `EQ`, `EQ_MIN_LV`, `DEFAULT_LIM`, the fleet registrations and `INS_DATA`. Changing the fleet or a rule means editing code.
11. **No tests for the scheduler,** even though it is pure and fully deterministic.
12. Leftover code from being generated as a Claude artifact (the `window.claude` downloads path in `sv()`). It is harmless and can be removed.

## 3. Storage options

The data is small and document-shaped: one roster (about 50 KB), one schedule per date, the audit entries and BI history. Writes come from 1 to 3 operators and reads from a few managers. The requirements in order of importance:

1. One shared source of truth.
2. Real authentication, so Operador and Gestor are enforced on the server.
3. History per date.
4. Free or near free.
5. Stays compatible with GitHub Pages.

| Option | Fit | Effort | Auth | Cost | Notes |
|---|---|---|---|---|---|
| **Supabase** (Postgres + Auth + row-level security, used as JSON documents first) | ★★★★★ | Medium | Built in (email magic link / Google) | Free tier | Can start as "documents in a table" (`jsonb`) so the data model barely changes, then normalise later. Realtime updates are possible. Calls go straight from GitHub Pages, with no server to run. |
| **Google Sheets + Apps Script** web app | ★★★★ | Low–Medium | Google accounts | Free | Staff can edit the roster and fleet in a spreadsheet they already know. Slow (1–3 s per call), weak concurrency, and Apps Script quotas apply. Fits well if the school already runs on Google Workspace. |
| **Cloudflare Worker + KV or D1** | ★★★★ | Medium | DIY or Cloudflare Access | Free tier | Matches the existing `REMOTE_ENDPOINT` `GET`/`PUT /state` contract almost exactly. Auth, ETags and backups would have to be built. |
| **JSON files in a GitHub repo** via the GitHub API | ★★ | Low | GitHub tokens per user | Free | Version history comes for free. However, each operator needs a GitHub account and token, commits per change are clumsy, and **a public repo means public data.** |
| Firebase Firestore | ★★★★ | Medium | Built in | Free tier | Comparable to Supabase. Supabase wins on SQL for BI queries and on data portability. |

**Recommendation: Supabase**, used in stages:
- **Start document-style:** a `docs` table with columns `key`, `jsonb`, `version` and `updated_by`. This keeps the existing `ApiClient` shape and the "not necessarily a database" spirit.
- **Normalise later**, once the shape stabilises: `instructors`, `students`, `fleet`, `demands`, `schedules(date)`, `flights`, `audit`. That turns BI into plain SQL instead of re-parsing JSON blobs.

**Fallback:** choose Google Sheets if the people who maintain the roster are not technical and need to edit it in a spreadsheet.

## 4. Plan

### Phase 0: Make the repo workable (done on branch `fase-0`, no behaviour change)
- [x] Workflow: `.gitattributes` (`* text=auto eol=lf`), `.nojekyll`, a README, and a GitHub Actions workflow that runs every test on each push and PR. Gabriel still needs to agree to branches + PRs instead of uploading through the web UI.
- [x] Split `index.html` (now markup only) into `css/app.css` and native ES modules with no build step: `js/config.js`, `rules.js`, `format.js`, `engine.js`, `storage.js`, `state.js`, `actions.js`, `dom.js`, `export.js`, `main.js` and `js/views/*.js`.
- [x] Moved the rules data into `js/config.js`.
- [x] Tests, written before each extraction:
  - **Unit (node:test), 123 tests:** scheduler rules from the in-app manual, invariants over 300 random scenarios, and outputs recorded from the original engine for 41 scenarios (golden master). Also the storage layer: schema migrations, persistence and the share link.
  - **E2E (Playwright), 30 tests:** record the original page's behaviour: navigation, registration, demand, schedule, CSV/PDF, Gestor/Operador, share link, undo, history and BI. They use a synthetic roster and a fixed clock, and need no network.

#### Found during Phase 0 (not changed then, because Phase 0 keeps behaviour identical)
1. **Session/aircraft rotation.** A student's next session, or next mission that day, switches instructor and aircraft whenever another is free. *Gabriel: intentional, so a student doesn't fly all day with one instructor. But each instructor should stay on the same aircraft for the day.* That second rule was added in Phase 1.
2. **One Ground room, no capacity limit.** Different Ground subjects could run at the same time, all in `SALA-GROUND`. *Gabriel: there is only one room.* Fixed in Phase 1.
3. **Unescaped HTML from the share link.** Fixed in Phase 1. It was broader than the alert messages: ids, level, weight, priority and flight status also reached HTML attributes unvalidated.
4. **jsPDF 2.5.1 advisories.** Upgraded in Phase 1.
5. Dead code: `totF_M` in the BI, and the `window.claude` download path left over from a Claude artifact. Still open.

### Phase 1: Security fixes and Gabriel's operating rules (done on branch `fase-1`, built on `fase-0`)
Each item was written test-first and has its own commit.
- [x] **Share-link validation.** Only these values are accepted from the link: integer ids, levels A01–A09, numeric weights, mission fields within the UI's ranges, known flight statuses, existing registrations and an `AAAA-MM-DD` date. Lists have size caps. Alert messages are escaped. Mission lookups only match real missions, so names like `constructor` no longer break normalisation. Before the fix, a forged link ran script through the id, level, weight, priority and status fields; an E2E test now proves it doesn't.
- [x] **One Ground room.** A new class opens only when the room is free for the full 1h30; same-subject students still join the open class. In the 41 recorded scenarios, the 27 that had overlapping classes changed. In the example, the Ground C152 class moves from 06:30 to 08:20 and its dependent flights from 08:20 to 10:10.
- [x] **Instructor keeps the same aircraft all day,** per aircraft type, after the student's instructor rotation. Extra aircraft per instructor per day in the recorded scenarios fell from 114 to 20, with no change in rejections.
- [x] **jsPDF 4.2.1 + AutoTable 5.0.9** with SRI (`integrity` + `crossorigin`). `npm audit` is clean. The PDF test now checks content and page count.
- Moved to Phase 2: taking the instructor roster out of `js/config.js`. Gabriel considers the public names and weights irrelevant, so there is no history rewrite and no private repo.

### Phase 2: Shared storage (merged as PR #4; live in production since 2026-11-10)
Decisions: email + password accounts created by the admin (no open sign-up, no email service needed); read-only Gestor logins; a separate Supabase project for the preview and the database tests.
- [x] Supabase projects provisioned: `acpm-escala` (production, still empty) and `acpm-escala-preview` (preview and tests), São Paulo, Free plan.
- [x] Schema with row-level security (`supabase/migrations`): `perfis` (operador | gestor); `documentos` for the same four keys as `localStorage`, readable by any account with a profile; writes only through `salvar_documento` (Operador only). Covered by 24 pgTAP checks (`npm run test:db`, preview project only).
- [x] **Optimistic concurrency:** each save sends the version it read. A stale version gets HTTP 409, and the app shows "a colleague changed this, reload" instead of silently overwriting. Saves of the same document go one at a time.
- [x] `ApiClient` reads and writes through a swappable backend: `js/backends/local.js` (`localStorage`, used on localhost) and `js/backends/supabase.js` (the published sites).
- [x] Login screen (email + password). The role comes from the account's profile, and the role picker is hidden.
- [x] Share links carry only the date (`?data=AAAA-MM-DD`); the person opening one logs in with their own account. Old `share=` links are ignored when logged in.
- [x] One-time upload: an Operador's first login to an empty server offers to send that browser's data (roster with the real levels, demand, schedule, history and BI).
- [x] The roster left the code (`INS_DATA` removed). Fresh state has no instructors; "Preencher exemplo" creates fictional ones.
- [x] Preview: demo accounts `operador.previa@example.com` and `gestor.previa@example.com` (passwords in Pedro's Keychain) and 40 fictional instructors. A real-login smoke test runs against it (`test/e2e/publicado.spec.js`).

#### Go-live checklist (production: `acpm-escala`)
1. [x] Schema and auth config applied to production (2026-11-10): migration `20261110191032_documentos_e_perfis`, sign-up off. Pool sizes are left to each project (`config.toml` no longer manages them).
2. [x] Personal Operador accounts created for Gabriel, Pedro and Rayane, and checked with a real login. Passwords are in Pedro's Keychain; he sends them privately.
3. [x] Phase 2 merged (PR #4). The site now asks for a login.
4. [x] First login and upload done by Rayane, the master operator, from her browser (2026-11-10): roster with the real levels, schedule, 100 history entries and 4 BI days.

### Phase 3: Data model that matches the job (merged as PR #5; live in production since 2026-11-10)
Decisions: a new date starts as a copy of the previous saved day (demand and availability, without flight statuses or the generated schedule); no realtime updates for now; the 100 history entries from Phase 2 are imported.
- [x] **Roster separate from the day.** The roster (instructors and students: names, levels, weights, blocks) is one shared `cadastro` document. Each date is a row in the new `dias` table with its time windows, aircraft and instructor availability, demand, flight statuses and generated schedule. Operators working on different dates no longer conflict, and the roster is saved only when it changes. Writes go through `salvar_dia`, with the same optimistic concurrency as Phase 2.
- [x] **The date picker opens that date.** A date without a schedule starts as a copy of the previous saved day; nothing is saved until someone edits it. Edits always go to the date that is open, even while another date is loading. In shared mode the Gestor can browse dates too (read-only).
- [x] **Append-only history table** (`historico`): date, time, author, type and description, written only by Operadores through `registrar_historico`. Reverting adds an entry that points at the reverted one, so nothing is deleted. This replaces the 100-entry cap. 38 pgTAP checks cover `dias`, `historico` and the guard below.
- [x] **BI from stored schedules.** The dashboard reads the saved schedule of each date in the period (the month, plus the 7 days before the chosen date). With one row per date the volume is small, so it is computed in the browser, without a separate flights table or SQL views. The "simulate 30 days" demo and the clear buttons stay in local mode only.
- [x] **One-time conversion of the Phase 2 documents** on the first Operador login after the deploy. The roster becomes `cadastro`. The current schedule and the BI days become `dias` rows; the schedule's date comes from the schedule itself, or from the BI day with the same flights, or else it is tomorrow. The history entries are imported, marked as imported and with their original time when it is known. The old documents stay as a backup. Local mode converts the browser's data the same way.
- [x] **Old tabs can't lose edits.** After the conversion the Phase 2 documents are read-only: a tab still running the previous version gets the "reload" warning on its next save, instead of saving where nobody reads.
- Not now: realtime updates for Gestor screens (decided 2026-11-10).

#### Go-live checklist (production: `acpm-escala`)
1. [x] Migrations applied to the preview (`20261110201618_dias_e_historico`, `20261110202010_historico_autor`, `20261110205345_documentos_antigos_somente_copia`); database tests pass (24 + 38).
2. [x] The same three migrations applied to production (2026-11-10), before the merge. They only add tables and functions, and the guard only acts once `cadastro` exists, so the Phase 2 site keeps working.
3. [x] Phase 3 merged (PR #5).
4. [x] Production data converted on 2026-11-10 by a supervised Operador login: roster (39 instructors, 50 students), the current schedule (2026-11-11), three BI days and the 100 history entries. The old documents stay as a backup.

### Phase 4: Field feedback from the operator and Gabriel (branch `fase-4`)
Source: field tests with the master operator at the aeroclub. **Hard rule: no change may reset, delete or corrupt saved data.**
Decisions (2026-11-10): the qualifications get a "C172" box (migrated from A07+); "Voo de Parafuso" and "Parafuso (SPIN)" are one box; each aircraft's 50-hour balance carries over automatically and stays editable; a new "Secretaria" profile writes only in the Agenda, and only Operadores can use the 13:00 exception.

Each step is test-first and updates the preview. Delivery in about three PRs (steps 0–2, 3–5, 6–8), opened when Pedro says.
0. [x] **Phase 3 follow-ups.** A conversion that fails halfway stops the app with a reload message, instead of opening an empty roster that the next edit would save. "Sair" signs out only this browser (Supabase signs out every device by default).
1. [x] **Versioned data migration at startup.** The saved roster and each day carry a format version. Reads upgrade any older format in memory, so the app never works with an old shape. On an Operador's first start, every saved day and then the roster are rewritten in the new format, with the roster last as the completion marker. The server refuses a document in an older format than the stored one, so a tab running the previous version asks to reload instead of overwriting. First change: the simulators are renamed (SIM-MONO-1/2 → SIM-MONO-A/C, SIM-MULTI-1/2 → SIM-MLTE-E/D) in availability, schedules and BI days.
2. [x] **CSV for the booking portal**, grouped by aircraft and in time order within each: Avião/Equipamento, Horário, Aluno, Fase/Missão, Instrutor and Observações (crew weight against the aircraft limit, missing weights, 50-hour stop).
3. [x] **Individual qualifications replace the cumulative levels A01–A09.** A checkbox grid: Grounds (C152, C172, Navegação), Ground PA-34, Simulador Mono, Simulador Multi, TGL (TMA), Voo Local, Navegação, Liberação de Solo, Parafuso (SPIN), IFR, Noturno, C172, MLTE (PA-34) and the three checker boxes. The migration gives each instructor exactly what their level allowed (A03+ also gets TGL), so schedules don't change; the checker boxes start unmarked. Ground classes go to the least-qualified free instructor.
4. [x] **New missions:** TGL (TMA) and five check flights (Cheque PP, PC MNTE VFR, PC MNTE IFR, PC MLTE VFR, PC MLTE IFR), each requiring the matching checker boxes.
5. [x] **Aircraft continuity:** after allocation, each aircraft type's tail numbers are redistributed with the instructor as the unit. An instructor gets one tail number free at all their times whenever one exists; only the tail number changes, never the student, instructor or time. In the recorded scenarios, same-type aircraft switches fell from 18 to 9, with the same flights and rejections. The 9 left are unavoidable: 3 are spin flights, which must use PR-JPL, and an exhaustive search shows the other 6 (PA-34) cannot be reduced without changing who flies when. An invariant over 300 random days guards the rule.
6. [x] **50-hour inspection:** hours since the last inspection for each aircraft in Recursos. They carry over from the previous day minus its flights that weren't cancelled, stay editable, and "Revisão feita" resets them. The engine never plans more than the remaining balance; an aircraft that runs out stops for the rest of the day, with "Aeronave parou para revisão de 50 horas" in the schedule, Recursos and the CSV.
7. [x] **Rodízio:** four queues (Cheque, MLTE PA-34, Noturno, C172; a flight counts in the first that applies). The engine offers each flight following the queue order. Whoever flew a category goes to the end of that queue the next day; cancelled flights don't count. A new tab shows the queues, with buttons to move people.
8. [x] **Agenda de Solicitações:** a new tab with a calendar for any day. The server enforces the 13:00 rule in São Paulo time: the next day only until 13:00, then two days ahead onwards. Operadores have a flagged "Exceção da Coordenação". Each request records the student, mission, availability (Manhã, Tarde, Noite or a specific time), "Registrado por" (required), the account and the time. "Importar Solicitações da Agenda" in Demanda loads that date's requests, and the availability becomes a hard limit for that flight.

#### Go-live checklist (production: `acpm-escala`)
1. [x] Migrations applied to the preview: `20261110213600_formato_nao_regride`, `20261110222505_perfil_secretaria` and `20261110222506_agenda_de_solicitacoes`; database tests pass (24 + 28 + 38 + 9).
2. [x] The same three migrations applied to production (2026-11-10), before the merge. They only add a profile, a table and functions; the format guard only acts on data that already has a format version, so the Phase 3 site keeps working.
3. [x] Secretaria accounts: none for now (decided 2026-11-10); Operadores register requests in the Agenda. Create them later with `scripts/criar-conta.mjs <email> secretaria "<nome>"`.
4. [ ] Merge Phase 4. The first Operador login updates the saved data to format version 10: simulators renamed, qualifications from the levels (checker boxes unmarked), and the new per-day fields. Anyone with the site open since before the merge gets the "reload" warning on their next save.
5. [ ] The operator marks the checkers (and reviews the qualifications) in Instrutores, types each aircraft's hours since the last 50-hour inspection in Recursos, and reviews the Rodízio queues (they start in roster order).

### Phase 5: Accounts and administration (merged as PR #7; live in production since 2026-11-11)
Request (2026-11-11): an account page where each person changes their own email and password, and an Administrador profile that creates and deletes accounts.
Decisions: the Administrador does everything an Operador does, plus account management; email changes are confirmed by links to the old and new address, sent through custom SMTP (a Gmail account with an App Password); Pedro, Rayane and Gabriel become Administradores in production.
- [x] **Administrador profile.** In the rules for writing schedules, the agenda and the history, it counts as an Operador; only it can list, create and delete accounts (`listar_contas`, `criar_conta`, `excluir_conta`). Nobody can delete their own account, so at least one administrator always remains. Deleted accounts keep their history and agenda records, which store the author's name. 28 pgTAP checks, plus a real-login check on the preview: an account created by the function logs in, and after deletion it can't.
- [x] **Minha conta:** change the password (the current password is checked first; at least 12 characters) and request an email change (confirmed by links sent to both addresses). Coming back from a confirmation link, the app says what happened: the other link is still missing, the change is complete (already signed in with the new email), or the link expired or was already used (the session in that browser is kept).
- [x] **Usuários** (in Minha conta, Administradores only): the list of accounts with their last access, a form for a new account with a password generator, and deletion with confirmation.
- [x] **Auth config on the preview:** custom SMTP (a Gmail account with an App Password, read from the Keychain at `supabase config push` so neither is in the repo), the email-change message in Portuguese (`supabase/templates/troca-de-email.html`) and `minimum_password_length = 12`. Checked live: a real email-change request was accepted and the emails were sent.
- [x] **Production, before the merge (2026-11-11):** the same Auth config and the two migrations (`perfil_administrador`, `contas_e_administracao`). Both keep the current app working; checked with an Operador login on the live site (no writes, no errors).
- [x] **Production, after the merge (2026-11-11):** Pedro, Rayane and Gabriel are Administradores (promoted 10 minutes after the deploy, once no browser could still be running the old login code); checked live.

### Phase 6: Field feedback 2: automatic schedule, manual and usability (branch `fase-6`)
Request (2026-11-11): remove "Preencher exemplo"; study and build schedule generation in the background, so the schedule is ready when the operator opens the Escala tab and "Gerar escala" can go; rewrite the outdated manual for a new operator and the manager; audit the usability and interface and refactor the design.
Decisions: the audit comes first and Pedro and Gabriel approve the redesign; two PRs (PR 1: the first three items; PR 2: the redesign); the manual gets its own page.
- [x] **"Preencher exemplo" removed.** The example demand lives on only in the tests (`test/helpers/exemplo.js`, the same sequence), loaded straight into the browser; the reference schedules did not change.
- [x] **Automatic schedule.** Feasibility: the engine takes under 2 ms for 47 flights and 40 instructors (median 0.4 ms over 41 scenarios), so the schedule is simply recalculated after every change, with no background worker. Every change by an Operador or Administrador saves the data and the schedule together. A date with no saved schedule yet (for example, a new date copied from the previous one) shows the calculated schedule right away, for everyone, and is saved with the first change or when the CSV or PDF is exported, so it counts in the BI and in the next day's hours and Rodízio. Opening a date still writes nothing.
- [x] **Manual** on its own page (the "Manual" button in the header): first steps (the daily routine), profiles, each tab, how the schedule is built, a section for the manager and FAQ. The rule tables (missions, equipment and required qualifications, windows, weight limits, Rodízio categories) are generated from the code (`js/manual.js`), so they change with the rules.
- [x] **Usability audit** for Pedro and Gabriel (a shared document: findings by severity, before/after prototype and measurements). PR 1 merged as PR #8 (2026-11-11).
- [x] **Redesign approved in full** (2026-11-11): all 10 increments go into PR 2 (branch `fase-6-redesenho`). The engine, the data, the PDF and the CSV do not change. PR 2 merged as PR #9 (2026-11-11).
    1. [x] Visual base: white panels, lighter borders, light table headers, tags in sentence case, line icons instead of emoji.
    2. [x] Header, global date and navigation: the date always on top, tabs in the order of use with attention badges, account menu, the app opens on Escala.
    3. [x] History as a side drawer over any tab; the "Inclusões na Escala" list goes.
    4. [x] Escala on the desktop: grouped errors and warnings, List / By aircraft / By instructor, one line per flight, Ground classes in one line, discreet status.
    5. [x] Escala on the phone (one card per flight) and no sideways scrolling (map and BI).
    6. [x] Demanda: "Só quem voa" on, import with the number of requests, 10 columns that fit, quiet fields, "Limpar demanda" in a menu.
    7. [x] Recursos: one fleet table with availability, hours and balance until the 50-hour inspection.
    8. [x] Instrutores: a day-availability grid and a registry table with an edit panel.
    9. [x] Small items: Agenda shows whether each request is already in the Demanda; Alunos as a table; compact Rodízio; BI in one column on the phone; the Secretaria sees only Agenda and Escala.
    10. [x] Accessibility and wording: labels for screen readers, 44 px touch targets on the phone, the Manual with the new names.
- [x] **Adjustments from the preview review** (2026-11-11, after PR #9, branch `fase-6-ajustes`): the Demanda loses "Sessões" (one session per mission; to split a flight, "+ missão"; old requests with 2 or 3 sessions become one), no Undo button (change the field back; some changes also revert from the Histórico), the date control keeps a fixed width, the theme is a sun/moon switch, and the ACPM eagle is the favicon and the header logo, aligned with "Escala de Voo" and "ACPM".
- [x] **More review adjustments** (2026-11-11, same branch): a category filter (Todos, C152, C172, Simulador, PA-34, Sala Ground) in Escala and in Recursos (there without Sala Ground, which has no availability control); in Escala the "Avião / sala" filter, also "Todos" by default, lists only the chosen category; each time window of the Lista and each fleet category collapse and expand; the PDF and CSV feedback is a temporary notification instead of a fixed text.
- [x] **The app is renamed AutoEscala - ACPM** (2026-11-11, same branch): page title and metadata (application name, home-screen title, description), the header (the eagle and "AutoEscala", without the small "ACPM"), the Manual, README, package.json, the PDF's creator metadata (its heading stays "Escala de Voo - ACPM": it is the flight schedule) and the email-change email (sender, subject and text; the hosted Supabase config still needs a `config push`, preview and then production). "Recurso" replaces "avião e sala" in the Escala ("Por recurso", the "Recurso" filter and column), Demanda, Recursos and BI, whose filters now follow the Escala (Categoria and, within it, Recurso). The Manual's cards match the other pages' width, success notifications are larger and green, and "Atualizada às" sits discreetly next to the Escala title, with a clock.

### Phase 7: Field feedback 3: the fleet in the data, start times per category and an even split (requested 2026-11-12)
Decisions (Pedro, 2026-11-12): start times are a list per category, edited in Recursos (PA-34 every 30 minutes); the even split rebalances the schedule after it is built, by hours in the day; Operadores and Administradores add and retire resources. All three in one PR (branch `fase-7`), in this order:
- [x] **Part 1: add and retire resources**. The fleet leaves the code (`EQ` in `config.js`) and moves into the `cadastro` (data format 11; the server guard needs no change): each resource has a registration, a category (C152, C172, PA-34, Sim. Mono, Sim. Multi) and, for an aerobatic C152, "Só Parafuso". The weight limit and the 50-hour control come from the category. Recursos gets "+ Novo recurso" and "Retirar"; the engine, the filters, the BI, the CSV and the PDF read the fleet from the data, and a retired resource keeps its history in the BI.
- [x] **Part 2: start times per category**. Each category has its own list of start times, edited in Recursos (default: today's 9; PA-34 every 30 minutes). A student's preferred times, the availability and the Agenda's time options follow the requested category; the instructor's availability keeps its 9 windows and is checked over the flight's whole interval.
- [x] **Part 3: an even split by hours.** After the schedule is built, missions move from the instructors with the most hours to those with the fewest whenever every rule still holds (qualifications, availability, weight, rodízio, the student's blocks and the instructor's aircraft). No mission is dropped.

- [x] Also fixed in Part 3: a student could join a Ground class already open outside the student's availability (since Phase 4). None of the 41 approved schedules hit it.

### Phases 8–15: the board's notes (2026-11-13)
The ACPM board reviewed the app and left 17 notes. Decisions (Pedro, 2026-11-13):
- **Gaps:** the operator switches what wins when closing idle gaps: the INVA's day (default), the aircraft's, or the biggest gap first. A second switch sets whether a flight may change time: within the student's availability (default), only between the 1st and 2nd preference, or never. The even split of hours holds in every mode.
- **Hangar:** the order front to back is a list per day, carried to the next day and editable.
- **Personal data** (CPF, CANAC, birth date, mobile, e-mail): Operadores, Administradores and the Secretaria see and edit it; it lives in a separate table protected on the server, never in the roster, links, exports or history.
- **Legal limits:** the engine blocks. The defaults come from Lei 13.475/2017 and RBAC 117 Appendix A (which covers RBAC 141 schools): 9h30 of flight per duty, 11 h of duty, 100 h a month, 960 h a year, 12 h of rest. The Administrador can change them; the semester limit starts empty (the law has none).
- **Reception TV:** its own "Painel" account, which reads only the day's board.
- **Courses:** the syllabus (PP, PC, INVA) is kept in the app; the operator records aprovado or reprovado.
- **CAVOK and Plane It:** neither has a public API. Discovery first; meanwhile, file import and export.

One PR per phase, opened when Pedro says. Each phase starts from the upstream `main`.

#### Phase 8: Escala do dia (branch `fase-8`)
1. [x] **The map popup no longer disappears.** It was cut off by the map panel, which scrolls sideways, so on the first rows it vanished under the filters and the header. Now there is a single popup, fixed on the screen: a click (or Enter) on a flight opens it, always whole and on top; Esc returns to the flight and a click outside closes it. A cancelled flight's popup is no longer faded, and the Gestor can't change the status in it.
2. [x] **Flight status with details** (data format 13: each day keeps `fObs`, the detail of each flight's status; no SQL change). The statuses are now Pendente, Confirmado, **Atrasado**, Em Voo and Cancelado. Atrasado asks for the new take-off time (after the original one); Cancelado asks for the reason (Meteorologia, Manutenção da aeronave, Aluno ausente, Instrutor indisponível, Operacional, or Outro with a short description). Voltar or Esc keeps the previous status. The detail shows under the status, in the list and in the map popup, and a click on it changes it. A delay that runs into another flight of the same aircraft, instructor or student becomes a warning ("1 atraso com conflito"); the schedule itself doesn't move. The CSV shows the status with its detail and the PDF gains a Status column. The history records only the reason's category (never the free text), and the Gestor link carries the category and the time, never the text.
3. [x] **"Painel" view: departures and arrivals like an airport** (as the INFRAERO boards Pedro sent as the reference, 2026-11-13). *Partidas* lists every departure of the day (and the start of each Ground class) and *Chegadas* what hasn't landed or ended yet, each in the order of the expected time: scheduled time, mission (both in yellow), model (a coloured badge, like the airlines' logos), registration, student (for Ground, only how many), instructor, the expected time when delayed, and the remark in the colour of the status (a cancellation with its reason). The two boards alternate page by page every 10 seconds, with the clock and the page number in the corner; buttons show only one board, pause the change and open it full screen (for a monitor or TV). The board only displays; the status changes in the List and the map. A flight in the air stays among the arrivals until its status changes; a cancelled one stays until its time passes. The rows come from `js/quadro.js` and the board from `js/views/painel-aeroporto.js`, which the reception TV (Phase 9) will reuse. Also: a delay that runs into a whole Ground class counts as one warning, and up to 1400 px wide the view buttons drop their icons so the Escala bar stays on one line.

#### Phase 9: Access, personal data and the reception TV (branch `fase-9`, on top of `fase-8`)
1. [x] **Read rules by profile** (migration `leitura_por_perfil`): only the schedule's profiles (operador, administrador, gestor and secretaria) read the documents, days, history and Agenda, through `le_a_escala()`; before, any account with a profile could. Nothing changes for them; the TV's profile (step 3) reads none of it. 29 database checks; applied to the preview.
2. [x] **Personal data of students and instructors** (migration `dados_pessoais`): CPF, CANAC (ANAC code, 6 digits), birth date, mobile (area code + 9 digits) and e-mail, in a separate table that only operadores, administradores and the secretaria read and that only `salvar_dados_pessoais` writes. The server checks everything again: the CPF check digits, the formats, a birth date between 1900 and today, and no CPF or CANAC repeated among students (or among instructors; an instructor may share a student's CPF, the same person). Saving with every field empty deletes the person's data. In the app, a "Dados pessoais" button on each row of Alunos and of the instructors' registry opens a side panel; the tables gain a CANAC column; the Secretaria now also sees Instrutores and Alunos (read-only, except the personal data). The data never enters the roster, the share link, the CSV, the PDF or the BI, and the history records only which fields changed. 36 database checks; applied to the preview.
3. [x] **Reception TV** (migrations `perfil_painel`, `painel_do_dia` and `nome_curto_com_numero`): a new profile, "Painel (TV da recepção)", created by an Administrador in Usuários, that reads none of the schedule's tables and sees only today's board (São Paulo time) through `painel_do_dia()`: the flights with the student abbreviated ("Maria S."; a trailing number stays whole, "Aluno 12"), the instructor, mission, resource and times, each status, and from the status detail only the new time and the reason's category (never the free text). `painel.html` shows the same departures and arrivals board as the Escala's Painel, full screen and without buttons (Pedro, 2026-11-13: no ±1 hour rule); it fetches the board every minute, warns after 3 minutes without a connection, reloads at 03:00 and keeps the screen awake. A TV account that opens the app goes straight to the board. Without a server (local mode), the page reads today's saved day in that browser. 23 database checks; applied to the preview.

#### Phase 10: Engine rules, fuel and hangar (branch `fase-10`, on top of `fase-9`)
1. [x] **One feasibility module** (`js/viabilidade.js`): overlapping times, a free resource, the instructor available during the whole flight, the weight limit and the 50-hour balance were written again in each engine pass (allocation, the even split and the tail swap); now they come from one place. No schedule changes: the 41 reference schedules and the 300 invariants stay the same.
2. [x] **Schedule metrics** (`js/metricas.js`) and `scripts/medir-escalas.mjs`, which compares the 41 reference schedules with the current engine and prints the table for the commit: aircraft used against the minimum possible (the peak of simultaneous flights), hangar exits (one per stop of 2 h or more), idle time of aircraft and instructors, the balance of hours, preferences met and tail switches. Baseline: 305 aircraft used for a minimum of 214, 394 hangar exits, 443.7 h of idle aircraft and 508 h of idle instructors.
3. [x] **Fuel and the weight limit** (`js/combustivel.js`; board item 7). The weight limit (student + instructor) holds with full tanks: C152 26 gal and 4 h, C172 53 gal and 6 h, PA-34 93 gal and 4h30 (1 gal = 6 lb). When no instructor fits with full tanks at any time, the engine may schedule the flight with less fuel, as long as what is left covers the flight, 10 minutes of taxi and the reserve (30 minutes by day; 45 at night and in IFR, RBAC 91.151 and 91.167); everything rounds to the safe side. The list shows "reduzir N gal" (the tip says how much to put in and the endurance), as do the map popup, the CSV and the PDF; the Manual's table comes from the rules. The even split never creates or increases a reduction. None of the 41 reference schedules changes.
4. [x] **Hangar order and aircraft packed in it** (board items 9, 2 and 14; data format 14). Recursos gets "Ordem no hangar": the aircraft from front to back, with up, down and "to the front" (as in Rodízio); each date keeps its order and the next date starts with it. Choosing an aircraft, after "the instructor's aircraft" and "not the student's previous one", the engine now takes an aircraft that is already out, the one with the smallest gap to the flight (closing the day's holes), and only then the front-most one in the hangar (before: the least used, which spread the flights over the whole fleet). The tail pass places each instructor's day the same way, and its new layout counts when it has fewer tail switches, or as many with fewer aircraft out, or as many with less idle time. In the 41 reference schedules: 305 → 223 aircraft used (the minimum possible is 214), 394 → 314 hangar exits, the same flights, rejections and preferences; idle aircraft time +12 h (fewer aircraft carry the same flights), tail switches 6 → 7. Only the registrations change.
5. [x] **The even split's tie-break** (board items 6 and 15): among the valid moves from the instructor with the most hours, the one that leaves the least idle time in the day of both instructors (before: the earliest flight to whoever had the fewest hours). The split stays as even (the sum of squares of the hours only goes down). In the 41 reference schedules: idle instructor time 506.7 → 480 h (−5%), instructors with 2 h or more idle 107 → 99, tail switches 7 → 6; the same flights, rejections and preferences. Engine: median 1.0 ms, p90 2.5 ms.

#### Phase 11: Legal limits (branch `fase-11`, on top of `fase-10`)
1. [x] **The limits in the engine** (board item 3; data format 15, migration `horas_dos_instrutores`). Lei 13.475/2017 covers flight instruction (art. 5, III) and RBAC 117 Appendix A applies it to RBAC 141 schools. The engine never schedules an instructor beyond 9h30 of flight or 11 h of duty in the day (from 30 minutes before the first commitment to 30 after the last; after 18:00 an hour counts as 52m30s), 100 h of flight in the month or 960 h in the year, or with less than 12 h of rest since the day before; the law has no semester limit (empty). Flight hours count aircraft only; simulator and Ground count in the duty. The values live in the roster and the Administrador can change them; from 90% of the month, semester or year the schedule warns. Past hours come from the saved schedules through `horas_dos_instrutores(date)` (the same sum in `js/limites.js` for local mode and the test server), plus each instructor's hours flown outside the app. In the 41 reference schedules, which had 38 instructor-days over 11 h of duty and 5 over 9h30 of flight, 7 missions are left out for lack of an instructor within the law (11 rejections more in all) and idle instructor time drops 22%. 7 database checks; applied to the preview.
2. [x] **On screen**: the day grid's "Mês" column (flight hours in the month with this date's schedule, highlighted from 90%), the instructor panel's hours in the month, semester and year with the hours flown outside the app (this month, and earlier this year), and the "Limites da Lei do Aeronauta" panel in Instrutores › Cadastro, which only the Administrador changes (in local mode, the Operador). The Manual explains the rules.

#### Phase 12: The operating day (branch `fase-12`, on top of `fase-11`)
1. [x] **Pinned flights in the engine** (board item 5): the engine takes the pinned flights (time, aircraft and instructor of each) first, as they are, and fits the rest of the demand around them. A pinned flight that became impossible (the instructor no longer comes, the aircraft went into maintenance, the room or the aircraft already taken) stays where it is, marked as a conflict with the reason; a cancelled pinned flight frees its aircraft and instructor. The even split and the tail pass leave pinned flights alone, and a pinned Ground class stays open for a new student of the same Ground. Over 100 generated days, with the schedule pinned, new top-priority requests never move a pinned flight; without pins nothing changes.
2. [x] **Approving the schedule** (data format 16): "Aprovar escala" (with confirmation) pins every flight of the date; the badge next to the title says when and who approved; "Reabrir" (with confirmation) unpins and the schedule is rebuilt again on every change. Pinned flights show a padlock; conflicts get a red box and a red edge on the row. Em Voo and Atrasado also pin the flight, even without approval. The approval is kept per date (a new date starts without it) and travels in the Gestor link.
3. [x] **Suggestions for a conflict** (`js/reparo.js`): each conflict gets a "Sugestões" button that opens a drawer with what can fly instead, without moving any other flight. At the same time: another aircraft of the same type (one already out, with the smallest gap, then the front of the hangar), another instructor (qualified, available, free, not blocked by the student, within the weight and the legal limits; full tank first, then fewest hours today and fewest qualifications) or both. With nothing at the same time: the first later time today (on today's schedule, only times still ahead) within the student's availability, before the next session of the same request, and for a Ground class before the flights that depend on it. Last, cancel: the status dialog opens with the reason the conflict suggests. "Aplicar" changes the pinned flight (a Ground class as a whole), and the history reverts it. Over 100 generated days with an instructor and an aircraft taken out after approval, every suggestion applied clears its conflict, creates no other and keeps the instructor within the law.

#### Phase 13: Compact days, with the operator's switches (branch `fase-13`, on top of `fase-12`)
1. [x] **Compaction in the engine** (board items 2, 6, 14, 15 and 16; `js/compactar.js`, data format 17). After the even split, a deterministic local search closes the day's gaps: shift a flight's time (same instructor), hand it to another instructor (same time), both at once (to an instructor who already flies next to it), or swap two flights of the same length between two instructors. Each round applies the move that lowers the cost the most, in a fixed order, until none does or the search hits its caps (200 moves, 20,000 checks: counts, not time). Every rule still holds (qualification, availability, weight and fuel never worse, legal limits, session order, Ground before the flight), the sum of squared hours never grows (the even split doesn't get worse), and pinned flights, flights with a status, the instructor of rotation flights, Noturno, Parafuso in the C152 and the time of Ground classes stay as they are. The engine keeps the compacted day only when, after the tail pass, it costs less than the uncompacted one.
   - **The operator's two switches**, under the Escala bar and kept with the date (the next date starts with them; they travel in the Gestor link): *Buracos* = INVA (default: instructor idle time weighs 1 per minute, aircraft 0.1 and a hangar exit 10), Avião (aircraft idle 1, exit 60, instructors 0.1) or Maior buraco (each gap, instructor or aircraft, costs its length squared / 60); *Horários* = Na disponibilidade (default: any start time of the category within the student's availability), Só 1ª e 2ª, or Não mudar. A lost preference costs 30 (2nd) or 60 (other time) times the request's priority / 3, the same in all three. Locked once the schedule is approved.
   - A flight moved off its preferences shows "horário ajustado"; a box next to the summary shows the idle time left (instructors, aircraft) and the hangar exits.
   - In the 41 reference schedules, with the defaults: instructor idle time 374.8 → 263.8 h (−30%), instructors idle 2 h or more 95 → 64, aircraft idle 406.3 → 333.7 h, hangar exits 303 → 274, aircraft used 220 → 214; 17 of 990 flights leave their preference (1st −9, 2nd −8); the even split unchanged. Avião: aircraft idle 299 h and 270 exits (instructors 297.8 h; 31 flights leave a preference). Maior buraco: 272.7 h and 302.2 h (46 leave). Só 1ª e 2ª: instructors 363.8 h, and 9 more flights land on a preference. Engine time: median 2.4 ms, p90 7.8 ms.

#### Phase 14: Courses and mission results

#### Phase 15: CAVOK and Plane It

### Phase 16: Later (nice to have)
- [ ] Track instructor and student currency: last flight, medical/CMA expiry. The engine then checks these too (the course phase is Phase 14).
- [ ] Integrate with the Google Calendar that students already use, publishing each student's missions.
- [ ] Make the app installable (PWA) for use on the apron with poor connectivity.
- [ ] After approval, when a new request doesn't fit around the pinned flights, suggest one change to a pinned flight that makes room (Phase 12 follow-up).

## 5. Open questions for the repo owner
1. Who uses the app daily, and how many operators edit at the same time?
2. Is the school on Google Workspace? This decides Sheets versus Supabase.
3. ~~Can the repo be made private, or the history rewritten, to remove instructor weights?~~ *Answered: not needed (Gabriel, PR #2).*
4. Are the instructor levels in someone's browser the real ones, and whose?
5. ~~Should student and instructor data be linked to any existing school system?~~ *Answered: yes, CAVOK (students, schedule, mission results) and Plane It (aircraft, logbook); see Phase 15 (board, 2026-11-13).*
6. ~~Should a student keep the same aircraft and instructor across sessions on the same day?~~ *Answered: the student rotates instructors; the instructor keeps the aircraft (Phase 1).*
7. ~~How many Ground School rooms are there?~~ *Answered: one (Phase 1).*
