# MSOSE UAT — wtd transaction-data upload load test: verification report

**Date:** 2026-10-28 (original); **updated 2026-10-30** for the ZIP-only upload rule and the switch to the UAT IP
**Target:** MSOSE UAT, `https://10.12.128.248:7012/MSOSE`
**Account:** `JL0003` (password supplied at run time through `MSOSE_PWD`; not stored in this report or in any result file)
**Tooling:** Apache JMeter 5.5, CLI, non-GUI
**Kit revision:** 2026-10-30, ZIP-only upload (`application/zip`, `wtd_payload_30mb.zip`) and literal-IP target (`10.12.128.248`); login captcha removed 2026-10-28 (UAT switch `LOGIN_CHECK_CAPCHA` is off)

---

## 1. Outcome in one paragraph

In the original 2026-10-28 verification, the delivered plan (`MSOSE_UAT_wtd_upload_load_test.jmx`) **could not exercise the deployed application**: it was redirected to the system message page on every step and still reported success, so it uploaded zero files while showing an 82 % pass rate. The rewritten plan (`MSOSE_UAT_wtd_upload_load_test_v2.jmx`) completed the real flow — browser-config gate, login, all three wtd wizard steps, 30 sequential uploads of a 29.97 MB XLSX, and a post-run page check — with **0 % errors** and a median upload time of **337 ms** (p95 430 ms, max 649 ms, 857 MB sent in total). No files were persisted to the draft, and the account logged in normally afterwards. That XLSX run is retained below as historical evidence; on 2026-10-30 the same plan was switched to a 30 MB ZIP and re-verified end to end.

**Current state (2026-10-30):** UAT now accepts **only ZIP uploads** (`application/zip`, `.zip`). The plan's defaults and both runners now use `wtd_payload_30mb.zip` (30,009,291 bytes, genuine ZIP) and target the literal UAT IP `10.12.128.248`. A fresh end-to-end run was completed on 2026-10-30: `check` 12 samples/0 errors, `smoke` 14/0 with 2/2 uploads (HTTP 200, `success:true`), and `full` 42/0 with **30/30** uploads, 900.3 MB sent, 12 s. The upload gate was accepting at that time, so no 463 was hit. After the IP switch both runner smokes were repeated against `10.12.128.248` and passed (14/0, 2/2 uploads each). The login captcha remains off and the plan still uses the five-request captcha-free login. Earlier XLSX results below are retained as historical evidence; the upload code path is unchanged apart from the payload type.

**Historical state (2026-10-28):** UAT had disabled the login captcha, and the plan was converted from audio-captcha solving to a plain form login. That revision was verified with `check` (12 samples, 0 errors) through both runners; the upload path was last exercised by the captcha-era 30/30 XLSX run. The retired Node.js runtime and audio solver live only in `ARCHIVE/captcha-audio` (about 99 MB); the runnable kit is about 50 MiB and needs only JMeter and Java.

---

## 2. What the original plan gets wrong

Evidence: `ARCHIVE/result/baseline-20261028-122542.jtl` and its dashboard `ARCHIVE/report/baseline-20261028-122542/index.html` (archived together with the original plan).
Run as delivered (only `num_uploads=1`, `user_count=1` and the payload path overridden; host and password left at their baked-in defaults).

| # | Defect | Live evidence | Fixed in v2 |
|---|---|---|---|
| 1 | No Struts CSRF token on any POST | Every POST needs the single-use `token`; uploads additionally need `requestCSRFHeader=renew` and must replay the returned `X-CSRF-TOKEN` | Token extracted on each page render, rotated after every upload |
| 2 | Wrong login field names (`user.userId` / `user.pwd`) | The form posts `mso.userId` / `mso.passwd` / `captcha` | Correct names |
| 3 | Login flow incomplete — no `/checkResult` browser-config gate, no captcha | POST `/security/login.action` returns 200 with the login form again | Gate + login POST (a GIF/WAV captcha and audio solver were used while UAT required them; removed 2026-10-28) |
| 4 | Wrong upload endpoint `/MSOSE/common/bUpload.action` | Deployed page uses `/MSOSE/common/bUpload_x.action` | Correct endpoint |
| 5 | Wizard steps hit without the guard POSTs | Deep links 302 back to `001s0-2`; each step must be advanced with `command=true`, `wtd_checkbox_command=true` | GET + POST per step, with step assertions |
| 6 | Assertions only check the final HTTP status while following redirects | Upload POST → `302` → `/MSOSE/sysMsg` → `200`, sample marked **successful**; body contains no `success:true` anywhere in the run | Asserts response body markers, `success:true`, absence of HTML error pages |
| 7 | "Empty All" assumed to be a server action | It is a client-side DOM clear; there is no HTTP request to record (see §5) | Modelled as a documented negative check behind `persist_uploads=true` |
| 8 | Payload is 2.3 MB, not 30 MB, and the MIME was unspecified | `LIC_APP_TBL.xlsx` = 2,365,725 bytes | Originally `wtd_payload_30mb.xlsx` (29,965,773 bytes) as OOXML; since 2026-10-30 `wtd_payload_30mb.zip` (30,009,291 bytes) as `application/zip` |
| 9 | Relative payload path | Resolved against the JMeter working directory | Resolved against the JMX directory; override with `-Jupload_file` |
| 10 | Password hard-coded as a default value | `${__P(user_pwd,<test-password>)}` | Empty default; run fails in pre-flight if not supplied |

**Baseline result:** 11 samples, 2 assertion errors, yet every wizard and upload sample is green. The upload sample's own sub-sample shows the redirect chain ending at `/MSOSE/sysMsg`; `success:true` appears **0** times in the captured bodies, i.e. no file reached the upload handler.

---

## 3. Why the test environment needed special handling

These are environment issues, not plan issues, but the plan cannot run without them.

1. **TLS name mismatch (strict clients only).** The certificate is issued for `deveas.mso.customs.hksarg`, with no IP SAN. Browsers and `curl` reject `https://10.12.128.248:...` with `No subject alternative names matching IP address 10.12.128.248` even when the chain is trusted. JMeter 5.5 is not strict at all: its HttpClient4 path uses a **trust-all** socket factory and every run logs `LazyLayeredConnectionSocketFactory: Setting up HTTPS TrustAll Socket Factory`, so neither the chain nor the certificate name is checked. `uat-truststore.jks` (password `changeit`) is therefore optional, and runs succeed with its `JVM_ARGS` line commented out (`result/smoke-20261030-172326.log`; the same TrustAll line appears in the earlier truststore-enabled run `result/smoke-20261030-165047.log`). Literal-IP runs were verified on 2026-10-30: `check` 12/0 (`result/probe-ip-check`) and a two-upload probe 14/0 with 2/2 uploads `success:true` (`result/probe-ip-upload`).
2. **DNS.** On the office network `deveas.mso.customs.hksarg` resolves to 10.12.187.171, which answers 404. The kit targets the IP directly, so no name resolution or hosts override is involved.
3. **HTTP proxy.** `apache-jmeter-5.5/bin/system.properties` sets `http(s).proxyHost=proxy1.scig.gov.hk:8080`. JMeter applies that with `HttpClientBuilder.setProxy()` and ignores `http.nonProxyHosts`, and `-Jhttp.proxyHost=` cannot clear it. Every internal request failed until the four proxy lines were deactivated. Commenting them out works, and so does prefixing each line with a non-property token (e.g. `DISABLED_FOR_INTERNAL_UAT http.proxyHost=...`) — the key then becomes `DISABLED_FOR_INTERNAL_UAT http.proxyHost`, leaving the real property undefined. A backup is kept at `bin/system.properties.bak-20261028-proxy`. Both runner scripts refuse to start while an active proxy line is present; their checks are start-of-line anchored (`findstr /B /C:"http.proxyHost="`, `grep '^http\.proxyHost='`), so prefixed lines pass and a genuine re-enable still aborts the run.
4. **Git Bash path rewriting.** `-Jbase=/MSOSE` is rewritten by MSYS into `C:/Program Files/Git/MSOSE`, producing 404s. The shell runner does not pass `-Jbase` (the plan default is already `/MSOSE`); the `.cmd` runner is unaffected.
5. **JDK selection.** The `java` on `PATH` is an Oracle javapath shim that the JMeter shell launcher cannot exec; the shell runner exports `JAVA_HOME=C:/Program Files/Java/jdk-17`.

---

## 4. Captured live contract (what v2 implements)

| Step | Request | Notes |
|---|---|---|
| Config gate | `GET /MSOSE/index`, `POST /MSOSE/checkResult` (token + 12 `configModel.*`), `POST /MSOSE/index` (`preAction=/security/login`, `nextBtn_=Home`) | The gate returns a "Client System Configuration Check Result – Warning" page (200); Continue completes it |
| Login page | `GET /MSOSE/security/login` | Login form needs to be fetched explicitly; the gate POST lands on the public menu. The plan now asserts the form contains `name="mso.userId"` and **no** `name="captcha"` |
| Captcha *(retired 2026-10-28)* | `GET /MSOSE/captcha?t=<rand>` and `GET /MSOSE/loadCaptchaSound.wav?id=<rand>` | No longer requested. Kept here because the archived solver and the earlier runs used them; WAV is 16 kHz mono PCM, ~125 KB |
| Captcha solve *(retired)* | `node audio_solve.mjs <wav>` then `java AudioVerify <wav> --search <base> <order>` | Removed from the plan; solver archived. A captcha field on the form now fails the run before the login POST |
| Login | `POST /MSOSE/security/login` with `token`, `mso.userId`, `mso.passwd` (the `captcha` argument was removed on 2026-10-28) | 302 → `/MSOSE/index`; dashboard links contain `/wtd/001s0` |
| Overview | `GET /MSOSE/wtd/001s0-2`, `POST` with token | `data-current-step` 0 → 1 |
| Terms | `GET /MSOSE/wtd/001s1-2`, `POST` with `command=true&wtd_checkbox_command=true` | step 1 → 2 |
| Upload | `POST /MSOSE/common/bUpload_x.action?struts.token.name=token&token=<t>&requestCSRFHeader=renew` | multipart `name=<o_…>.zip` + `file=@…`, `Content-Type: application/zip`, header `app-uploader: Y`; body `success:true`; `X-CSRF-TOKEN` response header becomes the next token |
| Verify | `GET /MSOSE/wtd/001s2-2` | Asserts none of the just-uploaded temp names appear, i.e. upload-only runs leave nothing behind |

**Upload constraints observed live**

**Current rule (2026-10-30):**
- Extension: `zip` only.
- MIME: `application/zip` only. `application/x-zip-compressed` (what Chrome sends for a `.zip`) is rejected with HTTP 400 "Content-Type not allowed".
- A `.zip` whose content is not a ZIP fails the server's magic-byte check ("File type mismatch").
- Page limits: 30 files, 52,428,800 bytes each; the plan's pre-flight enforces a stricter 31,457,280-byte (30 MiB) cap.

**Earlier capture (2026-10-27/28, retained for history):** extension allowlist `zip`, `xls`, `xlsx`, `xml`; MIME allowlist `application/zip`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/xml`. That is why the original plan used XLSX; UAT has since narrowed the rule to ZIP only.

---

## 5. "Empty All Upload Files" — what is actually true

There is no server-side empty-all request to test.

- The Delete control removes the row from the DOM only; the file itself stays in the session's temporary upload directory.
- Submitting the step with `TR1_count=0` is rejected by the server: *"Transaction Summary must be uploaded for the purpose of verification."*
- Uploaded files live in a per-session temp directory and are discarded when the session ends; nothing is written to the draft until the step's Next is submitted.

Consequently the requirement's steps 8→9 cannot be satisfied literally over HTTP. The plan models them (`persist_uploads=true`) as: submit the step with rows, come Back, submit with `TR1_count=0`, and assert the server's rejection message — i.e. the check documents the real behaviour instead of faking a clear. The branch writes files into JL0003's UAT draft and there is no HTTP way to clean them up, so it stays disabled by default; clearing the draft is a UI operation. The persisted rows were confirmed with a 1-upload probe on 2026-10-30 (see the persist note in §6).

---

## 6. Runs and results

### 2026-10-30 — ZIP-only upload rule; end-to-end verification (current)

**Trigger.** UAT changed the upload policy to accept only ZIP files. The plan's UDVs and both runners
were switched to `wtd_payload_30mb.zip` (30,009,291 bytes, magic bytes `PK\x03\x04`, a valid ZIP
containing a 30,000,000-byte stored entry), MIME `application/zip`, extension `zip`. The upload sampler
structure did not change: it was already driven by `${upload_file}`, `${upload_file_mime}` and
`${upload_ext}`.

**Runs.** All three profiles were executed on 2026-10-30 inside the 12:00–14:00 HKT upload window.

| Run | Runner | Result |
|---|---|---|
| `result/check-20261030-122404` | `.cmd check` | 12 samples, **0 errors**, 0 uploads; `PRE-FLIGHT OK ... bytes=30009291 mime=application/zip`; `RUN SUMMARY uploads=0`; 4 s |
| `result/smoke-20261030-122452` | `.cmd smoke` | 14 samples, **0 errors**, 2/2 uploads HTTP **200** + `success:true` (613 ms / 331 ms); 3 s |
| `result/full-20261030-122520` | `.cmd full` | 42 samples, **0 errors**, **30/30** uploads HTTP **200** + `success:true`; 900,305,335 sent bytes (900.3 MB); 327–556 ms per upload; 12 s; post-run verify 200 and no persisted temp names |

The JTL for the full run has 53 data rows: 30 upload samples, 12 other samplers, 5 transaction markers
and 6 redirect sub-samples, matching the expected arithmetic for the current plan. JMeter's exit code
was 0 in every run; the `Err: 0` summary and the JTL `responseCode`/`success` columns are the real gate.

**Target change (same day).** The kit now points at the literal UAT IP `10.12.128.248`, because the
hostname's office-DNS answer (10.12.187.171) is a different host that returns 404. JMeter 5.5's
HttpClient4 path is trust-all, so neither the certificate name nor the chain is checked and no hosts
override is needed; the truststore is not required. Re-verified against the IP with both
runners and both profile shapes:

| Run | Command | Result |
|---|---|---|
| `result/check-20261030-151559` | `.cmd check` | 12 samples, 0 errors |
| `result/check-20261030-151611` | `.sh check` | 12 samples, 0 errors |
| `result/smoke-20261030-152145` | `.cmd smoke` | 14 samples, 0 errors, **2/2 uploads HTTP 200 + `success:true`**; log shows `host=10.12.128.248` |
| `result/smoke-20261030-152204` | `.sh smoke` | 14 samples, 0 errors, **2/2 uploads HTTP 200 + `success:true`**; log shows `host=10.12.128.248` |
| `result/probe-ip-upload` | direct JMeter, `-Jnum_uploads=2` | 14 samples, 0 errors, 2/2 uploads `success:true` |

The upload gate is not tied to a fixed clock window: the identical two-upload profile returned HTTP 463
at 14:37 (`result/smoke-20261030-143704`), succeeded at 14:40 (`result/smoke-20261030-144057`), and
succeeded again at 15:18 and 15:21–15:22, so 463 is an intermittent server-side gate.

**Persist branch, observed once (not a supported path).** A smoke run with the `persist_uploads` UDV
temporarily set to `true` (`result/smoke-20261030-155830`) produced 19 samples and `Err: 1`. The uploads
passed (2/2 HTTP 200 + `success:true`) and `0601` persist / `0602` Back / `0603` Empty-All all returned
200, but `0604 GET 001s3` failed with *"001s3 not reachable after the persist run"*. The two files were
written to JL0003's draft. The UDV was restored to `${__P(persist_uploads,false)}` afterwards; the
branch remains disabled by default and its last assertion (`0604`) still does not match the deployed flow.

**Persist confirmed (1-upload probe).** `result/persist-probe-1upload-20261030-164356` wrote its row into
the draft addressed as `001s2-2`, and the uploader on that page then listed `wtd_payload_30mb.zip`
(30,009,291 bytes). The step's document set is **replaced** on every Next: after four 2-upload persist
runs only the last run's 2 rows remained, and the 1-upload run left exactly 1 row. The plan always
targets draft `001s2-2` (the `-2` suffix is hardcoded in every wizard path); a draft with a different id,
such as `001s2-84`, is a separate submission and is not touched. To inspect the result, log in and walk
step 0 → Next → step 1 → accept terms → step 2 — a direct GET of a step URL redirects back to step 0.

### 2026-10-28 — captcha disabled on UAT (historical, XLSX payload)

**Trigger.** UAT switched the login captcha off on the server, so a manual login succeeds with only
the user id and password. The kit was converted from audio-captcha solving to a plain form login.

**Server switch.** `CTRL_PARM_TBL`, `CTRL_PARM_CD = 'LOGIN_CHECK_CAPCHA'` (the application's spelling),
`PARM_VAL = 'N'`. `CtrlParmService.isLoginCheckCaptcha()` treats only `'Y'` as enabled (fail-open for
any other value) and treats a **missing row** as enabled. The value is cached in the `codeTable`
Ehcache (TTL 1200 s, refreshed at second 20 of minutes 1/16/31/46), so a database change can take up
to ~15 minutes to appear on the login page. `CHECK_CAPCHA` is a separate switch used by other screens.

**Changes to the kit.**

- Pre-flight no longer resolves Node, Java or a solver; it checks only the password, the payload file,
  its size and the 30 MiB cap. `PRE-FLIGHT OK` is still logged.
- `0104 GET security/login` now asserts `name="mso.userId"` is present, adds a negative assertion that
  fails when `name="captcha"` is present, and runs a Groovy guard that calls `ctx.getEngine().stopTest()`
  **before** the login POST. This protects the account's 5-failed-login lockout if the switch is ever
  turned back on.
- `0105 GET captcha`, `0106 GET captcha audio` and the audio-solve post-processor were deleted; the
  login POST sends only `token`, `mso.userId` and `mso.passwd`.
- Sample counts dropped accordingly: **12** for `check` (0 uploads), **14** for `smoke`, **42** for
  `full` (previously 16 and 44).
- `work/relogin.sh` was rewritten: it performs the config gate, refuses to log in with
  `LOGIN=captcha-enabled` if the form renders a captcha, and deletes its cookie jar/captured pages on
  exit.
- The solver working copy (`work/captcha-audio`, ~99 MB) was verified byte-identical to
  `ARCHIVE/captcha-audio` and deleted from the runnable tree. A `check` profile (0 uploads) was added
  to both runners so login/wizard health can be tested outside the upload timeslot.

**Evidence.**

| Run | Runner | Result |
|---|---|---|
| `work/relogin.sh` | Git Bash | `LOGIN=ok user=JL0003 url=https://10.12.128.248:7012/MSOSE/index`; no captcha field; no cookie jar left behind |
| `result/check-20261028-162349` | `.cmd check` | 12 samples, **0 errors**, 0 uploads; `PRE-FLIGHT OK` and `RUN SUMMARY uploads=0 expected=0`; zero `CAPTCHA` log lines |
| `result/check-20261028-162308` | `.sh check` | 12 samples, **0 errors**; same log lines |
| `result/smoke-20261028-162116` | `.cmd smoke` | Login and both wizard steps 0 errors; both uploads returned **HTTP 463** because the server's upload timeslot was closed (14:31/14:46 had accepted the same payload earlier in the day) |
| `result/smoke-20261028-162749` | `.cmd smoke`, 16:27 | Repeated 10 minutes later: 14 samples, only the two uploads fail with 463; the gate was still closed |
| `result/full-20261028-122815` | `.cmd full` (captcha-era, historical) | 30/30 uploads, 0 errors, median 337 ms — the upload path is unchanged by this revision |

The captcha-free conversion was therefore **verified for login and the wizard through both runners**
at that time; a fresh 30-upload run could not be completed then because the UAT upload gate returned
463. This is an environment gate: the plan reports it as a failure, not a pass. The ZIP-only rerun on
2026-10-30 (above) completed the full 30-upload path when the window was open.

### Smoke — `result/smoke-20261028-152415.jtl` (historical: bundled Node, Node absent from PATH)

1 user, 1 iteration, 2 uploads of the default 2.3 MB XLSX, run with the final portable layout
(`work/captcha-audio`, no paths outside the kit) and with Node deliberately removed from `PATH`.

- 16 samples, **0 errors**, 3 s. Login solved the captcha with the bundled solver (bundled Node 24.19.0 + Java 17).
- Both uploads 200 + `success:true` (91 ms, 82 ms), wizard steps 200, post-run verify 200.
- The `.sh` runner was validated the same way afterwards (`smoke-20261028-152537`, uploads 116/82 ms). Earlier smokes (12:28 with the original layout, 14:46) are archived; the 14:16 run is the timeslot evidence below.

### Portable Node runtime — historical (retired 2026-10-28)

While the captcha was required, the kit did not need a Node.js installation: an official `node.exe`
v24.19.0 (Windows x64, 92,825,416 bytes) and its licence were bundled at `work/captcha-audio/node/`,
and the pre-flight resolved `-Jnode_exe` → bundled → installed → `PATH`. That tree is now at
`ARCHIVE/captcha-audio/` and the pre-flight no longer looks for a runtime.

- Bundled and system Node produced identical `BASE`/`ORDER` output on both archived captcha WAVs
  (`ARCHIVE/work/captcha.wav`: `G3FWG`, `r_captcha.wav`: `IL7QG`); `AudioVerify` returned `MATCH`
  for both.
- `smoke-20261028-152415` — Node absent from `PATH`; pre-flight logged the bundled runtime; 16/0,
  2/2 uploads.
- `smoke-20261028-152438` — normal environment, same result (bundled runtime, 16/0, 2/2, 92/90 ms).
- `smoke-20261028-152458` — bundled `node.exe` temporarily renamed; the resolver selected the
  installed Node (`C:\Program Files\nodejs\node.exe`, v24.22.1); 16/0, 2/2 (119/85 ms). The bundled
  file was restored and re-hashed afterwards.
- `smoke-20261028-152537` — Git Bash runner; bundled runtime; 16/0, 2/2 (116/82 ms).

### Full — `result/full-20261028-122815.jtl`, dashboard `report/full-20261028-122815/index.html` (historical: captcha-era login)

1 user, 1 iteration, 30 sequential uploads of `wtd_payload_30mb.xlsx` (29,965,773 bytes).

| Metric | Value |
|---|---|
| Samples | 44 (0 errors, 0.00 %) |
| Upload samples | **30/30** HTTP 200 and `success:true` |
| Upload time | min 323 ms / median 337 ms / mean 358 ms / p95 430 ms / max 649 ms |
| Bytes uploaded | 857.4 MB (≈29.97 MB per request) |
| Whole run | 14 s |
| Post-run page check | 200; none of the 30 temp names present |
| Draft state afterwards | 0 `TR1_*` rows, no `o_*` upload fields |
| Account state afterwards | fresh login succeeded; no lockout, no lingering session |

Per-step timings from the same run (representative, ms): index 214, checkResult 40, gate POST 43, login page 30, captcha image 16, captcha audio 169, login POST 122, 001s0 53, its Next 60, 001s1 57, terms POST 65, 001s2 reload 52.

All failures encountered during the first attempts were harness problems (payload default not expanding, MSYS path rewriting), not application errors; they were fixed before the reported runs, and their artifacts were removed.

---

## 7. Deliverables

| File | Purpose |
|---|---|
| `MSOSE_UAT_wtd_upload_load_test_v2.jmx` | Corrected plan, captcha-free login. All values overridable with `-J`; no password default |
| `run_wtd_load_test.cmd` | Windows runner: `check` (0 uploads), `smoke`, `full` |
| `run_wtd_load_test.sh` | Git Bash/Linux runner, same modes |
| `wtd_payload_30mb.zip` | 30,009,291-byte ZIP (genuine archive, 30,000,000-byte stored entry), sent as `application/zip` |
| `LIC_APP_TBL.xlsx` | Legacy 2.3 MB XLSX from the earlier XLSX-only profiles; not used by the current plan |
| `uat-truststore.jks` | Optional truststore with the UAT certificate chain; not needed by JMeter (trust-all), kept for browsers/strict clients |
| `result/`, `report/` | JTL + HTML dashboards for the retained runs (baseline and captcha-era proves archived) |
| `work/relogin.sh` | Standalone captcha-free login helper for manual checks; refuses to log in if a captcha is rendered |
| `ARCHIVE/captcha-audio/` | Retired audio-captcha solver and bundled Node runtime (~99 MB). Not referenced by the kit |

### How to run

```cmd
run_wtd_load_test.cmd check      :: login + wizard only, 0 uploads (works outside the timeslot)
run_wtd_load_test.cmd smoke      :: 2 uploads, 30 MB ZIP each
run_wtd_load_test.cmd full       :: 30 uploads x 30 MB ZIP
```

The `.cmd` runner carries the JL0003 UAT test password as its default (override by setting `MSOSE_PWD` beforehand). The `.sh` runner still takes the password from `MSOSE_PWD` only.

```bash
export MSOSE_PWD=<password>
./run_wtd_load_test.sh check
./run_wtd_load_test.sh full
```

Prerequisites in both cases: **JMeter 5.5 and Java 8+** (verified on Java 17). There is no Node.js runtime, no captcha solver and no executable in the runnable kit. The UAT switch `CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA` must be `'N'`; the plan fails sample `0104` and stops before the login POST if a captcha field is rendered. The four `http(s).proxy*` lines in `apache-jmeter-5.5/bin/system.properties` must not be active for internal UAT runs — comment them out or prefix them with a non-property token such as `DISABLED_FOR_INTERNAL_UAT ` (the runners check the start of each line and stop with an explanatory message otherwise). The truststore is optional. Keep the kit's path free of spaces because JMeter's launcher splits the `-J` property string.

---

## 8. Residual risks and limits

- **One user only.** `JL0003` is a real UAT account with a single-session rule, so the run is a sequential upload-throughput test, not a concurrency test. Raising `user_count` needs additional accounts.
- **Session idle timeout** is under 90 s on this environment. The plan keeps the session busy, so it is not an issue here; any future think-time must stay well below that or re-login must be added.
- **Captcha state is server-side and can change without notice.** The kit depends on `LOGIN_CHECK_CAPCHA = 'N'`. If the switch is turned back on (or the row is deleted), `0104` fails on the negative assertion and the Groovy guard stops the test before the login POST, so the plan does not burn the account's 5 failed-login attempts. The failure message names the switch and the ~15-minute `codeTable` cache. Do not loop the run.
- **The `.cmd` runner contains the JL0003 UAT test password** (it sets `MSOSE_PWD` as a default) at your request; the `.sh` runner does not. Treat the folder as sensitive when sharing outside the team.
- **No credentials reach the result files.** The password is read from the `MSOSE_PWD` environment variable (a `-Juser_pwd` value is still honoured for GUI use, but JMeter logs every `-J` property, so the runners never use it). Result files omit URLs, headers, sampler data and response bodies (`jmeter.save.saveservice.url=false` etc.), so CSRF tokens are not written either. The trade-off is that the JTL cannot be replayed for protocol debugging; re-run with those flags temporarily if needed.
- **The proxy change to `bin/system.properties` is machine-global** for this JMeter install. Restore `system.properties.bak-20261028-proxy` to return to the previous behaviour.
- **TLS is not authenticated.** JMeter's sampler is trust-all, so a green run is not evidence that the UAT certificate or its chain is valid; that requires `curl` or a browser.
- **`persist_uploads=true` writes to the draft** and its final `0604` assertion still fails; the write itself was confirmed on 2026-10-30 (see §6). Do not use it on a shared account.
- **Upload timeslot gate is server-controlled and can change without notice.** The 463 body received at 14:16 states *"Please upload during assigned timeslot : 1200 hrs. - 1400 hrs. or non-peak hours from 1800 hrs. - 0800 hrs. (HKT)"* (`result/smoke-20261028-141636.jtl`), yet the same account uploaded successfully at 14:31 and 14:46. Treat the published window as advisory: outside it `bUpload_x` returns HTTP **463**, which the plan's assertions report as a failure (it does not false-pass). Login and the wizard steps work at any time.
- **The 30 MB payload is synthetic.** It is a real ZIP archive containing a 30,000,000-byte stored entry, not a realistic business document; the server treats it as an opaque upload, so this does not affect the upload path being measured.
- **The ZIP-only rule is server-side and can change without notice.** UAT accepted `xls`, `xlsx`, and `xml` on 2026-10-27/28 but accepted only `application/zip` on 2026-10-30. If the allowlist widens or narrows again, update the UDV defaults, both runners, and this report; a 400 "Content-Type not allowed" or "File type mismatch" is the signal.
