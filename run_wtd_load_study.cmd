@echo off
setlocal enabledelayedexpansion
rem ===========================================================================
rem  MSOSE UAT - wtd transaction-data upload load test (JMeter 5.5 CLI)
rem
rem  Usage:
rem    run_wtd_load_test.cmd            :: smoke  = 2 uploads, 30 MB zip
rem    run_wtd_load_test.cmd check      :: login + wizard only, 0 uploads
rem    run_wtd_load_test.cmd smoke
rem    run_wtd_load_test.cmd full       :: 30 uploads x 30 MB zip
rem
rem  Environment:
rem    MSOSE_PWD       optional, defaults to the JL0003 UAT test password below
rem    MSOSE_USER      optional, default JL0003
rem    JMETER_HOME     optional, default ..\apache-jmeter-5.5
rem    PERSIST_UPLOADS optional, default false; true runs the persist branch
rem                    (step 06, writes the uploaded rows into the UAT draft)
rem
rem  Persist mode:
rem    set PERSIST_UPLOADS=true
rem    run_wtd_load_test.cmd smoke
rem
rem  UAT prerequisite: the login captcha must be disabled
rem    CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA = 'N'
rem  (allow up to ~15 min for the codeTable cache after a change). The plan
rem  fails at the login page if a captcha field is rendered.
rem ===========================================================================

set "HERE=%~dp0"
set "HERE=%HERE:~0,-1%"
if not defined JMETER_HOME set "JMETER_HOME=%HERE%\..\apache-jmeter-5.5"
set "JMETER=%JMETER_HOME%\bin\jmeter.bat"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=smoke"

if not exist "%JMETER%" (
  echo [ERROR] JMeter not found: %JMETER%
  exit /b 2
)
rem UAT test credential for convenience; override by setting MSOSE_PWD beforehand.
if not defined MSOSE_PWD set "MSOSE_PWD=abcd1234"
if not defined MSOSE_USER set "MSOSE_USER=JL0003"

rem Persist mode (optional).  The plan compares this value with the literal
rem "true", so normalise the case and reject anything else.
if not defined PERSIST_UPLOADS set "PERSIST_UPLOADS=false"
if /I "%PERSIST_UPLOADS%"=="TRUE" set "PERSIST_UPLOADS=true"
if /I "%PERSIST_UPLOADS%"=="FALSE" set "PERSIST_UPLOADS=false"
if /I not "%PERSIST_UPLOADS%"=="true" if /I not "%PERSIST_UPLOADS%"=="false" (
  echo [ERROR] PERSIST_UPLOADS must be true or false, got "%PERSIST_UPLOADS%"
  exit /b 2
)

rem --- JMeter's bin\system.properties installs an HTTP proxy that cannot be
rem     overridden with -J; internal UAT hosts are unreachable through it.
findstr /B /C:"http.proxyHost=" "%JMETER_HOME%\bin\system.properties" >nul 2>&1
if not errorlevel 1 (
  echo [ERROR] Active proxy in "%JMETER_HOME%\bin\system.properties".
  echo         Comment out http.proxyHost/Port and https.proxyHost/Port, then retry.
  exit /b 3
)

rem --- TLS: optional.  JMeter 5.5's HTTP client builds a trust-all socket
rem     factory (it logs "Setting up HTTPS TrustAll Socket Factory"), so it
rem     checks neither the chain nor the certificate name and the plan can
rem     target the UAT IP directly (no hosts file, no truststore needed).
rem     The line below is kept only for reference; uncomment it to load the
rem     captured chain explicitly.
rem set "JVM_ARGS=-Djavax.net.ssl.trustStore="%HERE%\uat-truststore.jks" -Djavax.net.ssl.trustStorePassword=changeit"

set "PROP=-Jjmeter.save.saveservice.url=false -Jjmeter.save.saveservice.requestHeaders=false -Jjmeter.save.saveservice.responseHeaders=false -Jjmeter.save.saveservice.response_data=false -Jjmeter.save.saveservice.samplerData=false"
set "PROP=%PROP% -Juser_id=%MSOSE_USER% -Jhost=10.12.128.248 -Jport=7012 -Jbase=/MSOSE"
set "PROP=%PROP% -Jpersist_uploads=%PERSIST_UPLOADS%"

if /I "%MODE%"=="check" (
  set "JMX=%HERE%\MSOSE_UAT_wtd_upload_load_study.jmx"
  set "PROP=%PROP% -Jnum_uploads=0"
) else if /I "%MODE%"=="smoke" (
  set "JMX=%HERE%\MSOSE_UAT_wtd_upload_load_study.jmx"
  set "PROP=%PROP% -Jnum_uploads=2"
) else if /I "%MODE%"=="full" (
  set "JMX=%HERE%\MSOSE_UAT_wtd_upload_load_study.jmx"
  set "PROP=%PROP% -Jnum_uploads=30 -Jupload_file=%HERE%\wtd_payload_30mb.zip -Jupload_file_mime=application/zip -Jupload_ext=zip"
) else (
  echo [ERROR] Unknown mode "%MODE%"  ^(use check^|smoke^|full^)
  exit /b 2
)

rem Step 06 builds its body from the rows captured by the upload loop, so it
rem cannot run without uploads.
if /I "%PERSIST_UPLOADS%"=="true" if /I "%MODE%"=="check" (
  echo [ERROR] PERSIST_UPLOADS=true needs a mode with uploads ^(use smoke^|full^).
  exit /b 2
)

rem Locale-independent timestamp (%DATE%/%TIME% follow the OS locale).
set "STAMP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss" 2^>nul`) do set "STAMP=%%I"
if not defined STAMP set "STAMP=run-%RANDOM%"
set "OUT=%HERE%\result\%MODE%-%STAMP%"
set "REP=%HERE%\report\%MODE%-%STAMP%"
if not exist "%HERE%\result" mkdir "%HERE%\result"
if not exist "%HERE%\report" mkdir "%HERE%\report"

echo [INFO] login captcha must be disabled on UAT (CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA='N').
echo [INFO] mode=%MODE%  user=%MSOSE_USER%  persist_uploads=%PERSIST_UPLOADS%  jmx=%JMX%
echo [INFO] jtl=%OUT%.jtl  report=%REP%
rem "< nul" keeps jmeter.bat's trailing pause from blocking a scripted run.
call "%JMETER%" -n -t "%JMX%" -l "%OUT%.jtl" -j "%OUT%.log" -e -o "%REP%" %PROP% < nul
set "RC=%ERRORLEVEL%"

echo [INFO] JMeter exit code: %RC%
if exist "%REP%\index.html" echo [INFO] dashboard: %REP%\index.html
exit /b %RC%
