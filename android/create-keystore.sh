#!/bin/bash
# Lovia Android 릴리즈 키스토어 생성 스크립트
# 최초 1회만 실행 — 생성된 .jks 파일을 안전하게 보관하세요

set -e

KEYSTORE_FILE="lovia-release.jks"
KEY_ALIAS="lovia-key"
VALIDITY_DAYS=10000

echo "=== Lovia Android 릴리즈 키스토어 생성 ==="
echo ""
echo "키스토어 파일: $KEYSTORE_FILE"
echo "키 별칭: $KEY_ALIAS"
echo "유효기간: ${VALIDITY_DAYS}일 (약 27년)"
echo ""
echo "⚠️  생성된 키스토어(.jks) 파일은 안전한 곳에 백업하세요."
echo "⚠️  분실 시 앱 업데이트가 불가능합니다."
echo ""

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity $VALIDITY_DAYS \
  -dname "CN=Lovia, OU=Mobile, O=Lovia Inc, L=Seoul, S=Seoul, C=KR"

echo ""
echo "✅ 키스토어 생성 완료: $KEYSTORE_FILE"
echo ""
echo "다음 단계:"
echo "1. keystore.properties.example 을 복사하여 keystore.properties 생성"
echo "2. keystore.properties 에 생성한 키스토어 경로와 비밀번호 입력"
echo "3. keystore.properties 를 .gitignore 에 추가 확인"
echo "4. $KEYSTORE_FILE 를 안전한 곳에 백업"
