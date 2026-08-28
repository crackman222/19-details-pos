// Login handles: lowercase letters, digits and dots only, at least 3
// characters. Kept in step with the validation in the create-worker Edge
// Function — the browser check is only there to catch a typo before the
// round trip, the server's is the one that counts.
export const USERNAME_PATTERN = /^[a-z0-9.]{3,}$/

export function isValidUsername(value) {
  return USERNAME_PATTERN.test((value ?? '').trim().toLowerCase())
}

// Suggests a handle from a person's name — "Mr. Washee Washee" becomes
// "mr.washee.washee". Only ever a starting point: the field stays editable,
// and once set the handle is fixed (it's the local part of the account's
// auth email), so a name change never rewrites it.
export function suggestUsername(fullName) {
  return (fullName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
}
