# Fase 4 - Runbook operativo

1. Confirmar rama y SHA del release.
2. Configurar `MIGRATION_DATABASE_URL` administrativa sin imprimirla.
3. Ejecutar `npm run phase4:migration:preflight`.
4. Ejecutar `npm run phase4:migration:apply`.
5. Ejecutar deploy oficial solo después del merge mediante `./scripts/deploy-vms.sh`.
6. Verificar `/api/me/entitlements` con tenant autorizado.
7. Entrar a `/admin-saas`, pestaña Comercial.
8. Revisar plan, capabilities, límites, salud, packs, metodologías y papeles de trabajo.
9. Probar preview de cambio antes de aplicar cualquier cambio comercial.
10. Registrar evidencia en `docs/product/fase-4-closeout.md`.

No usar datos reales de clientes como fixture ni publicar precios definitivos en esta fase.
