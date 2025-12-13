#!/usr/bin/env python3
"""Simple auth test script"""
import requests
import json

# 1. Get token for alice.viewer
print("=== Testing TEP-05 Authentication ===\n")
print("[1/3] Getting token for alice.viewer...")
token_response = requests.post(
    "http://localhost:8180/realms/ekg/protocol/openid-connect/token",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    data={
        "client_id": "postman",
        "username": "alice.viewer",
        "password": "viewer123",
        "grant_type": "password"
    }
)

if token_response.status_code != 200:
    print(f"[FAIL] Login failed: {token_response.status_code}")
    print(token_response.text)
    exit(1)

token = token_response.json()["access_token"]
print(f"[OK] Token obtained (length: {len(token)})")

# 2. Test GET /ekg/persons
print("\n[2/3] Testing GET /ekg/persons...")
persons_response = requests.get(
    "http://localhost:3000/ekg/persons",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Status Code: {persons_response.status_code}")
if persons_response.status_code == 200:
    data = persons_response.json()
    print(f"[OK] alice.viewer can read persons!")
    print(f"User roles: {data.get('meta', {}).get('user', {}).get('roles')}")
    print(f"User clearance: {data.get('meta', {}).get('user', {}).get('clearance')}")
elif persons_response.status_code == 401:
    print(f"[FAIL] Still 401 Unauthorized")
    print(f"Response: {persons_response.text}")
else:
    print(f"[FAIL] Unexpected status: {persons_response.status_code}")
    print(f"Response: {persons_response.text}")

# 3. Test GET /ekg/quarantine (should be 403)
print("\n[3/3] Testing GET /ekg/quarantine (expect 403)...")
quarantine_response = requests.get(
    "http://localhost:3000/ekg/quarantine",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Status Code: {quarantine_response.status_code}")
if quarantine_response.status_code == 403:
    print(f"[OK] alice.viewer correctly denied quarantine access (RBAC working!)")
elif quarantine_response.status_code == 401:
    print(f"[FAIL] Still 401 (auth not working)")
else:
    print(f"[INFO] Unexpected status: {quarantine_response.status_code}")
    print(f"Response: {quarantine_response.text[:200]}")

print("\n=== Test Complete ===")
