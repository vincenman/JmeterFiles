# MSOSE UAT JMeter plan: setup and modification guide

This guide teaches how the file `MSOSE_UAT_wtd_upload_load_test_v2.jmx` is built and how to change it
safely. It is written for study and review, and it is the companion to `README.md`:

| Document | Answers |
|---|---|
| `README.md` | What the kit is, how to run it, what the results mean, and how the settings map to the requirement |
| **this guide** | **How to build the plan step by step in the JMeter GUI, why each component exists, and how to modify it without breaking the flow** |
| `VERIFICATION_REPORT.md` | Why the plan looks the way it does: the original defects, the live contract, evidence, and residual risks |

The file extension is **`.jmx`** (JMeter test plan XML). "jml" in conversation is shorthand for it; JMeter
itself only knows `.jmx`.

---

## Contents

- [Part 0. Read this first](#part-0-read-this-first)
- [Part 1. Prerequisites and environment](#part-1-prerequisites-and-environment)
- [Part 2. GUI tour and reading the plan](#part-2-gui-tour-and-reading-the-plan)
- [Part 3. Lab 1: build a minimal working plan](#part-3-lab-1-build-a-minimal-working-plan)
- [Part 4. Labs 2-4: complete the workflow](#part-4-labs-2-4-complete-the-workflow)
- [Part 5. Modification recipes](#part-5-modification-recipes)
- [Part 6. Running and validating changes](#part-6-running-and-validating-changes)
- [Part 7. XML anatomy for careful edits](#part-7-xml-anatomy-for-careful-edits)
- [Part 8. Study exercises with answers](#part-8-study-exercises-with-answers)
- [Appendix A. Variables reference](#appendix-a-variables-reference)
- [Appendix B. Element inventory](#appendix-b-element-inventory)
- [Appendix C. Glossary](#appendix-c-glossary)
- [Appendix D. Cross-references and audit commands](#appendix-d-cross-references-and-audit-commands)

---

## Part 0. Read this first

### 0.1 What the plan does

One JMeter thread performs one complete wtd transaction-data workflow against MSOSE UAT:

```text
00 Pre-flight (no network)          password + payload checks; stop if bad
01 Login (5 requests)               config gate -> login form -> credentials
02 Wizard 001s0 (GET + POST)        overview step 0 -> step 1
03 Wizard 001s1 (GET + POST)        terms step 1 -> step 2 (uploader page)
04 Upload (loop, N times)           POST bUpload_x; rotate the CSRF token each time
05 Verify                           reload step 2; uploaded temp names must be absent
06 Optional persist (If)            disabled unless persist_uploads=true (destructive)
99 Run summary                      write RUN SUMMARY to the log
```

Sample counts for the current plan:

| Profile | Uploads | Console sample count | What it proves |
|---|---|---|---|
| `check` | 0 | **12**, `Err: 0` | Pre-flight, login, both wizard steps, verify, summary |
| `smoke` | 2 | **14** (`Err: 0` when the upload gate is open; `Err: 2` with HTTP 463 when it is closed) | The whole flow including two uploads |
| `full` | 30 | **42**, `Err: 0` | The full requirement (12 + 30 uploads). Verified on 2026-10-30 with 30/30 `success:true` (`result/full-20261030-122520`) |

`check` = 1 pre-flight + 5 login + 2 wizard GET + 2 wizard POST + 1 verify + 1 summary = **12**.
Each upload adds one sample, so `smoke` = 14 and `full` = 42.

### 0.2 Two ways to use this guide

**Path A - read-only study (safest).** Open the existing plan and follow Part 2. Every element is
explained with its line number and purpose; Parts 3-4 describe how it would be built from an empty plan.

**Path B - hands-on practice.** For the build lab, use **File -> New** and save the result as
`MSOSE_UAT_wtd_upload_load_test_study.jmx`. For modification practice, make a **Save As** copy of the
delivered plan and edit the copy. Never practice on the delivered file while another JMeter window has it
open: the GUI holds the plan in memory and saving from it overwrites disk changes.

### 0.3 Safety rules

These are not optional. The target is a shared UAT environment with a real account.

| Rule | Why |
|---|---|
| **Run against UAT only** | The plan defaults to the UAT IP, but `-Jhost=` can point it anywhere. Check the runner before starting (`-Jhost=10.12.128.248`). |
| **One session only** | `JL0003` has a single-active-session rule. Do not run two plans, or keep a browser logged in as the same user. |
| **Five failed logins lock the account** | Do not loop a failing login. If the captcha reappears, stop and fix the server switch first. |
| **Captcha must be disabled server-side** | `CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA='N'`. The plan asserts the login form has no `name="captcha"` and stops **before** the login POST if it does. |
| **Uploads are timeslot-gated** | Outside the window the server returns HTTP 463. Login and wizard still work; use `check` to test them. A 463 is an environment gate, not a plan defect. |
| **`persist_uploads=true` is destructive** | It writes `num_uploads` files into the UAT draft and there is no HTTP way to clear them. Use only on a disposable account. |
| **Do not add the password to the `.jmx`** | The GUI stores UDV values in the file, and JMeter logs every `-J` property. Use `MSOSE_PWD` (the `.cmd` already embeds the agreed test password by explicit request; the `.sh` requires the variable). |
| **Close the GUI before editing the file on disk** | Otherwise a GUI save overwrites your edit, or a reload loses it. |

### 0.4 What "success" looks like

- Console summary: `check` 12 samples, `smoke` 14, `full` 42, with `Err: 0` when the environment is
  healthy and the upload window is open.
- Log: `PRE-FLIGHT OK ...`, `VERIFY pages: ...`, `RUN SUMMARY uploads=<n> expected=<n> ...`.
- JTL: every `0401 POST bUpload_x` row has `responseCode=200` and `success=true`.
- **JMeter's process exit code is not the gate.** It returns 0 even when assertions fail. Judge by `Err:`
  in the console/JTL, or by the dashboard's error table.

---

## Part 1. Prerequisites and environment

### 1.1 Files you need

| File | Role |
|---|---|
| `MSOSE_UAT_wtd_upload_load_test_v2.jmx` | The plan |
| `wtd_payload_30mb.zip` | Default payload (30,009,291 bytes) for `check`/`smoke`/`full`, and the default when `upload_file` is blank. Genuine ZIP (`PK\x03\x04`) |
| `LIC_APP_TBL.zip` | 1,865,822-byte ZIP; optional smaller payload, still valid under the ZIP-only rule |
| `LIC_APP_TBL.xlsx` | Legacy 2,365,725-byte payload; rejected by the current ZIP-only server rule (kept for history) |
| `uat-truststore.jks` | Optional JKS truststore with the UAT certificate chain (password `changeit`). Not needed by JMeter (trust-all); kept for browsers/strict clients |
| `run_wtd_load_test.cmd` | Windows runner (sets up the optional truststore JVM args — disabled in this copy; picks the profile) |
| `run_wtd_load_test.sh` | Git Bash runner (same, but requires `MSOSE_PWD`) |
| `README.md`, `VERIFICATION_REPORT.md` | Run instructions and evidence |

There are no absolute paths in the plan or the runners. The pre-flight resolves the default payload
relative to the JMX directory, so keep the payload next to the `.jmx`.

### 1.2 Software check

```cmd
java -version
..\apache-jmeter-5.5\bin\jmeter.bat --version
```

JMeter 5.5 needs Java 8+; this kit was verified on Java 17. The plan uses only standard JMeter
components plus Groovy, which JMeter bundles. No plugins, Node.js, or external solver are required.

### 1.3 TLS, DNS, and the truststore

This is the part most likely to waste an hour if you assume the certificate matters to JMeter. It does not.

- The target is **`https://10.12.128.248:7012/MSOSE`**. It needs no name resolution, which matters
  because on the office network `deveas.mso.customs.hksarg` resolves to **10.12.187.171** - a different
  host that answers 404.
- The certificate is issued for **`deveas.mso.customs.hksarg`**. Its Subject Alternative Name contains
  only `DNSName: deveas.mso.customs.hksarg` - no IP address. Strict clients (browsers, `curl`)
  therefore reject the IP URL with a name-mismatch error even when the chain is trusted.
- JMeter is not strict at all here: version 5.5 builds its HTTP client with a **trust-all** socket
  factory and logs `LazyLayeredConnectionSocketFactory: Setting up HTTPS TrustAll Socket Factory` on
  every run. Neither the chain nor the certificate name is checked, so no truststore is required.
  Literal-IP runs were verified: `check` 12/0 (`result/probe-ip-check`) and two uploads at
  `200`/`success:true` (`result/probe-ip-upload`).
- The truststore arguments are therefore **optional** and the `.cmd` runner's `JVM_ARGS` line is
  disabled in this copy:

  ```text
  -Djavax.net.ssl.trustStore=<kit>\uat-truststore.jks
  -Djavax.net.ssl.trustStorePassword=changeit
  ```

**Consequence for the GUI:** a plain `jmeter.bat` launch is fine - opening the plan and pressing Start
both work, because TLS is trust-all and the proxy lines are already inactive. Use a runner anyway for the
proxy guard and timestamped results.

The full certificate evidence is in `README.md` §10.3. In a browser the IP URL shows a certificate-name
warning; that is the browser's check, not the load test's.

### 1.4 HTTP proxy

`apache-jmeter-5.5/bin/system.properties` may contain:

```properties
http.proxyHost=proxy1.scig.gov.hk
http.proxyPort=8080
https.proxyHost=proxy1.scig.gov.hk
https.proxyPort=8080
```

JMeter applies these with `HttpClientBuilder.setProxy()` and ignores `http.nonProxyHosts`; a `-J` override
does not clear them. Make all four lines inactive to reach internal UAT hosts — either comment them out
or prefix each with a non-property token:

```properties
DISABLED_FOR_INTERNAL_UAT http.proxyHost=proxy1.scig.gov.hk
DISABLED_FOR_INTERNAL_UAT http.proxyPort=8080
DISABLED_FOR_INTERNAL_UAT https.proxyHost=proxy1.scig.gov.hk
DISABLED_FOR_INTERNAL_UAT https.proxyPort=8080
```

The prefixed key is `DISABLED_FOR_INTERNAL_UAT http.proxyHost`, so the real property stays undefined and
the connection goes direct. Both runners check for a line that **starts** with `http.proxyHost=`
(`findstr /B`, `grep '^http\.proxyHost='`) and exit with code 3 before starting; prefixed or commented
lines pass, a genuine re-enable still aborts the run.

### 1.5 Captcha precondition

The login POST (`0107`) sends only the Struts token, `mso.userId`, and `mso.passwd`. UAT must have the
login captcha disabled:

| Item | Value |
|---|---|
| Table | `CTRL_PARM_TBL` |
| Row | `CTRL_PARM_CD = 'LOGIN_CHECK_CAPCHA'` (the application's spelling) |
| Disabled value | `PARM_VAL = 'N'` |

Only `Y` (case-insensitive) enables it; any other value disables it; a missing row means captcha is
required. The value is cached in the `codeTable` Ehcache (TTL 1200 s, refreshed around :01/:16/:31/:46),
so allow up to about 15 minutes after a database change.

`CHECK_CAPCHA` is a different switch (forgot-password/registration), not the login switch.

How the plan enforces this:

1. `0104 GET security/login` has **assert login form** (`name="mso.userId"` must be present).
2. It has **assert captcha disabled** (`name="captcha"` must be absent; Response Assertion test type 20).
3. A Groovy post-processor **stop if captcha is enabled** marks the sample failed and calls
   `ctx.getEngine().stopTest()` **before** `0107 POST security/login`. This is what protects the account
   from burning failed-login attempts.

If the captcha is re-enabled, do not rerun the plan repeatedly. Fix the switch, wait for the cache, and
run once.

### 1.6 Upload timeslot

`bUpload_x` returns **HTTP 463** outside the server's upload window with a message like
*"Please upload during assigned timeslot..."*. The window is server-controlled and clearly advisory:
the gate has closed and reopened within minutes (2026-10-30: `463` at 14:37, `200` at 14:40 and
15:18 for the identical two-upload profile). Login and the wizard steps work at any time. When 463
appears:

- the upload sample fails (assert 200), and the `04` transaction row is marked failed;
- `RUN SUMMARY` still says `uploads=2 expected=2` because it counts attempts;
- retry once after a few minutes; if it persists, wait for the published window or run `check`. Do not
  change the plan for a 463.

### 1.7 Account and session

`JL0003` is a real UAT account. The Cookie Manager plus the login flow creates one session; the plan
keeps it alive because the wizard and uploads run immediately, with no timers. Do not add long think
times: the environment's idle timeout is under 90 seconds.

### 1.8 What the runners set (memorize this)

The Windows runner builds essentially this:

```text
JVM_ARGS=-Djavax.net.ssl.trustStore=<kit>\uat-truststore.jks    (optional; disabled here)
         -Djavax.net.ssl.trustStorePassword=changeit

PROP=-Jjmeter.save.saveservice.url=false
     -Jjmeter.save.saveservice.requestHeaders=false
     -Jjmeter.save.saveservice.responseHeaders=false
     -Jjmeter.save.saveservice.response_data=false
     -Jjmeter.save.saveservice.samplerData=false
     -Juser_id=JL0003 -Jhost=10.12.128.248 -Jport=7012 -Jbase=/MSOSE
```

`check` adds `-Jnum_uploads=0`; `smoke` adds `-Jnum_uploads=2`; `full` adds
`-Jnum_uploads=30 -Jupload_file=...wtd_payload_30mb.zip
-Jupload_file_mime=application/zip -Jupload_ext=zip`.

The Git Bash runner is the same **without** `-Jbase` (MSYS rewrites `/MSOSE` into a Windows path) and
without a password default. It requires `MSOSE_PWD`.

The save-service flags are why the JTL contains no URLs, headers, or bodies: the plan deliberately cannot
leak the CSRF token or the password into results.

---

## Part 2. GUI tour and reading the plan

### 2.1 The GUI areas

Launch `..\apache-jmeter-5.5\bin\jmeter.bat`, then **File -> Open** the `.jmx`.

| Area | What it shows |
|---|---|
| Left: tree | The test plan hierarchy. Right-click a node for the **Add** menu; this is how you create every component. |
| Right-top: element panel | The selected component's fields (Thread Group numbers, HTTP Request method/path, assertion patterns, etc.). |
| Right-bottom / full panel: script editor | For JSR223 elements: Language, Parameters, Script file, Script, and the "Cache compiled script if available" checkbox. |
| Top toolbar | New/Open/Save, Start, Stop, Shutdown, Clear results, Run > Start. |
| Log panel | `jmeter.log` messages; `View Results Tree` and `Summary Report` are optional listeners you add for debugging (the delivered plan has none). |

Expanding the tree is the fastest way to understand the plan. The delivered tree is exactly:

```text
MSOSE UAT - wtd transaction-data upload (v2)
└── wtd upload                                  Thread Group
    ├── HTTP Request Defaults                   Config Element
    ├── HTTP Cookie Manager                     Config Element
    ├── 00 Pre-flight                           JSR223 Sampler (Groovy)
    ├── 01 Login (config gate; captcha disabled) Transaction Controller
    │   ├── 0101 GET index                      HTTP Request + assert 200 + extract token
    │   ├── 0102 POST checkResult ...           HTTP Request + assert 200 + extract token
    │   ├── 0103 POST index (preAction=login)   HTTP Request + assert 200 + assert config gate cleared + extract
    │   ├── 0104 GET security/login ...         HTTP Request + assert login form + assert captcha disabled
    │   │                                       + stop if captcha is enabled + extract token
    │   └── 0107 POST security/login            HTTP Request + assert dashboard + assert not login page
    ├── 02 Wizard 001s0 Overview                Transaction Controller
    │   ├── 0201 GET 001s0                      HTTP Request + assert step 0 + extract token
    │   └── 0202 POST 001s0 Next                HTTP Request + assert step 1 + extract token
    ├── 03 Wizard 001s1 Terms                   Transaction Controller
    │   ├── 0301 GET 001s1                      HTTP Request + assert step 1 + extract token
    │   └── 0302 POST 001s1 accept terms        HTTP Request + assert step 2 + uploader + assert uploader meta + extract
    ├── 04 Upload transaction data (x N)        Transaction Controller
    │   └── UploadLoop                          Loop Controller (${num_uploads})
    │       └── 0401 POST bUpload_x             HTTP Request
    │           ├── app-uploader header          Header Manager
    │           ├── build upload name            JSR223 PreProcessor
    │           ├── assert 200                   Response Assertion
    │           ├── assert app success           Response Assertion
    │           ├── assert no HTML               Response Assertion
    │           └── capture rotated token ...    JSR223 PostProcessor
    ├── 05 Verify upload list (no persistence)  Transaction Controller
    │   └── 0501 GET 001s2 reload               HTTP Request + assert step 2 + JSR223 assertion + extract page token
    ├── 06 Optional persist + Empty All checks  If Controller (persist_uploads == 'true')
    │   ├── 0600 WARN persist mode              JSR223 Sampler
    │   ├── build persist form body             JSR223 PreProcessor (direct child of the If)
    │   ├── 0601 POST 001s2 Next (persist rows) HTTP Request + form content type + assert step 3 + extract
    │   ├── 0602 POST 001s3 Back                HTTP Request + assert step 2 + extract page token
    │   ├── 0603 POST 001s2 Empty All ...       HTTP Request + assert empty set rejected + assert still step 2
    │   └── 0604 GET 001s3 (verify)             HTTP Request + assert step 3
    └── 99 Run summary                          JSR223 Sampler
```

Note that assertions and processors appear **after** their sampler in this list because they are its
children, not separate top-level steps.

The plan has **six numbered phases** (`01`-`06`) but only **five Transaction Controllers**: phase `06`
is an If Controller, because it is an optional branch rather than a timing group.

### 2.2 Component roles

| Component | Role in this plan | Key GUI fields |
|---|---|---|
| Test Plan | Owns the UDVs and global settings | Name, Comments, **User Defined Variables** |
| Thread Group | One simulated user; outer loop over complete workflows | Number of Threads, Ramp-up, Loop Count, Action after sampler error |
| HTTP Request Defaults | Shared protocol/host/port/encoding/timeouts | Protocol, Server Name or IP, Port, Content encoding, Connect/Response timeout |
| HTTP Cookie Manager | Keeps the JSESSIONID/session between requests; clears it per iteration | Clear cookies each iteration |
| Transaction Controller | Groups requests so the dashboard/log has one timing row per phase | Generate parent sample, Include duration of timers/processors |
| Loop Controller | Repeats the upload block | Loop Count |
| If Controller | Runs the destructive persist branch only when enabled | Condition, Interpret as variable expression, Evaluate for all children |
| HTTP Request | One HTTP call | Method, Path, Parameters, Files Upload, Follow Redirects, Use KeepAlive, multipart |
| Header Manager | Adds `app-uploader: Y` to the upload (or `Content-Type` to the raw-body POST) | Name/Value table |
| Response Assertion | Checks response code or body markers | Field to Test, Pattern Matching Rules, Patterns, Custom failure message, Ignore Status |
| Regex Extractor | Pulls the single-use Struts token out of the page | Field to check, Reference Name, Regular Expression, Template, Match No., Default Value |
| JSR223 Sampler | Runs Groovy as a sample (pre-flight, summary) | Language = groovy, Script |
| JSR223 PreProcessor | Builds a value before the sampler (upload name, persist body) | Language = groovy, Script |
| JSR223 PostProcessor | Captures the rotated token and row metadata after the response | Language = groovy, Script |
| JSR223 Assertion | Free-form assertion (temp names must be absent) | Language = groovy, Script |

### 2.3 Annotated tree with line numbers

Line numbers are for `MSOSE_UAT_wtd_upload_load_test_v2.jmx` as delivered (1,133 lines). JMeter rewrites
the file when it saves, so treat `testname="..."` as the stable identifier; grep for the name if a line
has moved.

| Tree node | Lines | Purpose |
|---|---|---|
| Test Plan | 4-82 | Name/comments; holds the UDV collection |
| User Defined Variables | 8-81 | 14 `-J`-overridable settings |
| `wtd upload` Thread Group | 84-96 | 1 thread, 0 ramp, `${run_iterations}` loops, continue on error |
| HTTP Request Defaults | 98-110 | `https`, host, 7012, UTF-8, 20 s connect / 180 s response |
| HTTP Cookie Manager | 112-116 | Session cookies; clear each iteration |
| `00 Pre-flight` | 118-144 | Password/file checks; abort the test on failure |
| `01 Login` transaction | 146-149 | Groups the 5 login requests |
| `0101 GET index` | 151-163 | New session + token |
| assert 200 | 165-173 | Response code equals 200 |
| extract token | 175-182 | `csrfToken` from the page |
| `0102 POST checkResult` | 185-296 | Browser-config gate: token + 12 `configModel.*` fields |
| assert 200 | 298-306 | Config gate HTTP status |
| extract token | 308-315 | Fresh token from the result page |
| `0103 POST index (preAction=login)` | 318-359 | Completes the config gate and moves to the login menu |
| assert 200 | 361-369 | HTTP status |
| assert config gate cleared | 371-379 | Response must **not** contain `configModel.browser` |
| extract token | 381-388 | Fresh token |
| `0104 GET security/login` | 391-403 | Fetches the real login form |
| assert login form | 405-413 | `name="mso.userId"` present |
| assert captcha disabled | 415-423 | `name="captcha"` **absent** (test type 20) |
| stop if captcha is enabled | 425-436 | Marks the sample failed and stops the engine before the login POST |
| extract token | 438-445 | `csrfToken` for the login POST |
| `0107 POST security/login` | 448-489 | `token`, `mso.userId`, `mso.passwd` |
| assert dashboard | 491-499 | Response contains `/wtd/001s0` |
| assert not login page | 501-509 | Login form must not appear again |
| `02 Wizard 001s0` transaction | 513-516 | Groups step 0 |
| `0201 GET 001s0` | 518-530 | Renders step 0 |
| assert step 0 | 532-540 | `data-current-step="0"` |
| extract token | 542-549 | Token for Next |
| `0202 POST 001s0 Next` | 552-579 | Advances to step 1 |
| assert step 1 | 581-589 | `data-current-step="1"` |
| extract token | 591-598 | Token for the next page |
| `03 Wizard 001s1` transaction | 602-605 | Groups step 1 |
| `0301 GET 001s1` | 607-619 | Renders step 1 |
| assert step 1 | 621-629 | `data-current-step="1"` |
| extract token | 631-638 | Token for accept-terms |
| `0302 POST 001s1 accept terms` | 641-682 | `command=true`, `wtd_checkbox_command=true` |
| assert step 2 + uploader | 684-692 | `data-current-step="2"` |
| assert uploader meta | 694-702 | `id="mime-type"` (uploader present) |
| extract token | 704-711 | Token for the uploads |
| `04 Upload` transaction | 715-718 | Groups the loop |
| `UploadLoop` | 720-723 | Loop `${num_uploads}` times |
| `0401 POST bUpload_x` | 725-754 | Multipart upload with the token in the query string |
| app-uploader header | 756-763 | `app-uploader: Y` |
| build upload name | 765-775 | Unique temp name + size/original name |
| assert 200 | 777-785 | HTTP 200; 463 means the timeslot gate is closed |
| assert app success | 787-795 | Body contains `success:true` |
| assert no HTML | 797-805 | Body must not contain `<html` |
| capture rotated token + row meta | 807-823 | `X-CSRF-TOKEN` -> `csrfToken`; append `uploadedNames`/`uploadedMeta` |
| `05 Verify` transaction | 828-831 | Groups the verification GET |
| `0501 GET 001s2 reload` | 833-845 | Reloads the upload page |
| assert step 2 | 847-855 | Page is still step 2 |
| assert temp files not persisted | 857-877 | None of `uploadedNames` appear in the page |
| extract page token | 879-886 | `pageToken` for the persist branch |
| `06 Optional persist` If | 890-894 | Condition `${__groovy(vars.get('persist_uploads') == 'true')}` |
| `0600 WARN persist mode` | 896-903 | Logs the destructive warning |
| build persist form body | 905-926 | Builds the urlencoded `TR1_*` body from `pageToken` + `uploadedMeta` |
| `0601 POST 001s2 Next (persist rows)` | 928-948 | Raw-body POST that attaches the uploaded rows |
| form content type | 950-957 | `application/x-www-form-urlencoded` |
| assert step 3 | 959-967 | Persist succeeded; page is step 3 |
| extract token | 969-976 | Token for Back |
| `0602 POST 001s3 Back` | 979-1013 | Goes back to step 2 |
| assert step 2 | 1015-1023 | Back worked |
| extract page token | 1025-1032 | Refreshes `pageToken` for 0603 |
| `0603 POST 001s2 Empty All` | 1035-1069 | Submits `TR1_count=0` |
| assert empty set rejected | 1071-1079 | Server message "Transaction Summary must be uploaded" |
| assert still step 2 | 1081-1089 | The empty submit did not advance |
| `0604 GET 001s3 (verify)` | 1092-1104 | Confirms step 3 is reachable |
| assert step 3 | 1106-1114 | `data-current-step="3"` |
| `99 Run summary` | 1118-1128 | Logs `RUN SUMMARY uploads=... expected=...` |

### 2.4 Variables: property -> variable -> request

The plan uses three layers. Understanding this chain is the key to changing settings without touching 15
samplers.

```text
-Jnum_uploads=2                  JVM property supplied by the runner
        |
        |  ${__P(num_uploads,30)}   Test Plan -> User Defined Variables
        v
num_uploads = 2                  JMeter variable, per thread
        |
        |  ${num_uploads}            consumed by a component
        v
LoopController.loops = 2         the upload loop
```

Rules:

1. `${__P(name,default)}` is the **property function**. It returns `-Jname=...` when supplied, otherwise
   the literal default after the comma. Every UDV is written this way, so the plan is configurable
   without editing.
2. `${name}` is a **variable reference**, resolved when the element runs. It is not a property lookup.
3. Property and variable names are **case-sensitive**: `-JBase=` does not override `base`.
4. UDVs are copied into each thread's variable map at thread start. The pre-flight can therefore fill
   `user_pwd` and `upload_file` after the variables exist.
5. Runtime variables (`csrfToken`, `uploadName`, ...) are written by extractors/processors with
   `vars.put(...)`; they are **per thread**.

The full UDV table is in [Appendix A](#appendix-a-variables-reference). The most important defaults:

```text
scheme=https                 host=10.12.128.248                 port=7012
base=/MSOSE                  user_id=JL0003                    user_pwd=(empty)
user_count=1                 ramp_time=0                       run_iterations=1
num_uploads=30               upload_file=(empty)               upload_ext=zip
upload_file_mime=application/zip
persist_uploads=false
```

The three `scheme`/`host`/`port` values are applied once, by **HTTP Request Defaults**. That is why the
15 samplers only contain `${base}/...` paths.

### 2.5 Scope rules that prevent most mistakes

JMeter does not have "global" components in the programming sense; placement defines scope.

| Element | Placed as | Applies to |
|---|---|---|
| HTTP Request Defaults | child of Thread Group | every HTTP sampler in that thread group, unless the sampler overrides a field |
| HTTP Cookie Manager | child of Thread Group | every request in the thread; one cookie store per thread |
| Header Manager | child of a sampler | that sampler only |
| Header Manager | child of a controller/thread | every sampler in that scope |
| Response Assertion | child of a sampler | that sampler |
| Response Assertion | child of a controller | every sampler in the controller |
| Regex Extractor | child of a sampler | that sampler's response |
| PreProcessor | child of a sampler | runs before that sampler |
| PreProcessor | child of a controller | runs before **every** sampler in the controller |
| PostProcessor | child of a sampler | runs after that sampler, before its assertions |
| JSR223 Assertion | child of a sampler | that sampler, after the response and post-processors |

Two consequences used by this plan:

- **The upload Header Manager is a child of `0401`**, so `app-uploader: Y` is sent only on the upload,
  not on login or wizard requests.
- **The persist body builder is a direct child of the If Controller**, so it is in scope for every
  sampler in the branch. Only `0601` consumes `${persistBody}`; if you move the pre-processor under
  `0602`, `0601` would send an undefined body. Moving it under `0601` would still work for `0601`.

Execution order inside one sampler is:

```text
pre-processors -> sampler -> post-processors -> assertions
```

That order explains why `uploadedNames` includes failed uploads: the post-processor appends the name
before the assertions run. `RUN SUMMARY` therefore counts **attempts**, not successes (see Part 8).

### 2.6 Worked example: where `${base}` comes from

1. Definition: UDV `base` at lines 25-29, value `${__P(base,/MSOSE)}`.
2. Uses: `${base}` appears in every sampler path (15 uses; the first is `${base}/index`, the upload is
   `${base}/common/bUpload_x.action?...`).
3. Effective URL for the upload:

   | Piece | Element | Value |
   |---|---|---|
   | `${scheme}` | HTTP Request Defaults line 104 | `https` |
   | `${host}` | HTTP Request Defaults line 102 | `10.12.128.248` |
   | `${port}` | HTTP Request Defaults line 103 | `7012` |
   | `${base}` | UDV line 27 | `/MSOSE` |

   ```text
   https://10.12.128.248:7012/MSOSE/common/bUpload_x.action?struts.token.name=token&token=...&requestCSRFHeader=renew
   ```

4. Override from the command line: `-Jbase=/MSOSE`. From Git Bash, **do not do this**: MSYS rewrites
   `/MSOSE` into `C:/Program Files/Git/MSOSE`. The `.sh` runner omits it deliberately; the `.cmd`
   runner can pass it safely.

The full property/requirement matrix is in `README.md` §10.

---

## Part 3. Lab 1: build a minimal working plan

This lab builds the first half of the plan: pre-flight, the browser-config gate, and login. Part 4 adds
the two wizard steps, the upload loop, the verify step, and the summary. The menu paths below are JMeter
5.5.

### 3.0 Create the working plan

1. **File -> New** (this creates an empty Test Plan).
2. **File -> Save As** `MSOSE_UAT_wtd_upload_load_test_study.jmx`.
3. If you later edit the XML on disk, close this GUI first.

This lab builds the `check` path from empty. If you would rather modify the delivered plan, open
`MSOSE_UAT_wtd_upload_load_test_v2.jmx`, use **Save As**, and go to Part 5. Component names do not affect
the HTTP flow, with one exception: the Loop Controller must be named `UploadLoop` because the pre-processor
reads the automatic variable `__jm__UploadLoop__idx` (see 4.2).

### 3.1 Test Plan and User Defined Variables

1. Select **Test Plan**.
2. Set **Name** to `MSOSE UAT - wtd transaction-data upload (study)`.
3. In **Comments**, write the safety line: default 1 user, 30 uploads, no persistence; persist mode is
   destructive.
4. In the **User Defined Variables** table at the bottom of the Test Plan panel, click **Add** for each
   row below (or **Add from Clipboard**).
5. Fill Name and Value. Keep the `${__P(...)}` form exactly; the comma separates property name and
   default.

| Name | Value | Notes |
|---|---|---|
| `scheme` | `${__P(scheme,https)}` | |
| `host` | `${__P(host,10.12.128.248)}` | UAT address; no DNS lookup needed |
| `port` | `${__P(port,7012)}` | |
| `base` | `${__P(base,/MSOSE)}` | Context path |
| `user_id` | `${__P(user_id,JL0003)}` | |
| `user_pwd` | `${__P(user_pwd,)}` | **Leave the default empty**; pre-flight reads `MSOSE_PWD` |
| `user_count` | `${__P(user_count,1)}` | Single-session account |
| `ramp_time` | `${__P(ramp_time,0)}` | seconds |
| `run_iterations` | `${__P(run_iterations,1)}` | outer loop over the whole workflow |
| `num_uploads` | `${__P(num_uploads,30)}` | inner loop |
| `upload_file` | `${__P(upload_file,)}` | empty -> pre-flight resolves `wtd_payload_30mb.zip` |
| `upload_file_mime` | `${__P(upload_file_mime,application/zip)}` | ZIP-only server rule (2026-10-30) |
| `upload_ext` | `${__P(upload_ext,zip)}` | Used in the generated name |
| `persist_uploads` | `${__P(persist_uploads,false)}` | Destructive when `true` |

Why the empty defaults matter: `user_pwd` must never be stored in the file. The pre-flight fills it from
the environment; if neither is present, the run fails before any network request.

### 3.2 Thread Group

Right-click **Test Plan -> Add -> Threads (Users) -> Thread Group**. Set:

| Field | Value | Why |
|---|---|---|
| Name | `wtd upload` | Tree label |
| Number of Threads (users) | `${user_count}` | One user by default |
| Ramp-up period (seconds) | `${ramp_time}` | No ramp for a single user |
| Loop Count | `${run_iterations}` | Outer loop; 1 means one complete workflow |
| Same user on each iteration | checked | Consistent with the cookie policy |
| Action after a Sampler error | **Continue** | One failed upload must not hide the rest; the transaction/Err count reports failures |
| Specify Thread lifetime | unchecked | No scheduler |

JMeter's Thread Group has its own internal Loop Controller; that is the **outer** loop. The
`UploadLoop` added later is a **separate inner** loop.

### 3.3 HTTP Request Defaults

Right-click `wtd upload -> Add -> Config Element -> HTTP Request Defaults`.

| Field | Value |
|---|---|
| Name | `HTTP Request Defaults` |
| Protocol | `${scheme}` |
| Server Name or IP | `${host}` |
| Port Number | `${port}` |
| Path | *(empty)* |
| Content encoding | `UTF-8` |
| Connect Timeout | `20000` (ms) |
| Response Timeout | `180000` (ms) |

The long response timeout is for the 30 MB upload (`full`). `concurrentPool=6` in the XML is the
HTTP-client connection-pool hint; it is not a concurrency setting.

Do **not** put a path in the defaults: each sampler supplies its own `${base}/...` path.

### 3.4 HTTP Cookie Manager

Right-click `wtd upload -> Add -> Config Element -> HTTP Cookie Manager`.

- **Clear cookies each iteration?** checked.
- Leave the cookie policy at the default.

The Cookie Manager keeps the JSESSIONID between the login POST and the wizard/upload requests. Clearing
per iteration means each outer iteration is a fresh session; with `run_iterations=1` this changes
nothing, but it prevents cross-iteration session leakage if you raise the loop count.

### 3.5 Pre-flight JSR223 sampler

Right-click `wtd upload -> Add -> Sampler -> JSR223 Sampler`.

- Name: `00 Pre-flight`
- Language: **groovy** (JMeter 5.5 bundles Groovy; do not choose `java`)
- Leave **Cache compiled script if available** unchecked (the plan's `cacheKey` is empty)
- Script: paste the following exactly.

```groovy
def fail = { String msg ->
    log.error('PRE-FLIGHT FAILED: ' + msg)
    SampleResult.setSuccessful(false)
    SampleResult.setResponseCode('500')
    SampleResult.setResponseMessage(msg)
    ctx.getEngine().stopTest()
}
def baseDir = new File(org.apache.jmeter.services.FileServer.getFileServer().getBaseDir())
def pwd = vars.get('user_pwd')
if (pwd == null || pwd.trim().length() == 0) { pwd = System.getenv('MSOSE_PWD') }
if (pwd == null || pwd.trim().length() == 0) { fail('user_pwd is not set; export MSOSE_PWD=... (never stored in results)') }
vars.put('user_pwd', pwd)
if (!vars.get('upload_file')) {
    vars.put('upload_file', new File(baseDir, 'wtd_payload_30mb.zip').getAbsolutePath())
}
def uf = new File(vars.get('upload_file'))
if (!uf.isFile()) { fail('upload_file not found: ' + uf.getAbsolutePath()) }
if (uf.length() == 0) { fail('upload_file is empty: ' + uf.getAbsolutePath()) }
if (uf.length() > 31457280) { fail('upload_file exceeds the 30 MiB client cap: ' + uf.length() + ' bytes') }
log.info('PRE-FLIGHT OK file=' + uf.getAbsolutePath() + ' bytes=' + uf.length() + ' mime=' + vars.get('upload_file_mime') + ' uploads=' + vars.get('num_uploads') + ' persist=' + vars.get('persist_uploads'))
SampleResult.setResponseData('PRE-FLIGHT OK', 'UTF-8')
```

Line by line:

| Lines | What it does |
|---|---|
| `def fail = { ... }` | A closure that marks the sample failed, sets code 500/message, and calls `ctx.getEngine().stopTest()` to stop the **whole test engine** (not just this thread). |
| `baseDir = FileServer...getBaseDir()` | The directory of the JMX. Relative payload paths resolve there, not in the JMeter `bin` directory. |
| `pwd = vars.get('user_pwd')` | UDV value. If blank, read `MSOSE_PWD` from the process environment. |
| `vars.put('user_pwd', pwd)` | Makes the password available to `0107` as `${user_pwd}` without putting it in the `.jmx`. |
| `if (!vars.get('upload_file')) ...` | Blank UDV -> `<JMX dir>/wtd_payload_30mb.zip`. |
| `isFile()`, `length()==0`, `>31457280` | Fail fast on a missing/empty/oversized payload. 31,457,280 = 30 MiB. |
| `log.info('PRE-FLIGHT OK ...')` | The supported runtime report. Read this line first when diagnosing a run. |
| `SampleResult.setResponseData(...)` | Gives the sampler a readable response in the GUI/log instead of blank. |

Because it is a normal sampler (not a Setup Thread Group), it runs once per thread per **outer**
iteration. With `run_iterations=1` that is once for the whole run; if you raise the outer loop, the
password/file checks run again each time.

**Sharp edge for your own edits:** `fail(...)` runs the closure and returns to the next statement;
Groovy does not return from the enclosing script. `stopTest()` stops the engine between samples, so the
run still stops, but the remaining script lines execute once. If you extend this script, add `return`
after each `fail(...)` (or throw an exception) so a failure does not continue into later checks or the
`PRE-FLIGHT OK` log line.

### 3.6 Login transaction

Right-click `wtd upload -> Add -> Logic Controller -> Transaction Controller`.
Name it `01 Login (config gate; captcha disabled)`.

- **Generate parent sample**: unchecked (`parent=false`).
- **Include duration of timer and pre-post processors...**: unchecked (`includeTimers=false`).

Why a transaction: the dashboard/log gets one `01 Login` timing row that aggregates the five requests,
while each request remains visible for diagnosis. `includeTimers=false` keeps the transaction time to
the sampler time (there are no timers anyway).

Add the five HTTP requests as children of the transaction. For every request: **Method** and **Path** as
below, **Follow Redirects** checked, **Use KeepAlive** checked, **Use multipart/form-data for POST**
unchecked.

#### 0101 GET index

| Field | Value |
|---|---|
| Name | `0101 GET index` |
| Method | `GET` |
| Path | `${base}/index` |
| Parameters | none |

Children:

1. **Add -> Assertions -> Response Assertion**, name `assert 200`:
   - Field to Test: **Response Code**
   - Pattern Matching Rules: **Equals**
   - Patterns to Test: `200`
   - Ignore Status: unchecked
2. **Add -> Post Processors -> Regular Expression Extractor**, name `extract token`:
   - Field to check: **Body**
   - Reference Name: `csrfToken`
   - Regular Expression: `name="token" value="([^"]+)"`
   - Template: `$1$`
   - Match No.: `1`
   - Default Value: `TOKEN_NOT_FOUND`

The extractor is the most important pattern in the plan. Every page renders the current Struts token in
a hidden input; the regex captures the value inside the quotes. `TOKEN_NOT_FOUND` is a sentinel: if the
page shape changes, the next POST sends that literal string and the run fails visibly instead of
silently reusing an old token.

#### 0102 POST checkResult (browser config gate)

| Field | Value |
|---|---|
| Name | `0102 POST checkResult (browser config gate)` |
| Method | `POST` |
| Path | `${base}/checkResult` |
| Follow Redirects | checked |

Parameters (Name / Value), all URL-encoded:

| Name | Value |
|---|---|
| `struts.token.name` | `token` |
| `token` | `${csrfToken}` |
| `configModel.operationSystem` | `Windows` |
| `configModel.operationSystemVer` | `10` |
| `configModel.enableJS` | `Enabled` |
| `configModel.enableCookies` | `Enabled` |
| `configModel.enableFlash` | `Disabled` |
| `configModel.flashVer` | *(empty)* |
| `configModel.browser` | `Chrome` |
| `configModel.browserVer` | `120` |
| `configModel.enableJava` | `Disabled` |
| `configModel.javaVer` | *(empty)* |
| `configModel.pdfViewer` | `Disabled` |
| `configModel.pdfViewerVer` | *(empty)* |

This is the "Client System Configuration Check" gate. It sets a session flag; without it the login path
redirects back to the config page. The values model a Windows/Chrome browser with JS and cookies
enabled. If MSOS starts requiring a new field, add it here (and update the assertion/README).

Children: `assert 200` (Response Code, Equals, `200`) and `extract token` (same extractor as 0101).

#### 0103 POST index (preAction=login)

| Field | Value |
|---|---|
| Name | `0103 POST index (preAction=login)` |
| Method | `POST` |
| Path | `${base}/index` |

Parameters:

| Name | Value |
|---|---|
| `struts.token.name` | `token` |
| `token` | `${csrfToken}` |
| `preAction` | `/security/login` |
| `nextBtn_` | `Home` |

Children:

1. `assert 200` (Response Code, Equals, `200`).
2. `assert config gate cleared`:
   - Field to Test: **Response Data**
   - Pattern Matching Rules: **Contains** + **Not** (test type 6, i.e. "does not contain")
   - Pattern: `configModel.browser`
   - Custom message: `still on the browser-config page after the gate POST`
3. `extract token` (same extractor).

The "Not" assertion is how the plan proves it left the config page rather than merely got a 200. The
dot in `configModel.browser` is a regex wildcard in Contains mode, but the marker is distinctive; for
literal text prefer **Substring + Not** (test type 20), which is used elsewhere.

#### 0104 GET security/login (load login form)

| Field | Value |
|---|---|
| Name | `0104 GET security/login (load login form)` |
| Method | `GET` |
| Path | `${base}/security/login` |

Children, in order:

1. `assert login form`:
   - Field: **Response Data**
   - Rule: **Substring**
   - Pattern: `name="mso.userId"`
   - Message: `login form not returned by GET /security/login`
2. `assert captcha disabled`:
   - Field: **Response Data**
   - Rule: **Substring** + **Not** (test type 20)
   - Pattern: `name="captcha"`
   - Message: `login form contains a captcha field: check CTRL_PARM_TBL LOGIN_CHECK_CAPCHA = 'N' ... Do not rerun: 5 failed logins lock the account.`
3. **Add -> Post Processors -> JSR223 PostProcessor**, name `stop if captcha is enabled`, Language `groovy`:

   ```groovy
   if (prev.getResponseDataAsString().contains('name="captcha"')) {
       prev.setSuccessful(false)
       prev.setResponseMessage('login captcha is enabled; check CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA and the codeTable cache')
       log.error('CAPTCHA re-enabled on the login page; stopping before the login POST to protect the account')
       ctx.getEngine().stopTest()
   }
   ```

   This is deliberately redundant with the assertion: the assertion reports the failure, and the guard
   stops the engine before the credential POST. The order matters - post-processors run before
   assertions, so the stop happens as early as possible.

4. `extract token` (same extractor; reference `csrfToken`).

#### 0107 POST security/login

| Field | Value |
|---|---|
| Name | `0107 POST security/login` |
| Method | `POST` |
| Path | `${base}/security/login` |
| Follow Redirects | checked |

Parameters:

| Name | Value |
|---|---|
| `struts.token.name` | `token` |
| `token` | `${csrfToken}` |
| `mso.userId` | `${user_id}` |
| `mso.passwd` | `${user_pwd}` |

Children:

1. `assert dashboard`:
   - Field: **Response Data**
   - Rule: **Substring**
   - Pattern: `/wtd/001s0`
   - Message: `login did not reach the dashboard (wrong password, or the login captcha has been re-enabled)`
2. `assert not login page`:
   - Field: **Response Data**
   - Rule: **Substring** + **Not**
   - Pattern: `name="mso.userId"`
   - Message: `still on the login form after POST`

Why Follow Redirects is checked: the successful login is a 302 to the dashboard. With redirects enabled,
JMeter follows it and the assertion can see the dashboard HTML. With redirects disabled you would only
see the 302 and the `Location` header.

The numbering skips `0105`/`0106` because those were the captcha requests, removed on 2026-10-28. Keeping
the old numbers makes historical logs easy to compare; it has no functional meaning.

#### The token chain

```text
GET  /index              -> hidden input token T1 -> csrfToken = T1
POST /checkResult        -> consumes T1; result page carries T2 -> csrfToken = T2
POST /index (preAction)  -> consumes T2; menu carries T3 -> csrfToken = T3
GET  /security/login     -> carries T4 -> csrfToken = T4
POST /security/login     -> consumes T4; 302 dashboard (new page token not needed here)
```

Every POST consumes its token. That is why there is an extractor after **every** page that precedes a
POST. If you add a request, add an extractor for the next page, or the following POST will fail with a
302 to `/MSOSE/sysMsg`.

### 3.7 First validation: pre-flight + login

At this point the study plan has **six samplers**: 1 pre-flight + 5 login requests. Save it.

The delivered runner always points `-t` at the v2 file. To run the study plan from the CLI, make a copy of
`run_wtd_load_test.cmd`, replace the three `set "JMX=..._v2.jmx"` lines with the study file name, and keep
everything else (especially the proxy guard; the `JVM_ARGS` truststore line is optional and disabled in
this copy). Do not edit the delivered runner.

Expected in the console:

```text
summary =      6 in 00:00:0x = ... Err: 0 (0.00%)
```

and in the study plan's log:

```text
PRE-FLIGHT OK file=...\wtd_payload_30mb.zip bytes=30009291 mime=application/zip uploads=0 persist=false
```

There is no `VERIFY pages` or `RUN SUMMARY` line yet: those samplers are added in Part 4. If you see 6/0,
the pre-flight and login half is correct. For comparison, the delivered v2 plan is still 12/0 because it
already contains the wizard, verify, and summary samples.

If the run fails, use Part 6.5 before changing anything.

---

## Part 4. Labs 2-4: complete the workflow

### 4.1 Wizard steps 02 and 03

Add two Transaction Controllers after the login transaction, with the same `parent=false` and
`includeTimers=false` settings.

#### 02 Wizard 001s0 Overview

`0201 GET 001s0`:

- Method `GET`, path `${base}/wtd/001s0-2`, no parameters.
- Child `assert step 0`: Response Data, Substring, `data-current-step="0"`.
- Child `extract token`: the same `csrfToken` extractor.

`0202 POST 001s0 Next`:

- Method `POST`, path `${base}/wtd/001s0-2`, Follow Redirects checked.
- Parameters: `struts.token.name=token`, `token=${csrfToken}`.
- Child `assert step 1`: Response Data, Substring, `data-current-step="1"`.
- Child `extract token`: same extractor.

#### 03 Wizard 001s1 Terms

`0301 GET 001s1`:

- Method `GET`, path `${base}/wtd/001s1-2`.
- Child `assert step 1`: `data-current-step="1"`.
- Child `extract token`.

`0302 POST 001s1 accept terms`:

- Method `POST`, path `${base}/wtd/001s1-2`, Follow Redirects checked.
- Parameters:

  | Name | Value |
  |---|---|
  | `struts.token.name` | `token` |
  | `token` | `${csrfToken}` |
  | `command` | `true` |
  | `wtd_checkbox_command` | `true` |

- Child `assert step 2 + uploader`: `data-current-step="2"`.
- Child `assert uploader meta`: Response Data, Substring, `id="mime-type"`.
- Child `extract token`.

The `-2` suffix is part of the deployed wizard URL (upload mode). Do not derive it from the step number;
copy the live path. `id="mime-type"` is the uploader widget's marker, so the plan knows the upload page
really rendered rather than a generic step-2 page.

### 4.2 Upload transaction 04

Add a Transaction Controller `04 Upload transaction data (x N)`, then inside it a
**Loop Controller** named `UploadLoop`:

- Loop Count: `${num_uploads}`
- **Forever** unchecked.

Verified behavior: `num_uploads=0` skips the loop entirely (that is why `check` has 12 samples, not 13).

Inside the loop, add the HTTP Request `0401 POST bUpload_x`:

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `${base}/common/bUpload_x.action?struts.token.name=token&token=${csrfToken}&requestCSRFHeader=renew` |
| Follow Redirects | **unchecked** |
| Use KeepAlive | checked |
| Use multipart/form-data for POST | checked |

Parameters tab:

| Name | Value |
|---|---|
| `name` | `${uploadName}` |

Files Upload tab:

| File Path | Parameter Name | MIME Type |
|---|---|---|
| `${upload_file}` | `file` | `${upload_file_mime}` |

Child config element: **HTTP Header Manager**, name `app-uploader header`, one row
`app-uploader` = `Y`.

Child pre-processor: **JSR223 PreProcessor**, name `build upload name`, Language `groovy`:

```groovy
def idx = vars.get('__jm__UploadLoop__idx')
def name = 'o_lt' + ctx.getThreadNum() + '_' + System.currentTimeMillis() + '_' + idx + '.' + vars.get('upload_ext')
vars.put('uploadName', name)
vars.put('uploadSize', String.valueOf(new File(vars.get('upload_file')).length()))
vars.put('uploadOrigName', new File(vars.get('upload_file')).getName())
```

- `__jm__UploadLoop__idx` is JMeter's automatic loop index variable, named after the Loop Controller
  (`UploadLoop`) and **0-based**. It makes each name unique within the loop.
- `ctx.getThreadNum()` is the 0-based thread number, so concurrent threads also cannot collide.
- `System.currentTimeMillis()` separates runs.
- `uploadSize` and `uploadOrigName` are metadata for the optional persist body; the server displays the
  original name, not the temp name.

Child assertions:

1. `assert 200`: Field **Response Code**, Rule **Equals**, Pattern `200`, message
   `upload must return HTTP 200 (460 = unauthenticated, 463 = outside the upload timeslot)`.
   The `460` in that message is the plan author's reminder text; the failure actually observed in the
   current runs is `463`.
2. `assert app success`: Field **Response Data**, Rule **Substring**, Pattern `success:true`, message
   `server did not return success:true (MIME rejected, size rejected, or magic-byte check failed)`.
3. `assert no HTML`: Field **Response Data**, Rule **Substring + Not** (20), Pattern `<html`, message
   `upload returned an HTML page (login/session redirect)`.

The three assertions separate failure causes: transport/auth (code), application refusal (body), and a
silently followed login/error page (HTML). `success:true` is the server's actual upload-success marker.

Child post-processor: **JSR223 PostProcessor**, name `capture rotated token + row meta`, Language `groovy`:

```groovy
def h = prev.getResponseHeaders()
if (h != null) {
    def m = (h =~ /(?im)^X-CSRF-TOKEN:\s*(\S+)/)
    if (m.find()) { vars.put('csrfToken', m.group(1).trim()) }
}
def n = vars.get('uploadedNames')
def name = vars.get('uploadName')
if (name != null) { vars.put('uploadedNames', (n == null || n.length() == 0) ? name : n + ',' + name) }
def meta = vars.get('uploadedMeta')
def row = name + '|' + vars.get('uploadSize') + '|' + vars.get('uploadOrigName')
vars.put('uploadedMeta', (meta == null || meta.length() == 0) ? row : meta + ';' + row)
```

What it does:

- Reads the response headers; the regex `(?im)` means case-insensitive + multiline. `X-CSRF-TOKEN` is the
  **next** single-use token, returned because the request asked for `requestCSRFHeader=renew`.
- Writes it back to `csrfToken`, so the next loop iteration uses a fresh token.
- Appends the generated name to `uploadedNames` (comma-separated) and `name|size|originalName` to
  `uploadedMeta` (semicolon-separated). The verify step and the optional persist body consume these.
- If the header is absent (for example on a 463), the old `csrfToken` remains; the next iteration will
  fail visibly. That is preferable to silently reusing a consumed token.

Why the token is in the **query string**, not the multipart body: that is where the deployed uploader
sends it and where the server validates it. This is part of the captured contract (`README.md` §9.3),
not a stylistic choice; do not "tidy" it into the form fields.

### 4.3 Verify transaction 05

Add a Transaction Controller `05 Verify upload list (no persistence)` and inside it
`0501 GET 001s2 reload`:

- Method `GET`, path `${base}/wtd/001s2-2`, Follow Redirects checked.
- Child `assert step 2`: Response Data, Substring, `data-current-step="2"`, message
  `upload page did not reload (session lost?)`.
- Child **JSR223 Assertion**, name `assert temp files not persisted`, Language `groovy`:

  ```groovy
  def names = vars.get('uploadedNames')
  def body = prev.getResponseDataAsString()
  if (names != null) {
      if (names.length() != 0) {
          def bad = []
          names.split(',').each { n -> if (n.length() != 0) { if (body.contains(n)) { bad.add(n) } } }
          if (bad.size() != 0) {
              AssertionResult.setFailure(true)
              AssertionResult.setFailureMessage('Uploaded temp names are present in the reloaded page: ' + bad.join(','))
          }
      }
  }
  def cnt = 0
  if (names != null) { if (names.length() != 0) { cnt = names.split(',').length } }
  log.info('VERIFY pages: uploads=' + cnt + ' persistedInPageList=' + (names != null ? (names.length() != 0 ? 'checked' : 'n/a') : 'n/a'))
  ```

  In a JSR223 **Assertion**, use `AssertionResult.setFailure(true)` / `setFailureMessage(...)`; `prev` is
  the sampler result. Do not call `SampleResult.setSuccessful(false)` here (that is for samplers).
- Child `extract page token`: Regex Extractor with Reference Name `pageToken`, same regex/template/
  default. This token is for the optional persist branch.

What the assertion proves, and what it does not: uploads are **temp-only** until the step's Next. The
reloaded page should not list the temp names. The files may still exist in the server's per-session temp
folder; they are discarded when the session ends. The assertion proves the UI/draft did not persist
them, not that the disk file was deleted at upload time.

### 4.4 Optional persist branch 06 (destructive)

Add an **If Controller** `06 Optional persist + Empty All checks` after the verify transaction:

- Condition: `${__groovy(vars.get('persist_uploads') == 'true')}`
- **Interpret Condition as Variable Expression?** checked.
- **Evaluate for all children?** unchecked (evaluate once when entering).

Using `__groovy` avoids the removed JavaScript engine and makes the condition explicit. With
`persist_uploads=false` (the default) the branch is skipped entirely.

Inside the If, in this order:

1. `0600 WARN persist mode` (JSR223 Sampler, Groovy):

   ```groovy
   log.warn('persist_uploads=true: the next request writes ' + vars.get('num_uploads') + ' files to the UAT draft and replaces the current document set of this wizard step')
   SampleResult.setResponseData('persist mode enabled', 'UTF-8')
   ```

2. `build persist form body` (JSR223 **PreProcessor**, direct child of the If, Groovy):

   ```groovy
   def tok = vars.get('pageToken')
   def meta = vars.get('uploadedMeta')
   def sb = new StringBuilder()
   sb.append('struts.token.name=token&token=').append(java.net.URLEncoder.encode(tok, 'UTF-8'))
   def rows = meta.split(';')
   sb.append('&TR1_count=').append(rows.length)
   int i = 0
   rows.each { r ->
       def p = r.split('\\|')
       sb.append('&TR1_').append(i).append('_tmpname=').append(java.net.URLEncoder.encode(p[0], 'UTF-8'))
       sb.append('&TR1_').append(i).append('_size=').append(p[1])
       sb.append('&TR1_').append(i).append('_name=').append(java.net.URLEncoder.encode(p[2], 'UTF-8'))
       sb.append('&TR1_').append(i).append('_status=done')
       i++
   }
   vars.put('persistBody', sb.toString())
   ```

   It builds the exact urlencoded body: token, row count, and one `TR1_<i>_{tmpname,size,name,status}`
   set per uploaded row. `uploadedMeta` is `name|size|originalName` entries separated by `;`.

   Scope: as a direct child of the If, it runs before every sampler in the branch. Only `0601` uses
   `${persistBody}`, so moving it under `0601` is functionally equivalent; moving it under `0602` would
   leave `0601` without a body.

   Persist mode assumes at least one upload: if `num_uploads=0`, `uploadedMeta` is null and
   `meta.split(';')` throws before `0601`. Use persist mode only with a non-zero upload count.

3. `0601 POST 001s2 Next (persist rows)`:

   - Method `POST`, path `${base}/wtd/001s2-2`, Follow Redirects checked.
   - **Body Data** tab (not the Parameters tab): paste `${persistBody}` as the only line. Do not add a
     parameter name; a raw body has none.
   - Child **HTTP Header Manager** `form content type`:
     `Content-Type: application/x-www-form-urlencoded`.
   - Child `assert step 3`: `data-current-step="3"`.
   - Child `extract token` into `csrfToken`.

   Why raw body: the `TR1_*` structure is dynamic (one block per row). Building the exact string is
   simpler and more honest than fighting the Parameters table's encoding. The explicit Content-Type is
   required because JMeter does not infer it for a raw body.

4. `0602 POST 001s3 Back`:

   - Method `POST`, path `${base}/wtd/001s3-2`, Follow Redirects checked.
   - Parameters: `struts.token.name=token`, `token=${csrfToken}`, `back=Back`.
   - Child `assert step 2`: `data-current-step="2"`.
   - Child `extract page token` into `pageToken`.

   The refresh matters: `0601` consumed the old `pageToken`; the Back response carries a new one, which
   `0603` will use.

5. `0603 POST 001s2 Empty All (TR1_count=0)`:

   - Method `POST`, path `${base}/wtd/001s2-2`, Follow Redirects checked.
   - Parameters: `struts.token.name=token`, `token=${pageToken}`, `TR1_count=0`.
   - Child `assert empty set rejected`: Response Data, Substring,
     `Transaction Summary must be uploaded`.
   - Child `assert still step 2`: `data-current-step="2"`.

   "Empty All" is a client-side DOM clear in the real application; there is no server action that clears
   a submitted set. Submitting `TR1_count=0` is how the plan captures the server's negative response.

6. `0604 GET 001s3 (verify)`: Method `GET`, path `${base}/wtd/001s3-2`; child `assert step 3`.

**Do not enable this branch casually.** It writes `num_uploads` files into the UAT draft and there is no
HTTP cleanup; clearing is a UI operation. The branch has not been verified end-to-end against UAT
(README §5.4). Use it only on a disposable account.

### 4.5 Run summary 99

Add a **JSR223 Sampler** `99 Run summary` after the If Controller (outside it), Language `groovy`:

```groovy
def names = vars.get('uploadedNames')
def n = 0
if (names != null) { if (names.length() != 0) { n = names.split(',').length } }
log.info('RUN SUMMARY uploads=' + n + ' expected=' + vars.get('num_uploads') + ' persist=' + vars.get('persist_uploads') + ' user=' + vars.get('user_id'))
SampleResult.setResponseData('uploads=' + n + ' expected=' + vars.get('num_uploads'), 'UTF-8')
```

It runs even if uploads failed, because `uploadedNames` is appended in the post-processor before the
assertions. Read it together with `Err:`: `uploads=2 expected=2` with `Err: 2` means two attempts, zero
successes.

### 4.6 Save and validate

1. **File -> Save** (or Save As the study copy).
2. Pure XML check:

   ```powershell
   powershell -NoProfile -Command "[xml](Get-Content -Raw 'MSOSE_UAT_wtd_upload_load_test_study.jmx') | Out-Null; 'XML OK'"
   ```

   This proves well-formedness only. JMeter semantics (for example a missing `<hashTree>`) can still be
   wrong; open the plan in the GUI and run `check`. (Use the v2 file name if you are validating the
   delivered plan instead.)
3. Run the study plan's `check` with the copied runner. Expected: **12 samples, `Err: 0`**, plus these log
   lines:

   ```text
   PRE-FLIGHT OK file=... bytes=30009291 mime=application/zip uploads=0 persist=false
   VERIFY pages: uploads=0 persistedInPageList=n/a
   RUN SUMMARY uploads=0 expected=0 persist=false user=JL0003
   ```

   The study plan now matches the delivered plan's `check` result. Continue to Part 5 for modifications.

---

## Part 5. Modification recipes

### 5.1 Change a setting: which layer?

| Where | Effect | Use when |
|---|---|---|
| GUI -> Test Plan -> User Defined Variables | Changes the **default** stored in the `.jmx` | You are changing the plan for everyone |
| Runner `-Jname=value` | Overrides at run time, no file change | One-off runs, CI, experiments |
| Runner environment (`MSOSE_PWD`, `MSOSE_USER`) | Password/user only | Credentials |

Precedence: `-J` property -> UDV default. There is no other layer. Property names are case-sensitive.
Never put `user_pwd` in the UDV: JMeter logs `-J` properties, and a GUI-stored value is plain text in the
file. Use `MSOSE_PWD`.

### 5.2 Change the upload count, file, MIME, or extension

```cmd
-Jnum_uploads=5
-Jupload_file=D:\data\my_payload.zip
-Jupload_file_mime=application/zip
-Jupload_ext=zip
```

Rules:

- `num_uploads=0` skips the loop (verified by `check`).
- The pre-flight rejects a missing/empty file and anything over **31,457,280 bytes** (30 MiB).
- The server page limit is **52,428,800 bytes** (50 MiB); the kit cap is a deliberate safety margin.
- UAT accepts **ZIP only** (rule in force since 2026-10-30):
  - extension: `zip`
  - MIME: `application/zip`
- `application/x-zip-compressed` (what some browsers send) is **not** accepted. The file must also be a
  genuine ZIP: the server checks the magic bytes (`PK\x03\x04`), so a renamed or zero-filled archive fails
  with *"File type mismatch"*. `wtd_payload_30mb.zip` is the safe default.
- The earlier allowlist (`zip`, `xls`, `xlsx`, `xml` with the OOXML MIME) is kept in
  `VERIFICATION_REPORT.md` §4 for history only; do not target it.

If you change `upload_ext`, change `upload_file_mime` too; the name builder uses the extension and the
multipart part uses the MIME.

### 5.3 Change the host, port, or context path

- Keep `host=10.12.128.248`. The certificate has no IP SAN, so browsers warn on the IP; JMeter 5.5 is
  trust-all and checks neither the name nor the chain, so the plan runs normally. Switching to the
  hostname works only on a machine where that name resolves to 10.12.128.248.
- `-Jport=7012` is safe.
- `-Jbase=/MSOSE` works from `cmd.exe`; from Git Bash, MSYS rewrites the leading slash. Use the `.sh`
  runner without `-Jbase`, or prefix the command with `MSYS_NO_PATHCONV=1`.
- A different UAT host needs **no truststore change** for JMeter runs; just change `-Jhost`. Only a
  browser or another strict client would need that host's chain added.

### 5.4 Change the user or password

- `-Juser_id=...` overrides the login id.
- `MSOSE_PWD=...` (environment) overrides the password; the `.sh` requires it, the `.cmd` defaults to the
  agreed test password.
- `user_count>1` requires **distinct accounts**. The single-session rule means two threads on `JL0003`
  will invalidate each other's sessions. The plan is designed for one thread.

### 5.5 Add a wizard step

Use this checklist; skipping one item is the usual cause of a 302 or a token failure.

1. Add a Transaction Controller (or extend an existing one) in the correct position.
2. Add `GET <new step path>`; assert its `data-current-step` marker.
3. Add `extract token` after the GET.
4. Add `POST <new step path>` with `struts.token.name=token`, `token=${csrfToken}` and the step's
   command fields (for example `command=true&wtd_checkbox_command=true`).
5. Assert the **next** step marker, plus a page-specific marker if one exists (`id="mime-type"` is an
   example).
6. Add `extract token` after the POST.
7. Update any later step numbers/paths if the flow shifted.
8. Update the verify step if the upload page moved.
9. Run `check`; only then add uploads.

Do not guess paths from the step number; copy them from the live flow or `README.md` §9.2.

### 5.6 Add a header or a parameter

- **Header for one request:** right-click the sampler -> **Add -> Config Element -> HTTP Header Manager**.
  Add Name/Value rows. It applies only to that sampler.
- **Header for every request in a controller/thread:** put the Header Manager at that level. Remember it
  will also be sent to login/wizard requests; many servers ignore unknown headers, but do not assume.
- **Form parameter:** sampler -> Parameters tab -> **Add**. Check **URL Encode?** for normal forms; leave
  it unchecked for a pre-encoded raw body.
- **Multipart field:** Parameters tab (Name/Value) plus Files Upload tab for the file part. The `name`
  field in this plan is a normal multipart form field; the file is `file`.

### 5.7 Add think time (carefully)

Right-click the sampler/controller -> **Add -> Timer**. Remember:

- The plan currently has **no timers**; the wizard runs immediately after login, which keeps the session
  alive. The environment's idle timeout is under 90 seconds, so a long timer between login and upload can
  drop the session.
- `TransactionController.includeTimers=false` means the transaction timing row excludes timer time, but
  the timer still delays execution. If you want the timer reflected in the transaction duration, check
  the controller's "Include duration..." box.
- If you need pacing, keep the delay well under the idle timeout, or add a harmless keep-alive request.

### 5.8 Raise concurrency

`user_count>1` creates multiple threads, each with its own Cookie Manager and variable map. But:

- `JL0003` is single-session; a second login invalidates the first. Use distinct accounts and override
  `user_id` per thread (for example with a CSV Data Set Config; not present in this plan).
- The upload loop and `uploadedNames` are per thread; the summary is per thread.
- UAT's upload gate may rate-limit or timeslot-gate concurrent uploads; do not treat a 463 under load as
  a plan bug.

### 5.9 Rename a variable safely

1. Find the definition: `grep -n 'name="old"' MSOSE_UAT_wtd_upload_load_test_v2.jmx`.
2. Find every use: `grep -n '\${old}' MSOSE_UAT_wtd_upload_load_test_v2.jmx`.
3. Find script use: `grep -n "vars.get('old')\|vars.put('old'" ...`.
4. Update the UDV name, every `${old}`, every `vars.get/put`, the runner `-Jold=` if present, and the
   README/guide tables.
5. Remember case sensitivity and that `-J` names are global.

### 5.10 Enable the persist branch

Run with `-Jpersist_uploads=true` only if you accept the destructive write. The branch:

- attaches the rows with `0601`,
- goes Back with `0602`,
- submits `TR1_count=0` with `0603` to capture the server's rejection,
- verifies step 3 with `0604`.

It has no HTTP cleanup. Prefer a disposable account and delete the draft in the UI afterwards.

### 5.11 Fix element scope

Symptoms of wrong scope:

| Symptom | Likely cause |
|---|---|
| An assertion fires on requests it was not written for | Assertion is at controller/thread level, not under its sampler |
| A header appears on login requests | Header Manager is at thread level |
| A body is empty/undefined | PreProcessor is under a different sampler than the one consuming its variable |
| A post-processor does not see the response | It is a sibling of the sampler, not its child |

Rule: if it should apply to one request, make it a **child of that sampler**. If it should apply to a
group, make it a child of the controller and accept the broader scope.

### 5.12 Version a copy

For experiments:

```text
copy MSOSE_UAT_wtd_upload_load_test_v2.jmx MSOSE_UAT_wtd_upload_load_test_v3.jmx
```

Keep v2 as the baseline. Update the runner (or pass `-t`) only when you intend to switch. Do not rename
the delivered file in place; downstream docs and the runners reference `_v2`.

---

## Part 6. Running and validating changes

### 6.1 Profiles and expected results

| Profile | Command | Uploads | Payload | Expected (healthy, window open) |
|---|---|---|---|---|
| `check` | `run_wtd_load_test.cmd check` | 0 | `wtd_payload_30mb.zip` | 12 samples, `Err: 0`, works outside the window |
| `smoke` | `run_wtd_load_test.cmd smoke` | 2 | `wtd_payload_30mb.zip` | 14 samples, `Err: 0`, 2/2 `success:true` |
| `full` | `run_wtd_load_test.cmd full` | 30 | `wtd_payload_30mb.zip` | 42 samples, `Err: 0`, 30/30 uploads |

Observed on 2026-10-30 with the ZIP-only rule: `check` 12/0 (`result/check-20261030-122404`),
`smoke` 14/0 with 2/2 uploads returning `200` and `success:true` (`result/smoke-20261030-122452`), and
`full` 42/0 with 30/30 uploads, 900,305,335 bytes sent in about 12 s
(`result/full-20261030-122520`). After the target switch to `10.12.128.248`, both runners passed
`check` 12/0 (`result/check-20261030-151559`, `check-20261030-151611`) and `smoke` 14/0 with 2/2
uploads returning `200` + `success:true` (`result/smoke-20261030-152145`,
`result/smoke-20261030-152204`); each log line reads `Setting JMeter property: host=10.12.128.248`.
A direct two-upload probe (`result/probe-ip-upload`) confirms the same at 15:18.

History: after the captcha removal on 2026-10-28, the smoke runs at 16:21, 16:27 and 16:48 were 14
samples with **`Err: 2`** because the server returned **463**, and the last 30/30-upload full run
(`result/full-20261028-122815`) was from the captcha-era plan. On 2026-10-30 the same pattern appeared
at 14:37 (`Err: 2`, both uploads `463`) and then passed at 14:40 without any change, so a 463 is an
intermittent gate to retry, not proof that the plan is broken.

Git Bash:

```bash
export MSOSE_PWD='...'
bash run_wtd_load_test.sh check
```

The `.sh` runner does not pass `-Jbase` and does not embed a password.

### 6.2 What the runner actually invokes

```text
jmeter -n -t <kit>\MSOSE_UAT_wtd_upload_load_test_v2.jmx
       -l <kit>\result\<mode>-<stamp>.jtl
       -j <kit>\result\<mode>-<stamp>.log
       -e -o <kit>\report\<mode>-<stamp>
       <PROP>
```

`-n` = non-GUI, `-l` = JTL, `-j` = log, `-e -o` = generate the HTML dashboard. `PROP` contains the
save-service flags and the `-J` overrides.

### 6.3 Reading the output

**Log lines (in order):**

```text
PRE-FLIGHT OK file=... bytes=30009291 mime=... uploads=2 persist=false
VERIFY pages: uploads=2 persistedInPageList=checked
RUN SUMMARY uploads=2 expected=2 persist=false user=JL0003
```

- `PRE-FLIGHT OK` means the password and payload checks passed. If it is missing, read the
  `PRE-FLIGHT FAILED:` line above it.
- `VERIFY pages:` reports how many names were checked. `persistedInPageList=n/a` is the `check` profile
  (no uploads).
- `RUN SUMMARY uploads=<n>` counts attempts, not successes. Pair it with `Err:`.

**Console summary:**

```text
summary =     12 in 00:00:02 = 5.9/s Avg: 148 Min: 24 Max: 800 Err: 0 (0.00%)
```

The count is the number of executed samplers (12/14/42). Transaction rows and redirect sub-samples are
also written to the JTL but are not counted by the summariser.

**JTL row arithmetic** (useful when someone asks why the JTL has more rows than the console):

| Run | Executed samplers | + Transaction rows | + Redirect sub-samples | JTL rows |
|---|---|---|---|---|
| `check` | 12 | 5 (01-05) | 6 (`0107-0/-1`, `0202-0/-1`, `0302-0/-1`) | **23** |
| `smoke` | 14 | 5 | 6 | **25** |
| `full` | 42 | 5 | 6 | **53** |

The transaction row for `04 Upload` is marked failed if any upload child fails; that is correct
aggregation, not a separate error. The `-0`/`-1` rows are redirect sub-samples created by
`follow_redirects=true` on the login/wizard POSTs. The upload has `follow_redirects=false`, so it creates
no sub-samples.

The captcha-era `full-20261028-122815` JTL has **55** data rows, not 53: that plan also ran the two
captcha samplers (`0105`, `0106`). The current plan produces the 53 rows shown above.

**Dashboard:** `report\<mode>-<stamp>\index.html`. Check the error table first; then per-label counts and
percentiles. For `full`, the upload label dominates sent bytes (about 900 MB for 30 × 30.01 MB).

### 6.4 Exit code caveat

JMeter returns 0 even when assertions fail. The runners return JMeter's exit code, so a 0 is not proof of
success. The real gates are:

1. `Err: 0` in the console summary, and
2. `success=true` / `responseCode=200` on every `0401 POST bUpload_x` row in the JTL.

A 463 smoke returns 0 from JMeter and still has `Err: 2`. This is exactly why the README says to judge by
the JTL.

### 6.5 Failure triage

| Symptom | Meaning | Action |
|---|---|---|
| `PRE-FLIGHT FAILED: user_pwd is not set` | No UDV value and no `MSOSE_PWD` | Export/set the variable; do not put the password in the JMX |
| `PRE-FLIGHT FAILED: upload_file not found` | Wrong path or payload not next to the JMX | Use the absolute path or restore the payload |
| `PRE-FLIGHT FAILED: ... exceeds the 30 MiB client cap` | Payload too large for the kit's guard | Use a smaller payload or change the cap deliberately (server allows up to 50 MiB) |
| `assert captcha disabled` fails / `CAPTCHA re-enabled` | Login form has `name="captcha"` | Check `LOGIN_CHECK_CAPCHA='N'`, wait for the codeTable cache, do not loop logins |
| Login POST assertion fails with the login form | Wrong password, or captcha enforced | Verify credentials; check the switch; stop after two failures |
| `UnknownHostException` | DNS cannot resolve the configured `host` | Check `-Jhost=10.12.128.248`; the IP needs no resolution |
| TLS/handshake error | Not a certificate problem — JMeter's sampler is trust-all | Check `-Jhost`/`-Jport` and network reachability; `curl` reports certificate issues separately |
| Upload 463 | The server's upload gate is closed | Retry after a few minutes; if it persists, run `check`. Not a plan defect |
| Upload 400 | MIME/extension/magic bytes | Use an allowed pairing and a genuine file |
| Upload 302 to `/MSOSE/sysMsg` | Missing/expired token or session | Do not deep-link; ensure every POST has a fresh token |
| `TOKEN_NOT_FOUND` in a request | The extractor did not match the page | Inspect the page shape; update the regex or the request order |
| `assert step N` fails | Wrong path/step marker, or session lost | Compare with the captured contract; check the previous POST result |
| `assert uploader meta` fails | The upload page did not render `id="mime-type"` | The terms POST did not reach step 2; check `command`/`wtd_checkbox_command` |
| `assert temp files not persisted` fails | The reloaded page lists the temp names | The server is persisting against expectations; stop and investigate before more uploads |
| Session drops mid-run | Idle timeout < 90 s | Remove think time or add a keep-alive; do not pause between login and upload |
| Dashboard "folder already exists" | `-o` target not empty | Use a new timestamp or delete the old report |

### 6.6 Pre-sharing checklist

Before giving the kit or a modified plan to someone:

- [ ] `grep -n 'MSOSE_PWD\|user_pwd' MSOSE_UAT_wtd_upload_load_test_v2.jmx` shows only the empty UDV
      default and the environment-variable references - no password literal.
- [ ] The `.cmd`'s embedded credential is intentional and the folder is handled as sensitive; the `.sh`
      has no default.
- [ ] No JTL/log/dashboard contains request headers or bodies (the runner flags are still false).
- [ ] No cookie jar or captured page with a live session is in `work/`; `ARCHIVE/work` was reviewed.
- [ ] `check` passes 12/0 on the target machine, after any move.
- [ ] The plan opens in the GUI and the tree is intact (no missing samplers from a hand edit).
- [ ] `README.md` and this guide still describe the changed settings.
- [ ] The uploaded payload is a genuine allowed file type, not a renamed/zero-filled archive.

---

## Part 7. XML anatomy for careful edits

### 7.1 Root

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.5">
  <hashTree>
    <TestPlan ...>...</TestPlan>
    <hashTree>...</hashTree>
  </hashTree>
</jmeterTestPlan>
```

The file must be UTF-8. JMeter 5.5 writes `jmeter="5.5"`; opening a newer/older plan may prompt about
version differences.

### 7.2 The `hashTree` pairing rule

Every test element is followed by its own `<hashTree>` **sibling**. Children live inside that hashTree.
For example:

```xml
<HTTPSamplerProxy testname="0101 GET index">...</HTTPSamplerProxy>
<hashTree>
  <ResponseAssertion testname="assert 200">...</ResponseAssertion>
  <hashTree/>
  <RegexExtractor testname="extract token">...</RegexExtractor>
  <hashTree/>
</hashTree>
```

If you add an element and forget its `<hashTree/>`, or delete the wrong closing tag, JMeter may load the
plan with missing samplers or refuse it. The pure XML check does **not** catch this; open the GUI and
inspect the tree.

### 7.3 Property types

| XML | Meaning |
|---|---|
| `<stringProp name="...">value</stringProp>` | String |
| `<boolProp name="...">true/false</boolProp>` | Boolean |
| `<intProp name="...">8</intProp>` | Integer |
| `<collectionProp name="...">` | List of `elementProp` |
| `<elementProp name="..." elementType="...">` | One typed property (argument, header, file, UDV) |

Arguments use `HTTPArgument` with `Argument.name`, `Argument.value`, `HTTPArgument.use_equals` (whether to
write `name=value`), and `HTTPArgument.always_encode` (URL-encode). The raw-body argument has an empty
`Argument.name` (the `elementProp` itself may be labelled `body`) and `use_equals=false`.

### 7.4 Response Assertion `test_type`

The integer is a bit mask:

| Value | Rule |
|---|---|
| 1 | Matches (regex) |
| 2 | Contains (regex) |
| 4 | Not |
| 8 | Equals |
| 16 | Substring (literal) |
| 32 | Or |

Combinations used in this plan:

| Value | Meaning | Example |
|---|---|---|
| 8 | Equals | Response Code `200` |
| 16 | Substring | `success:true` |
| 6 | Contains + Not | `configModel.browser` must be absent |
| 20 | Substring + Not | `name="captcha"`, `<html`, `name="mso.userId"` must be absent |

`Assertion.assume_success` is the GUI's **Ignore Status** checkbox. The plan leaves it unchecked, so an
HTTP 4xx/5xx status is not forced to successful before the assertion runs: a transport or status failure
stays a failure even if the body text happens to match.

### 7.5 Safe edit procedure

1. Close the JMeter GUI (or work on a copy it does not have open).
2. Make a backup: `copy ..._v2.jmx ..._v2.bak`.
3. Edit with an XML-aware editor; keep UTF-8 and escape `&`, `<`, `>` as `&amp;`, `&lt;`, `&gt;`.
4. Validate well-formedness with the PowerShell `[xml]` cast.
5. Open in the GUI; expand the tree and confirm the element is where you intended.
6. Run `check`; then `smoke`; only then `full` in an open window.
7. If you changed a tunable, update the UDV table in `README.md` §2.3/§10.2 and this guide.

### 7.6 GUI save rewrites the file

JMeter rewrites the entire XML on save: indentation, element order, and line breaks can change. The line
numbers in this guide are for the delivered file. Use `testname="..."` as the stable anchor:

```bash
grep -n 'testname="0401 POST bUpload_x"' MSOSE_UAT_wtd_upload_load_test_v2.jmx
```

Also: if the GUI has the file open while you edit on disk, a GUI save overwrites your edit. Reload
(**File -> Open**) after an external edit, or close the GUI first.

---

## Part 8. Study exercises with answers

Try these before reading the answers; each one maps to a design decision in the plan.

**1. Why does every page before a POST have its own `extract token`?**
The Struts token is single-use. A POST consumes the token from the previous page, and the response page
contains the next one. If you skip an extractor, the following POST sends a stale/consumed token and is
redirected (often 302 to `/MSOSE/sysMsg`). See the token chain in Part 3.6.

**2. What happens if you delete the extractor on `0104`?**
`0107` would send the `csrfToken` left over from `0103`, which the `0103` POST already consumed. The login
POST fails; the dashboard assertion fails and, depending on the response, the login form assertion also
fails. The run stops before uploading. (If the extractor exists but does not match, its default
`TOKEN_NOT_FOUND` is sent instead - also a visible failure.)

**3. Why is `follow_redirects=false` only on the upload?**
A successful upload returns JSON, not a redirect. If the session/token is bad, the server may redirect to
a login/error page; with redirects disabled JMeter records the 302 itself, which the code assertion
catches. With redirects enabled the 302 would be followed and the failure could look like a successful
HTML page.

**4. Why three upload assertions instead of one?**
They distinguish failure layers: HTTP code (transport/auth/timeslot), `success:true` (application
refusal: MIME/size/magic bytes), and no `<html` (a silently returned login/error page). A single 200 check
would pass on an HTML login page.

**5. Why does the Cookie Manager clear cookies each iteration?**
So each outer iteration starts a fresh session. With `run_iterations=1` it is invisible, but if you raise
the loop count it prevents a previous iteration's session/token state from confounding the next. It also
makes the login flow the single source of session state.

**6. Why cap the payload at 30 MiB when the server allows 50 MiB?**
The cap is a client-side fail-fast guard, not a copy of the server limit. It keeps the kit's `full` run
(30 × ~30.01 MB) predictable and rejects an accidental giant file before the network work. The server's
page limit is 52,428,800 bytes (50 MiB); see README §9.3.

**7. Why is `user_count=1`?**
`JL0003` is a single-active-session account. Two threads logging in as the same user invalidate each
other. More concurrency requires distinct accounts and a per-thread data source; the plan deliberately
does not pretend to do that.

**8. What do `parent=false` and `includeTimers=false` do?**
`parent=false` means the Transaction Controller writes a separate transaction row rather than making the
transaction a parent of its children; you still get one `01 Login` row and individual request rows.
`includeTimers=false` excludes timer and pre/post-processor time from the transaction duration. The plan
has no timers, so this mainly keeps the transaction timing clean.

**9. Why does `RUN SUMMARY uploads=2` when both uploads returned 463?**
The post-processor appends `uploadName` to `uploadedNames` before the assertions run. The summary counts
attempts. The `Err: 2` and the JTL `responseCode=463` rows are the success gate.

**10. Where does `${__jm__UploadLoop__idx}` come from?**
JMeter automatically exposes the loop index for a Loop Controller as `__jm__<controllerName>__idx`,
0-based. Because the controller is named `UploadLoop`, the variable is `__jm__UploadLoop__idx`. Rename the
controller and the variable name changes.

**11. What happens with `num_uploads=0`?**
The Loop Controller executes zero iterations, so the `04` transaction has no upload sample. That is the
`check` profile: 12 samples, no upload, no 463 risk. Verified live.

**12. What is the difference between `ctx.getEngine().stopTest()` and stopping one thread?**
`stopTest()` stops the whole test engine, so no thread continues to log in or upload. It is used by the
pre-flight and the captcha guard for safety. A thread-local stop would let other threads continue and
could burn failed-login attempts.

**13. Why are there two token variables, `csrfToken` and `pageToken`?**
`csrfToken` is the rotating token used by normal form POSTs and the upload query string. `pageToken` is
captured from the verify page and refreshed by `0602`; it is the token embedded in the raw `persistBody`
for `0601`, and `0603` uses it after the Back refresh. Keeping them separate makes the persist branch's
token lifecycle explicit. If you simplify the branch, verify which POST consumes which token.

**14. Why is the persist body pre-processor a child of the If, not of `0601`?**
Placement defines scope. As a child of the If, it runs before every sampler in the branch; only `0601`
consumes `${persistBody}`. Moving it under `0601` is functionally equivalent for `0601`; moving it under
`0602` would leave `0601` with an undefined body. The general rule: put a pre-processor under the sampler
that consumes its variable unless you intentionally want controller-wide scope.

**15. Why does the plan assert `data-current-step="2"` rather than visible text?**
The data attribute is a stable machine-readable marker rendered by the wizard frame; visible text can
change with locale/wording. It is also a substring that is unlikely to appear elsewhere. `id="mime-type"`
serves the same purpose for the uploader widget.

---

## Appendix A. Variables reference

### A.1 User Defined Variables (Test Plan, lines 8-81)

| Name | Value | Line | Consumed by |
|---|---|---|---|
| `scheme` | `${__P(scheme,https)}` | 10-14 | HTTP Request Defaults (104) |
| `host` | `${__P(host,10.12.128.248)}` | 15-19 | HTTP Request Defaults (102) |
| `port` | `${__P(port,7012)}` | 20-24 | HTTP Request Defaults (103) |
| `base` | `${__P(base,/MSOSE)}` | 25-29 | All sampler paths |
| `user_id` | `${__P(user_id,JL0003)}` | 30-34 | `0107` `mso.userId` |
| `user_pwd` | `${__P(user_pwd,)}` (empty) | 35-39 | Pre-flight fallback, `0107` `mso.passwd` |
| `user_count` | `${__P(user_count,1)}` | 40-44 | Thread Group threads (90) |
| `ramp_time` | `${__P(ramp_time,0)}` | 45-49 | Thread Group ramp (91) |
| `run_iterations` | `${__P(run_iterations,1)}` | 50-54 | Thread Group loop (88) |
| `num_uploads` | `${__P(num_uploads,30)}` | 55-59 | Loop Controller (722), pre-flight log, summary, 0600 warning |
| `upload_file` | `${__P(upload_file,)}` (empty -> `wtd_payload_30mb.zip`) | 60-64 | Pre-flight default (134-136), multipart file (740) |
| `upload_file_mime` | `${__P(upload_file_mime,application/zip)}` | 65-69 | Multipart MIME (742), pre-flight log |
| `upload_ext` | `${__P(upload_ext,zip)}` | 70-74 | Name builder (770) |
| `persist_uploads` | `${__P(persist_uploads,false)}` | 75-79 | If condition (891), pre-flight/summary logs |

### A.2 Runtime variables

| Name | Written by | Read by | Notes |
|---|---|---|---|
| `csrfToken` | 9 extractors + upload post-processor | Every POST, upload query | Single-use; rotated by `X-CSRF-TOKEN` |
| `pageToken` | `0501`, `0602` extractors | Persist body builder | Used by `0601`/`0603` |
| `uploadName` | Upload pre-processor | Upload `name` param, post-processor | `o_lt<thread>_<epoch>_<idx>.<ext>` |
| `uploadSize` | Upload pre-processor | Persist body builder, post-processor | Bytes |
| `uploadOrigName` | Upload pre-processor | Persist body builder, post-processor | Original file name |
| `uploadedNames` | Upload post-processor | Verify assertion, summary | Comma-separated; attempted uploads |
| `uploadedMeta` | Upload post-processor | Persist body builder | Three fields (name, size, original name) joined by a vertical bar; entries separated by `;` |
| `persistBody` | Persist pre-processor | `0601` raw body | Built from `pageToken` + `uploadedMeta` |
| `__jm__UploadLoop__idx` | JMeter Loop Controller | Upload pre-processor | 0-based loop index |
| `TOKEN_NOT_FOUND` | Extractor default | Following POST if no match | Sentinel, not a valid token |

### A.3 Other JSR223 bindings

| Binding | Meaning |
|---|---|
| `vars` | `JMeterVariables` for the current thread; `get/put` runtime variables |
| `ctx` | `JMeterContext`; `ctx.getEngine()`, `ctx.getThreadNum()` |
| `prev` | `SampleResult` of the sampler the post-processor/assertion is attached to |
| `SampleResult` | Current sampler result (in a JSR223 sampler) |
| `AssertionResult` | Result object in a JSR223 assertion; `setFailure`, `setFailureMessage` |
| `log` | JMeter logger (`log.info`, `log.warn`, `log.error`) |

---

## Appendix B. Element inventory

Counts in the delivered plan:

| Kind | Count | Notes |
|---|---|---|
| Test Plan | 1 | UDVs live here |
| Thread Group | 1 | `wtd upload` |
| HTTP Request Defaults | 1 | protocol/host/port/encoding/timeouts |
| HTTP Cookie Manager | 1 | clear each iteration |
| Transaction Controller | 5 | login, two wizard, upload, verify |
| If Controller | 1 | phase 06 |
| Loop Controller | 1 | `UploadLoop` |
| HTTP Request | 15 | 5 login + 4 wizard + 1 upload + 1 verify + 4 persist |
| Response Assertion | 22 | code/body/markers |
| Regex Extractor | 11 | 9 `csrfToken`, 2 `pageToken` |
| JSR223 Sampler | 3 | pre-flight, 0600 warn, 99 summary |
| JSR223 PreProcessor | 2 | upload name, persist body |
| JSR223 PostProcessor | 2 | captcha guard, token capture |
| JSR223 Assertion | 1 | verify temp names |
| Header Manager | 2 | `app-uploader`, form content type |

Not present: timers, listeners/result collectors, disabled elements, plugins, Test Fragments, Module
Controllers, While/ForEach/Switch controllers.

The tree has six numbered phases (01-06), but only five are Transaction Controllers. Phase 06 is an If
Controller whose children (0600-0604) run only when `persist_uploads=true`.

The exact line ranges for every node are in Part 2.3. The JMX uses only standard JMeter 5.5 components;
the logic lives in the small Groovy scripts quoted in Parts 3-4.

---

## Appendix C. Glossary

| Term | Meaning in this kit |
|---|---|
| **Test plan (.jmx)** | The XML file JMeter loads; contains the tree and all settings |
| **Thread Group** | The simulated users; here one user, one outer loop |
| **Sampler** | One request (HTTP Request) or one scripted step (JSR223 Sampler) |
| **Transaction Controller** | Groups samplers into one timing/result row |
| **Loop Controller** | Repeats its children; here the upload loop |
| **If Controller** | Runs its children only when the condition is true |
| **Config Element** | Applies settings to samplers in scope (defaults, cookie manager, header manager) |
| **PreProcessor** | Runs before its sampler/controller scope |
| **PostProcessor** | Runs after the sampler response, before assertions |
| **Assertion** | Pass/fail check on the response; does not stop the sampler by itself |
| **Regex Extractor** | Saves a captured text group into a variable |
| **UDV** | User Defined Variable; a per-thread variable initialized from `${__P(...)}` |
| **Property** | JVM-level `-Jname=value`; read by `${__P(name,default)}` |
| **Variable** | Per-thread value `${name}`; written by extractors/processors |
| **CSRF token** | Struts single-use token posted as `token`; rotated on every successful POST |
| **`requestCSRFHeader=renew`** | Upload query flag asking the server to return the next token in `X-CSRF-TOKEN` |
| **`app-uploader: Y`** | Header the upload servlet requires to treat the request as the application uploader |
| **Timeslot gate** | Server-side upload window; closed -> HTTP 463 |
| **Temporary upload** | The file is held in the session temp area but not attached to the draft until the step's Next |
| **Persist** | Attaching the uploaded rows to the draft; destructive and not HTTP-clearable |
| **`data-current-step`** | HTML data attribute rendered by the wizard; used as a stable step marker |
| **`id="mime-type"`** | Marker that the uploader widget is present on the page |
| **JTL** | JMeter's CSV result file (`-l`) |
| **Dashboard** | The static HTML report generated by `-e -o` |
| **Truststore** | JKS file containing the UAT certificate chain; `changeit`. Optional here — JMeter 5.5 is trust-all |
| **`TrustAll Socket Factory`** | The HTTP client setting JMeter 5.5 logs on every run; it accepts any certificate, so neither the chain nor the name is checked |

---

## Appendix D. Cross-references and audit commands

### D.1 Where to read more

| Topic | Document / section |
|---|---|
| Run instructions, profiles, results | `README.md` §§5-6 |
| Settings vs requirement (REQ-001..015) | `README.md` §10.4 |
| Worked `${base}` example | `README.md` §10.3 |
| Hostname vs IP evidence | `README.md` §10.3 |
| Original plan defects and live contract | `VERIFICATION_REPORT.md` §§2-5 |
| Captcha-removal change and evidence | `VERIFICATION_REPORT.md` §6 |
| Retired solver and archive | `ARCHIVE/README.md`, `README.md` §4.4 |

### D.2 Audit commands

```bash
# Every variable reference, most used first
grep -o '\${[^}]*}' MSOSE_UAT_wtd_upload_load_test_v2.jmx | sort | uniq -c | sort -rn

# UDV definitions (name + value)
grep -n '<stringProp name="Argument.name">' -A1 MSOSE_UAT_wtd_upload_load_test_v2.jmx

# Where one variable is used
grep -n '\${base}' MSOSE_UAT_wtd_upload_load_test_v2.jmx

# Absolute paths (should be none)
grep -nE 'C:\\|/Users/|/home/' *.jmx

# Password value in the plan (should show only the empty UDV default)
grep -n 'user_pwd' *.jmx

# Locate an element after the GUI rewrote the file
grep -n 'testname="0401 POST bUpload_x"' MSOSE_UAT_wtd_upload_load_test_v2.jmx

# Well-formedness
powershell -NoProfile -Command "[xml](Get-Content -Raw 'MSOSE_UAT_wtd_upload_load_test_v2.jmx') | Out-Null; 'XML OK'"
```

Interpretation:

- A `${name}` with no matching UDV is either a runtime variable (`csrfToken`, `pageToken`, `uploadName`,
  `uploadSize`, `uploadOrigName`, `uploadedNames`, `uploadedMeta`, `persistBody`,
  `__jm__UploadLoop__idx`) or a typo. Compare with Appendix A.
- A UDV that is never referenced is dead configuration.
- A `${__P(...)}` appears once per setting, in the UDV definition; the rest of the plan uses `${name}`.

### D.3 Change log for this guide

| Date | Change |
|---|---|
| 2026-10-28 | Initial version for `MSOSE_UAT_wtd_upload_load_test_v2.jmx` (captcha-free login) |
| 2026-10-30 | ZIP-only UAT rule: default payload `wtd_payload_30mb.zip` (30,009,291 B, `application/zip`, `zip`); pre-flight fallback and runner defaults updated; verified `check` 12/0, `smoke` 14/0 (2/2), `full` 42/0 (30/30) |
| 2026-10-30 | Target switched to the literal UAT IP `10.12.128.248` (the hostname's DNS answer is a different host that returns 404). The hosts-file override was removed; JMeter 5.5's client is trust-all, so no truststore is needed either. Verified through both runners: `check` 12/0 (`result/check-20261030-151559`, `check-20261030-151611`) and `smoke` 14/0 with 2/2 uploads (`result/smoke-20261030-152145`, `smoke-20261030-152204`); a direct two-upload probe (`result/probe-ip-upload`) gives the same result |
| 2026-10-30 | Upload gate wording corrected: HTTP 463 is intermittent (463 at 14:37, `200` for the identical profile at 14:40 and 15:18), not a fixed 12:00-14:00 window |

---

*This guide describes the plan as delivered on 2026-10-28 and updated to the ZIP-only UAT rule on
2026-10-30 (1,133-line JMX, JMeter 5.5). If you change
the plan, update the affected tables and rerun `check` before sharing it. The authoritative runtime
behavior is always the live `result\<mode>-<stamp>.log` and `.jtl`, not this document.*
