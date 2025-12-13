#!/usr/bin/env python3
"""
Import Keycloak realm via Admin API
"""
import json
import requests
import sys

KEYCLOAK_URL = "http://localhost:8180"
ADMIN_USER = "admin"
ADMIN_PASSWORD = "admin"
REALM_FILE = "infra/keycloak/realm-export.json"

def get_admin_token():
    """Get admin access token"""
    url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    data = {
        "username": ADMIN_USER,
        "password": ADMIN_PASSWORD,
        "grant_type": "password",
        "client_id": "admin-cli"
    }

    response = requests.post(url, data=data)
    if response.status_code != 200:
        print(f"[ERROR] Failed to get admin token: {response.status_code}")
        print(response.text)
        return None

    return response.json()["access_token"]

def create_realm(token, realm_data):
    """Create realm via Admin API"""
    url = f"{KEYCLOAK_URL}/admin/realms"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json=realm_data)

    if response.status_code == 201:
        print(f"[OK] Realm '{realm_data['realm']}' created successfully")
        return True
    elif response.status_code == 409:
        print(f"[WARNING] Realm '{realm_data['realm']}' already exists, attempting update...")
        return update_realm(token, realm_data)
    else:
        print(f"[ERROR] Failed to create realm: {response.status_code}")
        print(response.text)
        return False

def update_realm(token, realm_data):
    """Update existing realm"""
    realm_name = realm_data['realm']
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Remove users and clients from update (handle separately)
    update_data = {k: v for k, v in realm_data.items() if k not in ['users', 'clients', 'roles']}

    response = requests.put(url, headers=headers, json=update_data)

    if response.status_code in [200, 204]:
        print(f"[OK] Realm '{realm_name}' updated successfully")

        # Create roles
        create_roles(token, realm_name, realm_data.get('roles', {}).get('realm', []))

        # Create clients
        create_clients(token, realm_name, realm_data.get('clients', []))

        # Create users
        create_users(token, realm_name, realm_data.get('users', []))

        return True
    else:
        print(f"[ERROR] Failed to update realm: {response.status_code}")
        print(response.text)
        return False

def create_roles(token, realm_name, roles):
    """Create realm roles"""
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/roles"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    for role in roles:
        role_data = {
            "name": role["name"],
            "description": role.get("description", ""),
            "composite": role.get("composite", False),
            "attributes": role.get("attributes", {})
        }

        response = requests.post(url, headers=headers, json=role_data)
        if response.status_code == 201:
            print(f"[OK] Role '{role['name']}' created")
        elif response.status_code == 409:
            print(f"[INFO] Role '{role['name']}' already exists")
        else:
            print(f"[WARNING] Failed to create role '{role['name']}': {response.status_code}")

def create_clients(token, realm_name, clients):
    """Create clients"""
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/clients"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    for client in clients:
        response = requests.post(url, headers=headers, json=client)
        if response.status_code == 201:
            print(f"[OK] Client '{client['clientId']}' created")
        elif response.status_code == 409:
            print(f"[INFO] Client '{client['clientId']}' already exists")
        else:
            print(f"[WARNING] Failed to create client '{client['clientId']}': {response.status_code}")

def create_users(token, realm_name, users):
    """Create users"""
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/users"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    for user in users:
        # Extract credentials and realm roles
        credentials = user.pop("credentials", [])
        realm_roles = user.pop("realmRoles", [])

        # Create user
        response = requests.post(url, headers=headers, json=user)

        if response.status_code == 201:
            print(f"[OK] User '{user['username']}' created")

            # Get user ID from Location header
            user_id = response.headers.get("Location", "").split("/")[-1]

            # Set password
            if credentials and user_id:
                set_password(token, realm_name, user_id, credentials[0])

            # Assign roles
            if realm_roles and user_id:
                assign_roles(token, realm_name, user_id, realm_roles)

        elif response.status_code == 409:
            print(f"[INFO] User '{user['username']}' already exists")
        else:
            print(f"[WARNING] Failed to create user '{user['username']}': {response.status_code}")
            print(response.text)

def set_password(token, realm_name, user_id, credential):
    """Set user password"""
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/users/{user_id}/reset-password"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    password_data = {
        "type": "password",
        "value": credential["value"],
        "temporary": credential.get("temporary", False)
    }

    response = requests.put(url, headers=headers, json=password_data)
    if response.status_code == 204:
        print(f"[OK] Password set for user {user_id}")
    else:
        print(f"[WARNING] Failed to set password: {response.status_code}")

def assign_roles(token, realm_name, user_id, role_names):
    """Assign realm roles to user"""
    # Get available roles
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/roles"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"[WARNING] Failed to get roles: {response.status_code}")
        return

    available_roles = response.json()
    role_map = {role["name"]: role for role in available_roles}

    # Build roles to assign
    roles_to_assign = []
    for role_name in role_names:
        if role_name in role_map:
            roles_to_assign.append({
                "id": role_map[role_name]["id"],
                "name": role_name
            })

    if not roles_to_assign:
        return

    # Assign roles
    url = f"{KEYCLOAK_URL}/admin/realms/{realm_name}/users/{user_id}/role-mappings/realm"
    response = requests.post(url, headers=headers, json=roles_to_assign)

    if response.status_code == 204:
        print(f"[OK] Roles assigned to user {user_id}: {role_names}")
    else:
        print(f"[WARNING] Failed to assign roles: {response.status_code}")

def main():
    print("=== Keycloak Realm Import ===")

    # Load realm data
    try:
        with open(REALM_FILE, 'r', encoding='utf-8') as f:
            realm_data = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to load realm file: {e}")
        return 1

    print(f"[INFO] Loaded realm: {realm_data['realm']}")

    # Get admin token
    print("[INFO] Authenticating as admin...")
    token = get_admin_token()
    if not token:
        return 1

    print("[OK] Admin token obtained")

    # Create realm
    print("[INFO] Creating/updating realm...")
    if create_realm(token, realm_data):
        print("\n[SUCCESS] Realm import completed!")
        print(f"[INFO] Realm: {realm_data['realm']}")
        print(f"[INFO] Users: {len(realm_data.get('users', []))}")
        print(f"[INFO] Roles: {len(realm_data.get('roles', {}).get('realm', []))}")
        print(f"[INFO] Clients: {len(realm_data.get('clients', []))}")
        return 0
    else:
        print("\n[FAILED] Realm import failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
