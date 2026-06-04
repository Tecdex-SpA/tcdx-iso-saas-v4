# Deduplication and Versioning Rules

## Default Rule

The main library shows only the latest active document version by default.

## Document Key

The backend derives a `document_key` from:

- source type;
- provider;
- provider file ID;
- checksum when available;
- normalized filename/path fallback.

Formal evidence rows use their evidence ID as a safe key.

## Versions

Older versions/copies are not deleted. They are available in the detail panel under `Versiones`.

## No Destructive Cleanup

Sprint 3.5 does not delete duplicate records or rewrite historical index data.

