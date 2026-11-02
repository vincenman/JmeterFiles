#!/usr/bin/env bash
# Re-login to MSOSE UAT and write cookies to cj.txt.
# UAT must have the login captcha disabled: CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA = 'N'
# (allow up to ~15 min for the codeTable cache after a change).
# Usage: MSOSE_PWD=<password> ./relogin.sh
# The cookie jar and captured pages are deleted on exit; no secret is left on disk.
set -eu
BASE="https://10.12.128.248:7012/MSOSE"
WORK="$(cd "$(dirname "$0")" && pwd)"
CJ="$WORK/cj.txt"
cleanup() { rm -f "$CJ" "$WORK"/r_*.html; }
trap cleanup EXIT
: "${MSOSE_PWD:?MSOSE_PWD not set}"
USER_ID="${MSOSE_USER:-JL0003}"

get() { curl -k -sS -m 60 --noproxy '*' -c "$CJ" -b "$CJ" "$@"; }
post() { curl -k -sS -m 60 --noproxy '*' -c "$CJ" -b "$CJ" -X POST "$@"; }
token_of() { grep -o 'name="token" value="[^"]*"' "$1" | tail -1 | sed 's/.*value="//;s/"$//'; }

get -L "$BASE/security/login" -o "$WORK/r_step1.html"
T=$(token_of "$WORK/r_step1.html")
if ! grep -q 'name="mso.userId"' "$WORK/r_step1.html"; then
  post "$BASE/checkResult" \
    --data-urlencode "struts.token.name=token" --data-urlencode "token=$T" \
    --data-urlencode "configModel.operationSystem=Windows" \
    --data-urlencode "configModel.operationSystemVer=10" \
    --data-urlencode "configModel.enableJS=Enabled" \
    --data-urlencode "configModel.enableCookies=Enabled" \
    --data-urlencode "configModel.enableFlash=Disabled" \
    --data-urlencode "configModel.flashVer=" \
    --data-urlencode "configModel.browser=Chrome" \
    --data-urlencode "configModel.browserVer=120" \
    --data-urlencode "configModel.enableJava=Disabled" \
    --data-urlencode "configModel.javaVer=" \
    --data-urlencode "configModel.pdfViewer=Disabled" \
    --data-urlencode "configModel.pdfViewerVer=" \
    -o "$WORK/r_check.html"
  T=$(token_of "$WORK/r_check.html")
  post "$BASE/index" --data-urlencode "struts.token.name=token" --data-urlencode "token=$T" \
    --data-urlencode "preAction=/security/login" --data-urlencode "nextBtn_=Home" \
    -L -o "$WORK/r_step2.html"
fi

get "$BASE/security/login" -o "$WORK/r_login.html"
grep -q 'name="mso.userId"' "$WORK/r_login.html" || { echo "LOGIN=no-login-form"; exit 3; }
if grep -q 'name="captcha"' "$WORK/r_login.html"; then
  echo "LOGIN=captcha-enabled (check CTRL_PARM_TBL.LOGIN_CHECK_CAPCHA='N' and the codeTable cache; login not attempted)"
  exit 4
fi
T=$(token_of "$WORK/r_login.html")

URL=$(post "$BASE/security/login" \
  --data-urlencode "struts.token.name=token" --data-urlencode "token=$T" \
  --data-urlencode "mso.userId=$USER_ID" \
  --data-urlencode "mso.passwd=$MSOSE_PWD" \
  -L -o "$WORK/r_resp.html" -w '%{url_effective}')
grep -q '/wtd/001s0' "$WORK/r_resp.html" || { echo "LOGIN=failed url=$URL"; exit 5; }
echo "LOGIN=ok user=$USER_ID url=$URL"
