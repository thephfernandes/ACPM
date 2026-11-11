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
- [x] **Redesign approved in full** (2026-11-11): all 10 increments go into PR 2 (branch `fase-6-redesenho`). The engine, the data, the PDF and the CSV do not change.
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
- [x] **Adjustments from the preview review** (2026-11-11, in PR 2): the Demanda loses "Sessões" (one session per mission; to split a flight, "+ missão"; old requests with 2 or 3 sessions become one), no Undo button (change the field back; some changes also revert from the Histórico), the date control keeps a fixed width, the theme is a sun/moon switch, and the ACPM eagle is the favicon and the header logo, aligned with "Escala de Voo" and "ACPM".

### Phase 7: Later (nice to have)
- [ ] Track instructor and student qualifications and currency: last flight, medical/CMA expiry, student course phase. The engine then checks these instead of relying on manual levels.
- [ ] Integrate with the Google Calendar that students already use, publishing each student's missions.
- [ ] Make the app installable (PWA) for use on the apron with poor connectivity.

## 5. Open questions for the repo owner
1. Who uses the app daily, and how many operators edit at the same time?
2. Is the school on Google Workspace? This decides Sheets versus Supabase.
3. ~~Can the repo be made private, or the history rewritten, to remove instructor weights?~~ *Answered: not needed (Gabriel, PR #2).*
4. Are the instructor levels in someone's browser the real ones, and whose?
5. Should student and instructor data be linked to any existing school system?
6. ~~Should a student keep the same aircraft and instructor across sessions on the same day?~~ *Answered: the student rotates instructors; the instructor keeps the aircraft (Phase 1).*
7. ~~How many Ground School rooms are there?~~ *Answered: one (Phase 1).*
