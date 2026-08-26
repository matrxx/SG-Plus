#!/usr/bin/env bash

set -e

CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"

sudo mkdir -p "$CERT_DIR" "$KEY_DIR"

sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$KEY_DIR/portail.key" \
  -out "$CERT_DIR/portail.crt" \
  -subj "/C=FR/O=C2RMF/CN=portail.mon-entreprise.com"

sudo chmod 600 "$KEY_DIR/portail.key"

echo "Certificat créé :"
echo "$CERT_DIR/portail.crt"
echo "$KEY_DIR/portail.key"
