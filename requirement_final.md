# MSOSE WTD Transaction-Data Upload — Load Test Requirements

**Status:** Draft for review  
**Source:** `20261027/requirement.txt` + stakeholder clarifications  
**Companion JMX:** `MSOSE_UAT_wtd_upload_load_test.jmx`

---

## 1. Objective

Design a JMeter load test that simulates an authorized user logging into the MSOSE portal,
navigating the WTD (transaction data) upload workflow, uploading **30 × 30MB files**, clearing
all uploads, and verifying the cleared state — then repeat the flow under increasing concurrency.

## 2. Scope

- **In scope:** All 9 steps of the user flow below.
- **Out of scope (for v1):** Production execution, server-side file deletion checks,
  approval/review workflows, and multi-workstation distributed execution.

## 3. User Flow (per virtual user, in order)

| # | Step | URL (relative to base `https://10.12.128.248:7012/MSOSE`) |
|---|------|------|
| 1 | Login (ID `JL0003`, configurable password) | `/index` |
| 2 | First Page | `/wtd/001s0-2` |
| 3 | Terms and Conditions | `/wtd/001s1-2` |
| 4 | Upload Transaction Data File (page) | `/wtd/001s2-2` |
| 5 | **Upload 30 files, 30MB each** (default file `LIC_APP_TBL.xlsx`, configurable) | upload endpoint |
| 6 | Upload Supporting Documents | `/wtd/001s3-2` |
| 7 | Back to Upload Transaction Data File | `/wtd/001s2-2` |
| 8 | **Empty All Upload Files** | action on `/wtd/001s2-2` |
| 9 | Upload Supporting Documents (verify cleared state) | `/wtd/001s3-2` |

## 4. Functional Requirements

- **REQ-001 — Configurable UAT target:** base URL (scheme/host/port) MUST be configurable;
  default `https://10.12.128.248:7012/MSOSE`.
- **REQ-002 — Credentials:** username MUST default to `JL0003`; password MUST be configurable
  and not hard-coded into the test flow or written to result/report files.
- **REQ-003 — Session handling:** the authenticated session (cookies/tokens) MUST be retained
  across all steps.
- **REQ-004 — Ordered navigation:** steps MUST execute in the order above.
- **REQ-005 — Configurable upload file:** default `LIC_APP_TBL.xlsx`, overridable.
- **REQ-006 — Pre-flight file validation:** test MUST verify the file exists and is readable
  before generating load; fail fast with a clear message otherwise.
- **REQ-007 — Upload count:** exactly **30 upload operations per virtual user per workflow**.
- **REQ-008 — Unique upload entries:** each upload MUST use a unique file name so the
  application shows 30 distinct entries (`temp{prefix}{thread}_{index}` by default).
- **REQ-009 — Verify uploads:** test MUST assert each upload request succeeds (HTTP 200)
  before proceeding; strengthen with an application-specific success indicator when known.
- **REQ-010 — Clear + verify:** after "Empty All Upload Files", the test MUST verify the
  upload list no longer contains the uploaded entries, revisit Supporting Documents, and
  verify the page loads successfully.
- **REQ-011 — Configurable load profile:** users, ramp-up, iterations MUST be configurable.
- **REQ-012 — Bounded execution:** default = one workflow per virtual user; no unbounded loops.
- **REQ-013 — UAT-only safeguard:** default target MUST be UAT; never silently target Prod.
- **REQ-014 — Results:** MUST output machine-readable results and an HTML summary report
  identifying configuration and stage.
- **REQ-015 — Safe diagnostics:** no passwords/session secrets captured in results.

## 5. Load Profile (proposal — for review)

| Stage | Concurrent users | Ramp-up | Workflows/user | Upload ops | Approx. data (30MB/file) |
|---|:--:|:--:|:--:|:--:|:--:|
| Smoke | 1 | 0s | 1 | 30 | ~900MB |
| Stage 1 | 1 | 60s | 1 | 30 | ~900MB |
| Stage 2 | 5 | 60s | 1 | 150 | ~4.5GB |
| Stage 3 | 10 | 60s | 1 | 300 | ~9GB |

⚠️ Confirm the UAT environment can accept the data volume / disk usage before Stage 3.
Performance thresholds (error rate, response-time percentiles) are **TBD**.

## 6. JMeter Test Plan Design (`MSOSE_UAT_wtd_upload_load_test.jmx`)

### 6.1 User Defined Variables (all overridable with `-J`)

| Variable | Default | Meaning |
|---|---|---|
| `scheme` | `https` | Protocol |
| `host_IP` | `10.12.128.248` | Server host |
| `host_Port` | `7012` | Server port |
| `user_name` | `JL0003` | Login ID |
| `user_pwd` | *(configurable)* | Login password |
| `upload_file` | `LIC_APP_TBL.xlsx` | Upload source file |
| `upload_file_mime` | `application/octet-stream` | Upload MIME type |
| `num_uploads` | `30` | Uploads per workflow |
| `user_count` | `1` | Concurrent users |
| `ramp_up` | `60` | Ramp-up seconds |
| `run_iterations` | `1` | Workflows per user |
| `think_time` | `0` | ms pause between steps (0 = off) |
| `mso_id_prefix` | `XX` | Unique-name prefix |

### 6.2 Structure (Thread Group "WTD Upload Users")

| Transaction Controller | Content |
|---|---|
| `0000 - [Login Process]` | GET `/MSOSE/index` → POST `/MSOSE/security/login.action` (`user.userId`, `user.pwd`) |
| `0100 - [First Page]` | GET `/MSOSE/wtd/001s0-2` |
| `0200 - [Terms & Conditions]` | GET `/MSOSE/wtd/001s1-2` |
| `0300 - [Upload Transaction Data File]` | GET `/MSOSE/wtd/001s2-2` |
| `0400 - [Upload 30 Files]` | Loop (30×) → multipart POST upload (`file` + unique `name`) |
| `0500 - [Supporting Documents]` | GET `/MSOSE/wtd/001s3-2` |
| `0600 - [Back to Transaction Data]` | GET `/MSOSE/wtd/001s2-2` |
| `0700 - [Empty All Upload Files]` | POST Empty-All action + GET reload; assert entries absent |
| `0800 - [Supporting Docs after clear]` | GET `/MSOSE/wtd/001s3-2`; assert page OK |

### 6.3 Assertions
- Every step: Response Assertion — response code contains `200`.
- Steps 0700/0800: additionally assert response text **does not contain** `temp{prefix}`.

### 6.4 Listeners
- **Summary Report** (enabled) — aggregates in GUI/CLI.
- **View Results Tree** (disabled) — enable for debugging only.
- HTML report generated from CLI with `-e -o`.

## 7. How to Test

### 7.1 Pre-flight
1. Put `LIC_APP_TBL.xlsx` (or configured file) next to the JMX (JMeter working directory).
2. Confirm the file is ~30MB and readable.
3. Confirm the UAT URL is reachable: `https://10.12.128.248:7012/MSOSE/index`.
4. Confirm `JL0003` credentials are valid for the target environment.

### 7.2 Smoke test (1 user)
```cmd
jmeter -n -t MSOSE_UAT_wtd_upload_load_test.jmx ^
  -Juser_count=1 -Jramp_up=0 -Jrun_iterations=1 ^
  -Jnum_uploads=30 ^
  -Juser_pwd=******** ^
  -l result\smoke.csv -e -o report\smoke\
```

### 7.3 Staged load tests
```cmd
:: Stage 1 (1 user)
jmeter -n -t MSOSE_UAT_wtd_upload_load_test.jmx -Juser_count=1 -Jramp_up=60 ^
  -Juser_pwd=******** -l result\stage1.csv -e -o report\stage1\

:: Stage 2 (5 users)
jmeter -n -t MSOSE_UAT_wtd_upload_load_test.jmx -Juser_count=5 -Jramp_up=60 ^
  -Juser_pwd=******** -l result\stage2.csv -e -o report\stage2\

:: Stage 3 (10 users)
jmeter -n -t MSOSE_UAT_wtd_upload_load_test.jmx -Juser_count=10 -Jramp_up=60 ^
  -Juser_pwd=******** -l result\stage3.csv -e -o report\stage3\
```

### 7.4 Debugging
Run with `-Jthink_time=1000`, enable View Results Tree, or open the CSV in the GUI
**View Results Tree** to inspect request/response details for failed samples.

## 8. How to Verify

### 8.1 Automated checks
1. **CSV results** (`result\*.csv`): filter `success` column — all must be `true`;
   `error` count must be 0.
2. **Sample counts per label**:
   - Upload sampler label appears exactly `users × 30` times.
   - Each navigation label appears exactly `users` times.
3. **Assertions**: no assertion-failure messages in the CSV/HTML report.
4. **HTML report** (`report\<stage>\index.html`): check dashboard (error %, throughput,
   response-time percentiles), and the per-transaction table for upload sampler stats.
5. **Response-time sanity**: note p90/p95 of the upload sampler per stage; keep for the
   TBD threshold discussion.

### 8.2 Manual verification (once per stage, recommended)
1. In a browser, log in as `JL0003` and manually walk steps 2–4.
2. Upload 2–3 files manually to confirm the UI flow matches the JMX endpoints
   (login POST path, upload endpoint path/params, Empty-All request).
3. After the JMeter run, log in and open *Upload Transaction Data File*:
   **confirm no leftover `tempXX…` files** remain (clear step worked).
4. Confirm the cleared state persists after visiting Supporting Documents.

## 9. Assumptions / Items to Confirm

1. **Endpoints**: login POST is assumed to be `/MSOSE/security/login.action` with
   `user.userId`/`user.pwd` (mirrors existing MSOSE plans); upload endpoint assumed
   `/MSOSE/common/bUpload.action` (mirrors existing plan). **Record with the HTTP(S) Test
   Script Recorder and update the JMX if different.**
2. **Empty-All action**: real request params unknown — placeholder POST (`emptyAll=true`);
   replace with the recorded request.
3. **File size unit** (MB vs MiB) and **numeric pass/fail thresholds** are TBD.
4. **30MB payload for 30 uploads** means ~900MB per user per workflow — confirm disk/network.
5. A single source file is reused for all 30 uploads with unique names.

## 10. Pass / Fail Criteria (TBD — to be agreed)

| Criterion | Target |
|---|---|
| Request error rate | TBD (suggest ≤ 0.1%) |
| Upload sampler p95 | TBD (suggest ≤ 60s for 30MB) |
| Full workflow success | 100% of users complete steps 1–9 |
| Clear verification | 0 leftover `temp` entries in UI after run |