# MSOSE UAT — wtd transaction-data upload test kit

A self-contained JMeter 5.5 CLI kit that exercises the **wtd** (transaction-data) wizard on
MSOSE UAT: login (**no captcha** — the UAT switch is off), the browser-config gate, the two wizard
steps before the upload page, **N sequential ZIP uploads**, and a post-run check that nothing was
persisted.

- Target: `https://10.12.128.248:7012/MSOSE` (UAT). The certificate is issued for
  `deveas.mso.customs.hksarg` with no IP SAN, but that name resolves to a different host on the
  office DNS. JMeter 5.5's HTTP client uses a **trust-all** socket factory (every run logs
  `Setting up HTTPS TrustAll Socket Factory`), so it accepts the IP without a truststore or a hosts
  override; `uat-truststore.jks` is optional and not needed for these runs.
- Account: `JL0003` (single-session UAT test account)
- Profiles: `check` = login + wizard, 0 uploads; `smoke` = 2 uploads × 30 MB ZIP;
  `full` = 30 uploads × 30 MB ZIP
- Upload format: UAT currently accepts only `application/zip` with a `.zip` extension
  (**ZIP-only rule, 2026-10-30**); earlier runs used XLSX
- Design and findings: see **VERIFICATION_REPORT.md** (original-plan defects, live upload contract,
  timings, residual risks, and the 2026-10-28 captcha-removal change)
- Step-by-step build/modify guide: see **jml_setup_guide.md** (GUI walkthrough, component-by-component
  setup, the Groovy scripts, modification recipes, and study exercises)

> **Before you run anything:** read §1. The only software prerequisites are **JMeter 5.5** and
> **Java 8+**. There is no Node.js runtime, no captcha solver and no executable in the kit. The UAT
> login captcha must be **disabled server-side** (§1.2).

---

## Contents

1. [Preparation](#1-preparation)
2. [Paths and settings](#2-paths-and-settings)
3. [How to inspect and check the .jmx before running](#3-how-to-inspect-and-check-the-jmx-before-running)
4. [What every file and folder is for](#4-what-every-file-and-folder-is-for)
5. [Running the test](#5-running-the-test)
6. [Reading the results](#6-reading-the-results)
7. [Troubleshooting](#7-troubleshooting)
8. [Security and handling notes](#8-security-and-handling-notes)
9. [Appendix A — the live request contract](#9-appendix-a--the-live-request-contract)
10. [Appendix B — settings in the .jmx vs the requirement](#10-appendix-b--settings-in-the-jmx-vs-the-requirement)

---

## 1. Preparation

### 1.1 Software

| Requirement | Why | How the kit handles it |
|---|---|---|
| **Windows** (tested on Windows 10 Enterprise) | The `.cmd` runner is the primary entry point | — |
| **JMeter 5.5** | The plan is a JMeter 5.5 test plan | The runners default to `..\apache-jmeter-5.5` next to this folder; override with `JMETER_HOME` |
| **Java 8 or later** | JMeter 5.5 itself needs Java 8+ | Verified here on Java 17. The `.sh` runner points `JAVA_HOME` at jdk-17 when it finds it |
| **Git Bash** (optional) | Only needed for `run_wtd_load_test.sh` and `work/relogin.sh` | — |

No other runtime is used: the plan contains no calls to Node.js, `java.exe`, or any external solver.

Check your machine:

```cmd
java -version
..\apache-jmeter-5.5\bin\jmeter.bat --version
```

### 1.2 Server prerequisite — the login captcha must be disabled

The plan submits only the Struts token, `mso.userId` and `mso.passwd`. It expects the UAT login form to
render **without** a captcha field. That is controlled by a database switch, not by the kit:

| Item | Value |
|---|---|
| Table | `CTRL_PARM_TBL` |
| Row | `CTRL_PARM_CD = 'LOGIN_CHECK_CAPCHA'` (this spelling is the application's) |
| Value | `PARM_VAL = 'N'` |

How the application reads it (`CtrlParmService.isLoginCheckCaptcha()`):

- only `'Y'` (case-insensitive) enables the captcha;
- **any other value disables it** (the check is fail-open);
- if the row is **missing**, the captcha is **required**;
- the login POST re-reads the switch before validating, so the database is the source of truth.

The value is cached in the `codeTable` Ehcache (TTL 1200 s, refreshed at second 20 of minutes
1/16/31/46), so **allow up to about 15 minutes** after a database change before the login page
reflects it.

`CHECK_CAPCHA` is a **different** switch used by the forgot-password/registration screens. Changing it
does not affect login.

**How to confirm the prerequisite**

1. Open the login page. The form must contain `name="mso.userId"` and **must not** contain
   `name="captcha"`.
2. The plan checks this automatically: sample `0104 GET security/login` has an
   **assert captcha disabled** assertion, plus a Groovy guard that stops the test **before** the login
   POST if a captcha field is rendered. This avoids burning failed-login attempts.
3. If you have database access (read-only), the environment owner can run:

   ```sql
   SELECT PARM_VAL FROM CTRL_PARM_TBL WHERE CTRL_PARM_CD = 'LOGIN_CHECK_CAPCHA';
   ```

**If the captcha reappears:** do not loop the test. The account is locked after 5 consecutive failed
logins. Ask the environment owner to confirm the row and wait for the cache, then run once.

### 1.3 Account and upload window

- The account is **JL0003**; it is a real UAT account with a **single active session** rule. Do not run
  two plans or keep a browser logged in as JL0003 at the same time.
- **Uploads are gated by a server-side timeslot.** When closed, `bUpload_x` returns **HTTP 463** with
  *"Please upload during assigned timeslot : 1200 hrs. - 1400 hrs. or non-peak hours from 1800 hrs. -
  0800 hrs. (HKT)"*. The gate is server-controlled and clearly advisory: it returned 463 at 14:16,
  16:21 and 16:27 on 2026-10-28 but accepted uploads at 14:31 and 14:46; on 2026-10-30 it returned 463
  at 14:37 and accepted the same two uploads at 14:40 and again at 15:18. Treat a 463 as "retry in a
  few minutes", not as a closed window. **Login and the wizard steps work at any time** — only the
  upload sampler fails. Use `check` if you only need to test those.
- The account is locked after 5 consecutive failed logins. If two attempts fail, stop and check the
  account rather than retrying.

### 1.4 Placement and path rules

Copy the whole `20261027` folder anywhere on the target PC, with two rules:

| Rule | Reason |
|---|---|
| Keep it next to the JMeter install (`...\apache-jmeter-5.5\20261027`) **or** set `JMETER_HOME` | The runners default to `%~dp0..\apache-jmeter-5.5\bin\jmeter.bat` |
| **Avoid spaces** in the kit's path | JMeter's launcher splits the `-J` property string; `%TEMP%` and the truststore are quoted in the `.cmd`, but the `-Jupload_file=...` value in `full` mode is not |

The kit does not write outside its own folder: results and reports stay under `<kit>`.

### 1.5 Five-minute smoke checklist

```cmd
cd /d <kit folder>
run_wtd_load_test.cmd check      :: login + wizard only, 0 uploads, works outside the timeslot
run_wtd_load_test.cmd smoke      :: 2 uploads
```

Expected: `check` = **12 samples, 0 errors**; `smoke` = **14 samples, 0 errors, 2/2 uploads**
(`success:true`). Dashboards appear under `report\<mode>-<stamp>\index.html`. Outside the upload
timeslot `smoke` still shows 14 samples but both uploads fail with 463 — that is the server gate, not
the kit; use `check` until the window opens. Note that JMeter exits **0 even when assertions fail**, so
judge a run by `Err:` in the console summary and by the JTL, not by the exit code.

---

## 2. Paths and settings

Everything is either relative to the kit or resolved at run time. There are no absolute paths in the
`.jmx` or the runners.

### 2.1 Files the kit resolves automatically

| What | Where it comes from | Can I override it? |
|---|---|---|
| Test plan | `<kit>\MSOSE_UAT_wtd_upload_load_test_v2.jmx` | Pass a different `-t` to JMeter |
| Default upload payload (when `upload_file` is empty) | `<kit>\wtd_payload_30mb.zip` | `-Jupload_file=<path>` |
| TLS trust | Not required: JMeter's HttpClient4 sampler uses a trust-all socket factory. `<kit>\uat-truststore.jks` (password `changeit`) is optional | Add its `JVM_ARGS` if you want the truststore loaded anyway |
| Results | `<kit>\result\<mode>-<stamp>.jtl` / `.log` | Edit the runner |
| HTML dashboard | `<kit>\report\<mode>-<stamp>\index.html` | Edit the runner |

There is **no captcha solver, no Node.js lookup and no Java lookup** in the pre-flight any more.

### 2.2 Runner environment variables

| Variable | Default | Meaning |
|---|---|---|
| `MSOSE_PWD` | `.cmd` sets `abcd1234`; `.sh` requires it | JL0003 password. The `.cmd` default is a convenience for colleagues; set the variable beforehand to override it. |
| `MSOSE_USER` | `JL0003` | Login id |
| `JMETER_HOME` | `<kit>\..\apache-jmeter-5.5` | JMeter installation |
| `PERSIST_UPLOADS` | `false` | Runs the persist branch when set to `true` (forwards `-Jpersist_uploads=true`, so step 06 executes and writes the uploaded rows into the UAT draft). Any value other than `true`/`false` aborts the run; see §5.4 |

The password is **not** written to the JTL, the JMeter log, or the dashboard: the runners never pass
`-Juser_pwd` (JMeter logs every `-J` property), and response bodies/headers are not saved.

### 2.3 Plan properties (`-J`)

All of these have in-file defaults; the runners override only a few.

| Property | Default | Used by | Notes |
|---|---|---|---|
| `scheme` | `https` | HTTP Request Defaults | |
| `host` | `10.12.128.248` | HTTP Request Defaults | UAT address. The certificate is issued for `deveas.mso.customs.hksarg` and has no IP SAN; JMeter 5.5 checks neither the certificate name nor the chain (trust-all socket factory), so the literal IP works |
| `port` | `7012` | HTTP Request Defaults | |
| `base` | `/MSOSE` | all paths | **Never pass this from Git Bash** — MSYS rewrites `/MSOSE` into a Windows path and every request 404s |
| `user_id` | `JL0003` | login POST | |
| `user_pwd` | *(empty)* | login POST | Leave empty; the pre-flight reads `MSOSE_PWD` |
| `user_count` | `1` | thread group | Raising it needs more accounts (single-session rule) |
| `ramp_time` | `0` | thread group | seconds |
| `run_iterations` | `1` | thread group loop | |
| `num_uploads` | `30` | upload loop | `check` passes 0, `smoke` 2, `full` 30 |
| `upload_file` | *(empty)* → `<kit>\wtd_payload_30mb.zip` | upload multipart | `full` passes `wtd_payload_30mb.zip` |
| `upload_file_mime` | `application/zip` | upload multipart | UAT currently accepts only ZIP (§9.3) |
| `upload_ext` | `zip` | upload file name | Keep as `zip`; the server checks the extension and the magic bytes |
| `persist_uploads` | `false` | optional step 06 | `true` **writes 30 files into the UAT draft**; see §5.4. Both runners forward it from `PERSIST_UPLOADS` |

### 2.4 Relocating the kit or JMeter

- **Different parent folder:** set `JMETER_HOME` before calling the runner, e.g.
  `set JMETER_HOME=D:\tools\apache-jmeter-5.5`.
- **Different drive:** no change needed; all internal paths are relative.
- **Different UAT host/IP:** edit the `-Jhost`/`-Jport` values in `PROP` (`.cmd`) / `PROP+=(...)`
  (`.sh`), or override `host` in the `host` UDV.
- **New certificate:** nothing to do for these runs — the sampler is trust-all. `uat-truststore.jks`
  (JKS, password `changeit`) only matters to browsers and other strict clients; replace it if you add
  one.

---

## 3. How to inspect and check the `.jmx` before running

The plan is plain XML (`<jmeterTestPlan ... jmeter="5.5">`). You can read it in any editor, but the
GUI is the practical way to check the logic.

### 3.1 Open it in the JMeter GUI (inspection only)

```cmd
..\apache-jmeter-5.5\bin\jmeter.bat
```

Then **File → Open** → `MSOSE_UAT_wtd_upload_load_test_v2.jmx`.

> Opening and inspecting does not contact the server. Starting a run from the GUI also works against
> UAT: the sampler trusts any certificate and the proxy lines are already inactive. Prefer a runner
> anyway — it enforces the proxy guard and writes timestamped results.

What to check in the tree:

| Tree node | What it should contain |
|---|---|
| **Test Plan** | One thread group, `user_count=1`, `run_iterations=1`; UDVs visible under *User Defined Variables* |
| **wtd upload** (Thread Group) | HTTP Request Defaults (`https`, host, port 7012), Cookie Manager, pre-flight, six transaction controllers |
| **01 Login** | 5 samplers, in order: index → checkResult → index → login form → login POST. The login-form sampler carries **assert login form**, **assert captcha disabled** and the **stop if captcha is enabled** guard |
| **02 Wizard 001s0** | GET step 0, POST Next, each with a step assertion |
| **03 Wizard 001s1** | GET step 1, POST accept terms; asserts step 2 and `id="mime-type"` (the uploader page) |
| **04 Upload** | Loop Controller (`num_uploads`), one `0401 POST bUpload_x` sampler with multipart `name` + `file`, header `app-uploader: Y`, assertions (200, `success:true`, no `<html`), and a post-processor that captures the rotated `X-CSRF-TOKEN` |
| **05 Verify** | GET `001s2-2`; asserts the page is still step 2 and **none** of the uploaded temp names appear |
| **06 Optional persist** | Disabled by an If Controller unless `persist_uploads=true`; asserts the server rejects `TR1_count=0` |
| **99 Run summary** | Writes `RUN SUMMARY uploads=… expected=…` to the log |

Expand **User Defined Variables** to confirm the defaults in §2.3. Expand the assertions to see the
expected markers (`name="mso.userId"`, `wtd/001s0`, `id="mime-type"`, `success:true`, etc.).

### 3.2 Check the plan without uploading anything

The `check` profile runs the whole flow — pre-flight, login, both wizard steps, the final page — but
the upload loop has zero iterations. It takes about 4 seconds, works outside the upload window, and is
the cheapest way to prove the kit, the account and the captcha switch are healthy.

```cmd
run_wtd_load_test.cmd check
```

Expected in the newest `result\check-<stamp>.log`:

```
PRE-FLIGHT OK file=...\wtd_payload_30mb.zip bytes=30009291 mime=application/zip uploads=0 persist=false
RUN SUMMARY uploads=0 expected=0 persist=false user=JL0003
```

and in the console: `12 in 00:00:0x`, `Err: 0`.

`check` is also the way to verify a relocated copy or a new machine before touching the upload path.

### 3.3 Structural checks (optional)

- The file must be UTF-8 XML with a single root `<jmeterTestPlan>`.
- Every element is followed by its `<hashTree>` (JMeter's container pairing); a hand edit that breaks
  this makes the plan load with missing samplers.
- The plan uses only standard JMeter components; the logic lives in a handful of small Groovy scripts
  (pre-flight, upload-name builder, token capture, verify assertion, optional persist branch). No
  plugins are required.
- `-J` names in the UDVs are the only tunables; editing defaults inside the GUI and saving changes the
  baseline for everyone, so prefer `-J` overrides.

Every variable, its definition line and the requirement it implements are mapped in **§10**. Use that
appendix when you need to answer "where does `${base}` come from?" or "does this still match the
requirement?".

For a GUI step-by-step walkthrough of every component - including how to rebuild a minimal plan and how
to modify this one safely - see **`jml_setup_guide.md`**.

---

## 4. What every file and folder is for

### 4.1 Top level (the files you need)

| Path | Purpose |
|---|---|
| `MSOSE_UAT_wtd_upload_load_test_v2.jmx` | **The test plan.** ~75 KB, JMeter 5.5 XML. Pre-flight, captcha-free login, both wizard steps, the upload loop, the verify step and the optional persist branch |
| `run_wtd_load_test.cmd` | **Windows runner (primary).** Validates the JMeter install and proxy setting, optionally sets the truststore JVM arguments (disabled in this copy — the sampler is trust-all), picks the profile (`check`/`smoke`/`full`), runs JMeter headless against `10.12.128.248`, writes `result/` + `report/`, returns JMeter's exit code. Embeds the JL0003 password as a default |
| `run_wtd_load_test.sh` | Same runner for Git Bash/Linux. Requires `MSOSE_PWD`, does not embed a password, does not pass `-Jbase` (MSYS would rewrite it) |
| `wtd_payload_30mb.zip` | 30,009,291-byte ZIP payload for `smoke`/`full` and the default when `upload_file` is empty. Genuine ZIP (`PK\x03\x04`) containing a 30,000,000-byte stored entry; the server treats it as an opaque upload |
| `LIC_APP_TBL.xlsx` | Legacy 2,365,725-byte XLSX from the earlier XLSX-only runs; not used by the current ZIP-only plan |
| `LIC_APP_TBL.zip` | Optional 1,865,822-byte ZIP if you want a faster smoke run; the plan defaults to the 30 MB ZIP |
| `uat-truststore.jks` | Optional JKS truststore with the UAT certificate chain (password `changeit`). Not needed by JMeter (trust-all); kept for browsers and other strict clients |
| `VERIFICATION_REPORT.md` | **Why the plan looks the way it does**: original-plan defects, live contract capture, results, timings, residual risks, and the captcha-removal change. Read this before changing the plan |
| `README.md` | This file |
| `requirement.txt`, `requirement_final.md` | The original requirement notes the work was checked against (input documents, not used at run time) |
| `jmeter.log` | JMeter's default GUI/console log at the kit root. Produced when the GUI was opened here; **not part of the kit** and safe to delete once that JMeter window is closed (each run writes its own log under `result/`) |

### 4.2 `work/` (runtime support)

| Path | Purpose |
|---|---|
| `work/relogin.sh` | Manual Git Bash helper: performs the browser-config gate, fetches the login form, **refuses to log in if the form contains a captcha**, and otherwise logs in with `mso.userId`/`mso.passwd`. It deletes its cookie jar (`cj.txt`) and captured pages on exit. Not used by the test plan |

Usage:

```bash
MSOSE_PWD=<password> bash work/relogin.sh
# LOGIN=ok user=JL0003 url=https://10.12.128.248:7012/MSOSE/index
```

### 4.3 `result/` and `report/` (run output, safe to delete)

| Path | Purpose |
|---|---|
| `result\<mode>-<stamp>.jtl` | Raw sample data (CSV). One row per sampler, redirect sub-sample and transaction marker |
| `result\<mode>-<stamp>.log` | JMeter's own log for that run. Grep it for `PRE-FLIGHT`, `RUN SUMMARY` |
| `report\<mode>-<stamp>\index.html` | Generated HTML dashboard: throughput, response-time percentiles, error table, per-label statistics |

Retained evidence runs in this copy:

| Run | What it shows |
|---|---|
| `full-20261030-122520` | **Current ZIP baseline:** `.cmd full`, 30/30 ZIP uploads (30,009,291-byte payload, `application/zip`), 42 samples, 0 errors, 900.3 MB, 327–556 ms |
| `smoke-20261030-122452` | **Current ZIP smoke:** 2/2 uploads, 14 samples, 0 errors, both `200` + `success:true` |
| `check-20261030-122404` | **Current ZIP check:** 12 samples, 0 errors, 0 uploads; pre-flight logged the ZIP payload |
| `probe-ip-upload` | **Literal-IP upload proof:** `-Jhost=10.12.128.248 -Jnum_uploads=2`, 14 samples, 0 errors, 2/2 uploads `200` + `success:true` |
| `smoke-20261030-152204` | `.sh smoke` against `10.12.128.248`: 14 samples, 0 errors, 2/2 uploads `200`; log shows `host=10.12.128.248` |
| `smoke-20261030-152145` | `.cmd smoke` against `10.12.128.248`: 14 samples, 0 errors, 2/2 uploads `200`; log shows `host=10.12.128.248` |
| `check-20261030-151611` | `.sh check` against `10.12.128.248`: 12 samples, 0 errors |
| `check-20261030-151559` | `.cmd check` against `10.12.128.248`: 12 samples, 0 errors |
| `probe-ip-check` | First literal-IP run: 12 samples, 0 errors (login + wizard only) |
| `smoke-20261030-144057` | Same smoke 3 minutes after the 463 run: 14 samples, 0 errors, both uploads `200` — the gate is intermittent, not a fixed window |
| `smoke-20261030-143704` | The 463 observation: login and wizard pass, both uploads `463` |
| `check-20261028-162349` | `.cmd` runner, captcha-free login + wizard, 12 samples, 0 errors, 0 uploads (pre-ZIP) |
| `check-20261028-162308` | Same flow through the Git Bash runner: 12 samples, 0 errors |
| `smoke-20261028-162749` | Captcha-free smoke (`.cmd`, 16:27): login and wizard pass, both XLSX uploads **463** — gate closed |
| `smoke-20261028-162116` | Captcha-free smoke (16:21): same result, establishes the 463 is repeatable outside the window |
| `full-20261028-122815` | Historical (captcha-era, XLSX) reference upload run: 30/30 uploads, 0 errors, 857.4 MB, median 337 ms |
| `smoke-20261028-141636` | The **463 gate** evidence; useful to recognise that failure mode |

Each dashboard folder is about 3.3 MB; delete old ones freely. The four captcha-era Node-portability
smokes (`152415`, `152438`, `152458`, `152537`) have been moved to `ARCHIVE/report` and
`ARCHIVE/result`.

### 4.4 `ARCHIVE/` (history — not needed to run)

`ARCHIVE/` is about **204 MiB** and holds everything useful during development that is not part of the
runnable kit. With it deleted, the kit is about **50 MiB**:

| Path | Contents |
|---|---|
| `MSOSE_UAT_wtd_upload_load_test.jmx` | The **original** plan, kept as evidence of the false-pass defect described in the report. Do not run it expecting a valid test |
| `LIC_APP_TBL.zip`, `Test2M.zip`, `wtd_payload_30mb.zip` | Earlier payload archives; the live payload is the top-level `wtd_payload_30mb.zip` |
| `chain.txt`, `work/certs/` | Captured certificate chain and TLS material from the initial probe |
| `captcha-audio/` | **Retired captcha solver** (~99 MB): Node.js runtime, MFCC/DTW segmenter, Java verifier and jars. Byte-identical to the old `work/captcha-audio`; nothing in the kit references it now |
| `relogin.sh` | The old captcha-based login helper (history). The live helper is `../work/relogin.sh` |
| `work/` | Phase A–B capture dumps: `*.html` pages (login, wizard, uploader), `*.hdr` request headers, captured WAV/GIF captchas, deployed JS, probe logs, `tools/MakeXlsx.java` (payload generator) |
| `result/`, `report/` | Superseded runs (baseline, earlier smokes, an extra full run, the four Node-portability proofs) |

Nothing in `ARCHIVE/` is loaded by the plan or the runners.

---

## 5. Running the test

### 5.1 Profiles

| Profile | Command | Uploads | Payload | Duration (observed) |
|---|---|---|---|---|
| `check` | `run_wtd_load_test.cmd check` | 0 | `wtd_payload_30mb.zip` (pre-flight only) | ~4 s |
| `smoke` (default) | `run_wtd_load_test.cmd smoke` | 2 | `wtd_payload_30mb.zip` (30 MB) | ~3 s |
| `full` | `run_wtd_load_test.cmd full` | 30 | `wtd_payload_30mb.zip` (30 MB) | ~12 s |

`check` works at any time. `smoke`/`full` depend on the server's upload gate (§1.3); when it is closed
they fail with HTTP 463. That is intermittent — retry before investigating.

To run with your own password, set it on its own line (a trailing space before `&&` becomes part of the
value):

```cmd
set "MSOSE_PWD=yourpassword"
run_wtd_load_test.cmd full
```

The runner picks its own output names from the local time (`yyyyMMdd-HHmmss`), creates `result/` and
`report/` if needed, and prints the JTL and dashboard paths.

Git Bash / Linux, where the password is never embedded:

```bash
export MSOSE_PWD=yourpassword
./run_wtd_load_test.sh check
./run_wtd_load_test.sh smoke
./run_wtd_load_test.sh full
```

The shell runner exports `JAVA_HOME` only if it is unset and `/c/Program Files/Java/jdk-17` exists.

### 5.2 What the run does, step by step

1. **Pre-flight** (no network): password present (or `MSOSE_PWD`), payload exists, non-empty and
   ≤ 30 MiB.
2. **Login transaction** (no captcha):
   1. `GET /MSOSE/index` — gets a session and a CSRF token.
   2. `POST /MSOSE/checkResult` — the browser-config gate (12 `configModel.*` fields).
   3. `POST /MSOSE/index` with `preAction=/security/login` — returns the public menu, not the form.
   4. `GET /MSOSE/security/login` — the real login form and a fresh token. The response must contain
      `name="mso.userId"` and must not contain `name="captcha"`; otherwise the sample fails and the
      guard stops the run **before** the login POST.
   5. `POST /MSOSE/security/login` with `mso.userId` and `mso.passwd`. The assertion requires the
      dashboard (`/wtd/001s0`) and no login form.
3. **Wizard**: `GET 001s0` → POST Next → `GET 001s1` → POST accept terms (`command=true&
   wtd_checkbox_command=true`) → asserts the uploader page (`id="mime-type"`).
4. **Upload loop** (`num_uploads` times): `POST /MSOSE/common/bUpload_x.action` with the Struts token,
   `requestCSRFHeader=renew`, multipart `name=o_<unique>.<ext>` + `file`, header `app-uploader: Y`.
   Each response must be HTTP 200, contain `success:true`, and not contain `<html`. The rotated
   `X-CSRF-TOKEN` response header becomes the token for the next request.
5. **Verify**: `GET /MSOSE/wtd/001s2-2`; page must still be step 2 and none of the uploaded temp names
   may appear (they are temp-only until the step's Next).
6. **Run summary** in the log: `RUN SUMMARY uploads=<n> expected=<n> persist=false user=JL0003`.

Default `persist_uploads=false` means the run **does not** write anything into the UAT draft.

### 5.3 What success looks like

- Console summary: `check` = **12** samples, `smoke` = **14**, `full` = **42**, all with `Err: 0`.
  (JMeter's exit code is 0 even when assertions fail, so the `Err:` count is the real gate.)
- Log contains `PRE-FLIGHT OK` and `RUN SUMMARY uploads=<n> expected=<n>`; it contains **no**
  `CAPTCHA` line. `RUN SUMMARY` counts *attempted* uploads, so pair it with `Err: 0` — a 463 run
  still reports `uploads=2 expected=2`.
- JTL has the expected number of `0401 POST bUpload_x` rows, all `responseCode=200` and
  `success=true` (`check` has none).
- The verify sampler passes.
- Dashboard has no errors and, for `full`, the upload label dominates the byte count
  (≈900 MB).

The difference between the console count and the JTL row count is normal: the JTL also stores redirect
sub-samples and Transaction Controller markers, which the summariser does not count.

### 5.4 The optional `persist_uploads` branch (do not enable casually)

`-Jpersist_uploads=true` makes the plan submit the upload page with its 30 rows, go Back, and then
submit with `TR1_count=0` to capture the server's rejection
(*"Transaction Summary must be uploaded for the purpose of verification"*). **This writes 30 files into
JL0003's UAT draft and there is no HTTP way to remove them** — clearing is a UI operation. The branch
is therefore disabled by default. Only use it on a disposable account.

Observed on 2026-10-30 with the flag enabled for a 2-upload smoke
(`result/smoke-20261030-155830`): the uploads passed (2/2 HTTP 200 + `success:true`) and `0601`, `0602`
and `0603` returned 200, but `0604 GET 001s3` failed with *"001s3 not reachable after the persist run"*
(`Err: 1`). So the branch's last assertion still does not match the deployed flow; do not treat a
persist-mode run as a supported verification path. The two files remain in the draft until cleared in
the UI.

**Enabling it from a runner** (both runners default to `false`, so nothing changes unless you opt in):

```cmd
set PERSIST_UPLOADS=true
run_wtd_load_test.cmd smoke
```

```bash
export MSOSE_PWD=abcd1234 PERSIST_UPLOADS=true
./run_wtd_load_test.sh smoke
```

The runner echoes `persist_uploads=true` in its `[INFO]` line; `PRE-FLIGHT OK ... persist=true` and
`RUN SUMMARY ... persist=true` in the JMeter log confirm the plan received it. Any value other than
`true`/`false` aborts before JMeter starts.

**Verified on 2026-10-30** with a 1-upload persist run
(`result/persist-probe-1upload-20261030-164356`): the run wrote the row into the draft addressed
as `001s2-2` and the uploader on that page then listed `wtd_payload_30mb.zip` (30,009,291 bytes). The
step's document set is **replaced** on every Next — after four persist runs of 2 uploads only the last
run's 2 rows remained, and a 1-upload run left exactly 1 row. Note the plan always targets draft
`001s2-2` (the `-2` suffix is hardcoded in every wizard path); a draft with a different id, e.g.
`001s2-84`, is a separate submission and is not touched. To inspect the result, log in and walk
step 0 → Next → step 1 → accept terms → step 2; a direct GET of a step URL redirects back to step 0.


---

## 6. Reading the results

### 6.1 The JTL (CSV)

Columns: `timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,
failureMessage,bytes,sentBytes,grpThreads,allThreads,Latency,IdleTime,Connect`.

Quick checks (PowerShell or any CSV tool):

- Count uploads: rows where `label` is `0401 POST bUpload_x` → must equal `num_uploads`.
- Failures: rows where `success` is `false`.
- Gate: any `responseCode` of `463` means the server's upload gate rejected the request; retry later.
- Bytes: sum of `sentBytes` for the upload rows ≈ 30.01 MB × N (30,010,176–30,010,188 bytes per upload, including multipart overhead).

Because the runners disable URL/header/body saving, the JTL deliberately contains no CSRF tokens,
session ids or passwords and cannot be replayed for protocol debugging. Re-run with
`-Jjmeter.save.saveservice.url=true` etc. temporarily if you need that.

### 6.2 The HTML dashboard

Open `report\<mode>-<stamp>\index.html`:

- **Statistics** — per-label count, average, median, 90/95/99th percentile, min/max, error %.
- **Response times over time / throughput** — should be flat for a sequential single-user run.
- **Errors** — empty on a healthy run.

The dashboard is static HTML; it can be zipped and sent to someone who does not have JMeter.

### 6.3 Key log lines

```text
PRE-FLIGHT OK file=... bytes=... mime=... uploads=30 persist=false
RUN SUMMARY uploads=30 expected=30 persist=false user=JL0003
```

`RUN SUMMARY` records the loop count (`expected` = `num_uploads`), not the number of successful
uploads; check the summariser's `Err:` value or the JTL for real success.

If the login page contains a captcha, sample `0104` fails with
`login form contains a captcha field: check CTRL_PARM_TBL LOGIN_CHECK_CAPCHA = 'N' ...` and the
`CAPTCHA re-enabled on the login page; stopping before the login POST` error is logged; the login POST
is not sent. If the form looks right but login still fails, the password is wrong or the server is
enforcing the captcha for another reason; the dashboard assertion reports it.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `[ERROR] JMeter not found: ...` | Kit not next to JMeter, or wrong `JMETER_HOME` | Set `JMETER_HOME` or move the folder |
| `[ERROR] Active proxy in ...system.properties` | A proxy line is active again | Comment the four `http(s).proxy*` lines out, or prefix them (e.g. `DISABLED_FOR_INTERNAL_UAT http.proxyHost=...`). The guard only matches a line that *starts* with `http.proxyHost=` |
| `PRE-FLIGHT FAILED: user_pwd is not set` | `MSOSE_PWD` empty when using the `.sh`, or a wrapper cleared it | `export MSOSE_PWD=...` / `set MSOSE_PWD=...` |
| `assert captcha disabled` fails / `CAPTCHA re-enabled` in the log | `LOGIN_CHECK_CAPCHA` is not `'N'`, or the `codeTable` cache has not refreshed | Ask the environment owner; allow up to ~15 min; do **not** repeat the run |
| Login returns the form again | Wrong password, or the captcha is enforced server-side | Verify the password/account; check the switch |
| `UnknownHostException` | DNS cannot resolve the configured `host` | Check the runner's `-Jhost=10.12.128.248`; the IP needs no name resolution |
| TLS/handshake error | Not a certificate problem — JMeter's sampler is trust-all | Check `-Jhost`/`-Jport` and network reachability; a strict client (`curl`) will report certificate issues separately |
| `HTTP 463` on uploads | Server-side upload gate closed (intermittent; it can reopen within minutes) | Retry after a few minutes, then run `check`; login still works at any time |
| `HTTP 400` on uploads | MIME or extension not accepted (`application/x-zip-compressed` and renamed non-ZIP files are rejected) | Use `application/zip` and a genuine `.zip` (the plan default) |
| `302` to `/MSOSE/sysMsg` | Missing/expired CSRF token or session | Do not deep-link; re-run the plan from the pre-flight |
| Session drops mid-run | Idle timeout < 90 s on this environment | The plan keeps the session busy; do not add think-time without a keep-alive |
| `Cannot write to ... because it already exists` | The dashboard output folder already exists | The runners timestamp the folder; use a new name or delete the old one |
| All requests go to 127.0.0.1 | A stale `-Jhost` | Check `host` in the runner |

For anything that looks like an application problem rather than a harness problem, capture the JTL,
the JMeter log and the dashboard before changing the plan.

---

## 8. Security and handling notes

- **The `.cmd` contains the JL0003 UAT test password** at your request. Treat the folder as
  sensitive when sharing outside the team; the `.sh` does not embed it.
- **No executable is shipped.** The retired Node.js runtime and captcha solver are only in
  `ARCHIVE/captcha-audio` for history; nothing in the runnable kit uses them. This also means there is
  no `.exe` for mail gateways or SmartScreen to block, and the shareable kit is about 50 MiB (without
  `ARCHIVE`).
- The password is never passed as `-Juser_pwd` (JMeter would log it) and never appears in the JTL,
  the JMeter log or the dashboard. If you set `user_pwd` in the GUI, expect it in JMeter's log.
- `work/relogin.sh` deletes its cookie jar and captured pages on exit. Session jars captured during
  development were deleted, not archived.
- `ARCHIVE/work` contains captured pages and request headers from the live session. They were scrubbed
  of the password, but review before sharing outside the team.
- Default runs are **upload-only**: files stay in the server's per-session temp folder and are
  discarded; the draft is untouched. Only `persist_uploads=true` writes to the draft.

---

## 9. Appendix A — the live request contract

Captured from the deployed UAT build on 2026-10-27/28; useful when the application changes and the
plan needs updating.

### 9.1 Login

| Step | Request | Notes |
|---|---|---|
| 1 | `GET /MSOSE/index` | new session + Struts token |
| 2 | `POST /MSOSE/checkResult` | `struts.token.name=token`, `token=...`, 12 `configModel.*` fields (OS, browser, JS/cookies enabled, Flash/Java/PDF disabled) |
| 3 | `POST /MSOSE/index` | `preAction=/security/login`, `nextBtn_=Home`; returns the public menu |
| 4 | `GET /MSOSE/security/login` | login form + fresh token; **must not contain `name="captcha"`** (§1.2) |
| 5 | `POST /MSOSE/security/login` | `token`, `mso.userId`, `mso.passwd`; success → 302 to `/MSOSE/index` and the dashboard contains `/wtd/001s0` |

The historical captcha requests (`GET /captcha`, `GET /loadCaptchaSound.wav`) are **not** part of the
current flow. See `ARCHIVE/` and `VERIFICATION_REPORT.md` for the archived solver and the earlier
contract.

### 9.2 Wizard

| Step | Request |
|---|---|
| Upload step 0 | `GET /MSOSE/wtd/001s0-2` |
| Next | `POST /MSOSE/wtd/001s0-2` with `struts.token.name=token`, `token=...` |
| Upload step 1 | `GET /MSOSE/wtd/001s1-2` |
| Accept terms | `POST /MSOSE/wtd/001s1-2` with `command=true&wtd_checkbox_command=true` + token |
| Upload page | `GET /MSOSE/wtd/001s2-2` (contains `id="mime-type"`) |

### 9.3 Upload

```
POST /MSOSE/common/bUpload_x.action?struts.token.name=token&token=<t>&requestCSRFHeader=renew
Content-Type: multipart/form-data
Header: app-uploader: Y

name=<o_...>.<ext>
file=<payload>   (Content-Type: <upload_file_mime>)
```

Success body: `success:true`; response header `X-CSRF-TOKEN` carries the next single-use token (the
plan feeds it back into `csrfToken` on both success and failure).

Accepted MIME type: `application/zip` only (ZIP-only UAT rule, 2026-10-30).
Accepted extension: `zip`. A file with a `.zip` name but non-ZIP magic bytes is rejected with
"File type mismatch". The page accepts up to 52,428,800 bytes per file; the
kit deliberately caps the payload at 30 MiB (31,457,280 bytes) in its pre-flight. Earlier runs also
accepted `xls`, `xlsx`, and `xml`; those are retained as history in `VERIFICATION_REPORT.md`.

Uploads are **temp-only** until the step's Next. `TR1_count=0` (the "Empty All" outcome, which is a
client-side DOM action only) is rejected by the server — you cannot clear a submitted transaction
summary over HTTP.

---

## 10. Appendix B — settings in the `.jmx` vs the requirement

This section answers two questions for anyone reviewing or handing over the kit:

1. **Where does a setting come from?** (Which element, which line, and how does `${base}` become `/MSOSE`?)
2. **Does the plan still match `requirement.txt` / `requirement_final.md`?** Where it does not, why not?

Line numbers are for this revision of `MSOSE_UAT_wtd_upload_load_test_v2.jmx`; element and variable
names are stable, so grep by name if a line has moved.

### 10.1 Three layers: property → variable → request

```text
-Jnum_uploads=2                        property, supplied on the command line
        │  ${__P(num_uploads,30)}      Test Plan → User Defined Variables
        ▼
num_uploads = 2                        JMeter variable for this thread
        │  ${num_uploads}
        ▼
LoopController.loops = 2               the component that consumes it
```

- `${__P(name,default)}` is JMeter's **property** function. It reads `-Jname=...`; if the property is
  absent it returns the literal text after the comma. Every entry in *User Defined Variables* is
  written this way, which is why nothing needs editing to change a run.
- `${name}` is a **variable** reference, resolved when the sampler runs. The pre-flight can therefore
  fill `upload_file` after the variables have been created.
- Property names are **case-sensitive**: `-JBase=` does not override `base`.
- `scheme`, `host` and `port` are applied once, by **HTTP Request Defaults**, not repeated in 15
  samplers. Sampler paths start at `${base}` because only the context path differs per request.

### 10.2 Where each setting lives

| Setting | JMX element / variable | Line | Default | Consumed by |
|---|---|---|---|---|
| `scheme` | Test Plan → UDV | 10–14 | `https` | HTTP Request Defaults (104) |
| `host` | Test Plan → UDV | 15–19 | `10.12.128.248` | HTTP Request Defaults (102) |
| `port` | Test Plan → UDV | 20–24 | `7012` | HTTP Request Defaults (103) |
| `base` | Test Plan → UDV | 25–29 | `/MSOSE` | every sampler path (15 uses) |
| `user_id` | Test Plan → UDV | 30–34 | `JL0003` | login POST `mso.userId` |
| `user_pwd` | Test Plan → UDV | 35–39 | *(empty)* | pre-flight (fills from `MSOSE_PWD`), login POST |
| `user_count` | Test Plan → UDV | 40–44 | `1` | Thread Group threads (90) |
| `ramp_time` | Test Plan → UDV | 45–49 | `0` | Thread Group ramp (91) |
| `run_iterations` | Test Plan → UDV | 50–54 | `1` | Thread Group loop (86–89) |
| `num_uploads` | Test Plan → UDV | 55–59 | `30` | upload Loop Controller (722) |
| `upload_file` | Test Plan → UDV | 60–64 | *(empty)* → `wtd_payload_30mb.zip` | pre-flight default (134–136), multipart file (740) |
| `upload_file_mime` | Test Plan → UDV | 65–69 | `application/zip` | multipart file MIME (742) |
| `upload_ext` | Test Plan → UDV | 70–74 | `zip` | upload name builder (770) |
| `persist_uploads` | Test Plan → UDV | 75–79 | `false` | If Controller (891) |
| Upload loop count | Loop Controller `UploadLoop` | 720–723 | `${num_uploads}` | one POST per iteration |
| Upload endpoint | `0401 POST bUpload_x` | 725–754 | — | path, multipart, `requestCSRFHeader=renew` |
| `app-uploader: Y` | Header Manager under upload | 756–763 | — | required by the server |
| Unique file name | `build upload name` pre-processor | 765–775 | `o_lt<thread>_<epoch>_<idx>.<ext>` | sets `uploadName` |
| Name collection | `capture rotated token + row meta` | 807–823 | — | `uploadedNames`, `uploadedMeta`, next `csrfToken` |
| Verify (no persistence) | `0501 GET 001s2 reload` | 833–888 | — | step 2 assertion + temp-name check |
| Optional persist branch | If Controller | 890–894 | disabled | only when `persist_uploads=true` |

**Runtime-only variables** (not in User Defined Variables, created during the run): `csrfToken`
(extracted from each page), `pageToken`, `uploadName`, `uploadSize`, `uploadOrigName`,
`uploadedNames`, `uploadedMeta`, `persistBody`. They are deliberately not persisted anywhere.

### 10.3 Worked example — how to check `${base}`

1. **Find the definition** (one place only):

   ```bash
   grep -n 'name="base"' MSOSE_UAT_wtd_upload_load_test_v2.jmx
   ```

   Output points at lines 25–29, whose value is `${__P(base,/MSOSE)}` — i.e. *property `base`, or
   `/MSOSE` when the property is not set*.

2. **Find every use** (15 occurrences):

   ```bash
   grep -n '\${base}' MSOSE_UAT_wtd_upload_load_test_v2.jmx
   ```

   The first is line 155 (`${base}/index`); the upload is line 746
   (`${base}/common/bUpload_x.action?...`). Note `${base}` is a *variable* reference here, not
   `${__P(...)}` — the `__P` form appears only in the definition.

3. **Read the effective URL.** Take the sampler at line 746 and resolve each piece:

   | Piece | Source | Value |
   |---|---|---|
   | `${base}` | UDV line 27 | `/MSOSE` |
   | `${scheme}` | HTTP Request Defaults line 104 | `https` |
   | `${host}` | HTTP Request Defaults line 102 | `10.12.128.248` |
   | `${port}` | HTTP Request Defaults line 103 | `7012` |

   → `https://10.12.128.248:7012/MSOSE/common/bUpload_x.action?struts.token.name=token&token=…`

4. **Check or change it at run time.** In the GUI: *Test Plan → User Defined Variables*, row `base`.
   From the command line: `-Jbase=/MSOSE` — but see the warning below.

5. **Inspect all variables in one shot:**

   ```bash
   grep -o '\${[^}]*}' MSOSE_UAT_wtd_upload_load_test_v2.jmx | sort | uniq -c | sort -rn
   ```

   PowerShell equivalent:

   ```powershell
   Select-String -Path .\MSOSE_UAT_wtd_upload_load_test_v2.jmx -Pattern '\$\{[^}]+\}' -AllMatches |
     ForEach-Object { $_.Matches.Value } | Group-Object | Sort-Object Count -Descending
   ```

> **`${base}` from Git Bash is a trap.** MSYS rewrites a leading-slash argument: `-Jbase=/MSOSE`
> reaches the JVM as `-Jbase=C:/Program Files/Git/MSOSE`, and every request 404s. That is why
> `run_wtd_load_test.sh` does **not** pass `-Jbase` (the in-file default is already correct), while the
> `.cmd` runner can pass it safely. If you really must override it from Bash, prefix that one command
> with `MSYS_NO_PATHCONV=1` (or `MSYS2_ARG_CONV_EXCL='*'`).

**Why the default `host` is the IP from `requirement.txt`.** The requirement's URL is
`https://10.12.128.248:7012/MSOSE/index`. The server's certificate identifies itself only by name.
Inspecting the bundled truststore confirms it:

```text
Owner: CN=deveas.mso.customs.hksarg, OU=Customs and Excise Department, ...
SubjectAlternativeName [
  DNSName: deveas.mso.customs.hksarg
]
```

There is **no `IPAddress` entry** in the SAN list, so strict clients reject the IP URL even when the
certificate chain is trusted:

```text
curl https://10.12.128.248:7012/MSOSE/index                     -> SSL peer certificate ... not OK
curl --resolve deveas.mso.customs.hksarg:7012:10.12.128.248 \
     https://deveas.mso.customs.hksarg:7012/MSOSE/index         -> HTTP 200
```

That name check is a browser/`curl` property, not a JMeter one. JMeter 5.5's HttpClient4 path builds its
client with a **trust-all** socket factory — every run logs
`INFO ... LazyLayeredConnectionSocketFactory: Setting up HTTPS TrustAll Socket Factory` — so it checks
neither the certificate name nor the chain. The truststore is therefore optional: `uat-truststore.jks`
is kept for browsers and other strict clients, and the `.cmd` runner's `JVM_ARGS` line is disabled in
this copy. Literal-IP runs were verified on 2026-10-30: `check` = 12 samples, 0 errors
(`result/probe-ip-check`), and a two-upload probe = 14 samples, 0 errors with 2/2 uploads `200` +
`success:true` (`result/probe-ip-upload`). The TrustAll line appears in both
`result/smoke-20261030-165047.log` (truststore arguments set) and
`result/smoke-20261030-172326.log` (truststore line commented out), with identical results.

Targeting the IP also removes the DNS problem: on the office network
`deveas.mso.customs.hksarg` resolves to **10.12.187.171**, an unrelated host that answers 404. The IP
needs no name resolution, so no hosts-file override is involved.

Practical consequences:

- Keep `host=10.12.128.248` in the plan and the runners. No hosts file and no
  `-Djdk.net.hosts.file` are used.
- TLS is **not authenticated** by this plan: a green run says nothing about the server's certificate or
  chain. Use `curl` or a browser if you need to validate those.
- In a browser the same IP URL shows a certificate-name warning. That is expected: browsers do check the
  name, which is why the browser needs an exception or a hosts entry. The load test is unaffected.

### 10.4 Requirement vs implementation

Requirement IDs are from `requirement_final.md` §4.

| REQ | What was asked | What the plan does | Verdict |
|---|---|---|---|
| REQ-001 | Configurable UAT base URL | `scheme`/`host`/`port`/`base`, all `-J`-overridable; default host is the UAT IP from the requirement | **Met** |
| REQ-002 | `JL0003`; configurable password; never in results | `user_id=JL0003`; `user_pwd` blank; pre-flight falls back to `MSOSE_PWD`; runners never pass `-Juser_pwd`; JTL has no headers/bodies | **Met**, except the `.cmd` default password (explicit user request) |
| REQ-003 | Session retained across steps | HTTP Cookie Manager (112) + token extractor on each page + rotated `X-CSRF-TOKEN` after every upload | **Met** |
| REQ-004 | Ordered navigation | Transaction Controllers `01`→`05` in tree order; one thread executes them sequentially | **Met** |
| REQ-005 | Default `LIC_APP_TBL.xlsx`, overridable | Blank `upload_file` → pre-flight resolves `wtd_payload_30mb.zip` next to the JMX; `full` overrides with the same file | **Met** (payload changed to ZIP on 2026-10-30) |
| REQ-006 | File exists/readable before load; fail fast | Groovy pre-flight: present, non-empty, ≤ 31,457,280 bytes; `fail` sets the sample failed and stops the test | **Met** (adds the size cap) |
| REQ-007 | Exactly 30 uploads per user per workflow | `num_uploads=30` and the upload loop uses it; `full` = 30 | **Met** in `full`; `check`=0 and `smoke`=2 are deliberate diagnostic profiles |
| REQ-008 | Unique file name per upload | `o_lt<thread>_<epoch>_<loopIndex>.<ext>` (line 770) | **Met** (prefix differs from the draft's `temp…`) |
| REQ-009 | Assert each upload (HTTP 200 + app indicator) | Three assertions: `200`, `success:true`, no `<html` (777–805) | **Met**; see §10.5 item 9 on continue-vs-abort |
| REQ-010 | Empty All, verify cleared, revisit step 3 | Upload-only verify by default; optional branch models Next/Back/`TR1_count=0` and asserts rejection | **Partly met / deviation** — see §5.4 |
| REQ-011 | Users, ramp-up, iterations configurable | `user_count`, `ramp_time`, `run_iterations` | **Met** (names differ; default ramp is 0, not 60) |
| REQ-012 | One workflow per user, no unbounded loops | Thread Group loop `${run_iterations}`=1 and `continue_forever=false`; upload loop bounded by `num_uploads` | **Met** |
| REQ-013 | Default UAT, never silently Prod | Host default is the UAT IP (10.12.128.248); no separate guard | **Default-only** — `-Jhost=` can retarget any environment; check before running |
| REQ-014 | Machine-readable results + HTML summary | JTL via `-l`, dashboard via `-e -o`, mode/timestamp in the path | **Met** |
| REQ-015 | No passwords/session secrets in results | `jmeter.save.saveservice.url/requestHeaders/responseHeaders/response_data/samplerData=false` | **Met** (the `.cmd` credential is a source-file exposure, not a result-file one) |

### 10.5 Deliberate deviations from the draft requirement

The draft (`requirement_final.md`) was written before the live flow was captured. These differences are
intentional; each one was forced by the deployed application or by a safety constraint.

1. **Login is not one POST.** The deployed application requires the config gate
   (`POST /checkResult`), a token extracted from each page, and an explicit `GET /security/login`
   before the credentials POST. The draft assumed `GET /index` → `POST /security/login.action`.
2. **Credential field names are `mso.userId` / `mso.passwd`**, not `user.userId` / `user.pwd`; the
   captcha field is no longer sent (UAT switch off).
3. **Upload endpoint is `/common/bUpload_x.action`**, not `/common/bUpload.action`, and needs the
   Struts token in the query string, `requestCSRFHeader=renew`, `app-uploader: Y`, and replay of the
   rotated `X-CSRF-TOKEN` header.
4. **"Empty All Upload Files" is not a server request.** It is a client-side DOM clear; uploading then
   submitting `TR1_count=0` is rejected server-side. The default plan therefore verifies the upload
   list without persisting anything, and the literal step 8 is modelled only behind
   `persist_uploads=true` (§5.4).
5. **The MIME default is `application/zip`.** UAT currently accepts only ZIP; `.xlsx`, `.xls`, and
   `.xml` were accepted during the earlier capture but are no longer used. `application/x-zip-compressed`
   is rejected, and a `.zip` whose content is not a ZIP fails the server's magic-byte check.
6. **"30MB" is implemented as 30 MiB (31,457,280 bytes), and the ZIP payload is 30,009,291 bytes.** The
   page accepts up to 52,428,800 bytes, but the kit keeps a stricter client cap.
7. **Variable names changed** from the draft §6.1: `host_IP`→`host`, `host_Port`→`port`,
   `user_name`→`user_id`, `ramp_up`→`ramp_time`. `think_time` and `mso_id_prefix` were removed — the
   flow keeps the session busy (idle timeout under 90 s) and the file name is generated per upload.
8. **Concurrency stages were not implemented.** `JL0003` is a single-session UAT account, so the
   5- and 10-user stages in the draft cannot run; raising `user_count` needs additional accounts.
9. **Uploads are recorded and the run continues.** `ThreadGroup.on_sample_error=continue` (line 85)
   and per-sample assertions mean one failed upload does not hide the remaining samples; the pass/fail
   gate is `Err: 0` in the summary or the JTL, not a thrown exception.
10. **Steps 6, 7 and 9 of the requirement exist only in the optional branch.** The default run stops at
    the step-2 reload because persisting writes 30 files into the UAT draft with no HTTP cleanup.

### 10.6 Audit recipes

Use these before changing the plan, and again after:

```bash
# Every variable reference, most used first
grep -o '\${[^}]*}' MSOSE_UAT_wtd_upload_load_test_v2.jmx | sort | uniq -c | sort -rn

# Definitions only (name + value pairs)
grep -n '<stringProp name="Argument.name">' -A1 MSOSE_UAT_wtd_upload_load_test_v2.jmx

# Where one variable is used
grep -n '\${base}' MSOSE_UAT_wtd_upload_load_test_v2.jmx

# Absolute paths (should be empty — the plan resolves everything relative to the JMX)
grep -nE 'C:\\\\|/Users/|/home/' *.jmx

# Password literal in the plan (should be empty; it lives in run_wtd_load_test.cmd only)
grep -n 'abcd1234' *.jmx

# Still well-formed after an edit
powershell -NoProfile -Command "[xml](Get-Content -Raw 'MSOSE_UAT_wtd_upload_load_test_v2.jmx') | Out-Null; 'XML OK'"
```

Interpretation rules:

- A `${name}` with no matching `Argument.name` definition is either a runtime variable
  (`csrfToken`, `pageToken`, `uploadName`, …) or a typo. Compare against the list in §10.2.
- A variable read from Groovy does **not** appear as `${…}`: `upload_ext`, `persist_uploads`,
  `user_pwd` and `upload_file` are also consumed through `vars.get(...)` in the pre-flight,
  name builder or If Controller. Check both forms before calling a variable dead:

  ```bash
  grep -n "vars.get('" MSOSE_UAT_wtd_upload_load_test_v2.jmx
  ```

- A `${__P(x,default)}` that appears twice is two independent definitions; the plan deliberately keeps
  one per setting.

### 10.7 Checking the effective values at run time

- The pre-flight line is the supported runtime report:
  `PRE-FLIGHT OK file=… bytes=… mime=… uploads=… persist=…`.
- `RUN SUMMARY uploads=… expected=… persist=… user=…` confirms the loop count and user.
- URLs are **not** written to the JTL by design (REQ-015). To see one, open the plan in the GUI and
  read *Test Plan → User Defined Variables* plus the sampler path, or temporarily enable URL saving
  (`jmeter.save.saveservice.url=true`) and run with the same JVM arguments the runner builds.
- To see the resolved value of every variable after the pre-flight has run, add a temporary
  **Debug Sampler** to the thread group (*JMeter Variables* = True), run `check` with *View Results
  Tree* enabled, and read the `base`, `host`, `port`, `upload_file`, `csrfToken`, `uploadName`, …
  rows. Remove the sampler afterwards so it does not pollute the JTL and dashboard.
- Fastest sanity check of the whole configuration chain is `run_wtd_load_test.cmd check`: 12 samples,
  0 errors, and the pre-flight/summary lines above. If a path or variable is wrong, it fails there
  before any upload.

---

*Kit prepared 2026-10-28; upload payload switched to ZIP-only on 2026-10-30. The plan was revised on
2026-10-28 to remove the audio-captcha login after UAT disabled `LOGIN_CHECK_CAPCHA`. If the
application, certificate, account or upload policy changes, update `VERIFICATION_REPORT.md` alongside
this file; if a setting is added or renamed, update §10.2 and the requirement matrix §10.4.*
