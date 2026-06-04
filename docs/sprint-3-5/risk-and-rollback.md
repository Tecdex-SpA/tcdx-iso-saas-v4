# Risk and Rollback

## Risks

- Migration must be applied before the new UI is fully useful.
- Some legacy tables have inconsistent column sets; target candidate queries fall back safely when a table/column is unavailable.
- Semantic matching is deterministic and initial. It is not a semantic search engine.
- Existing source connectors remain unchanged.

## Rollback

Code rollback:

```bash
git revert -m 1 <MERGE_COMMIT_HASH>
./scripts/deploy-vms.sh
```

If merged as a normal commit:

```bash
git revert <COMMIT_HASH>
./scripts/deploy-vms.sh
```

DB rollback:

- Do not drop new tables automatically.
- Revert code and leave new tables unused.
- Drop objects only with DBA/product approval after backup.

