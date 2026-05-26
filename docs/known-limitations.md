# Limitaciones Conocidas

## IA y rendimiento
- Mientras no exista GPU, el modelo recomendado para piloto es `qwen2.5:3b`.
- Modelos mayores pueden tardar demasiado y deben usarse sólo en batch controlado.
- La IA no reemplaza revisión humana ni auditoría formal.
- Si el tenant no tiene IA habilitada, el sistema debe operar en modo determinístico sin llamar ai-engine.

## Datos internos
- La calidad del diagnóstico depende de normas activas, Perfil Empresa, controles, KPIs y evidencias reales.
- Sin evidencia interna suficiente, el sistema no debe afirmar cumplimiento.
- Referencias Brave/web son apoyo contextual, no evidencia interna.

## Aplicabilidad
- El universo aplicable depende del Perfil Empresa y de normas activas.
- Si el perfil está incompleto, pueden existir recomendaciones o exclusiones conservadoras.
- Rebuilds deben validarse en pilotos con clientes reales para ajustar reglas por industria.

## Operación
- Piloto recomendado con acompañamiento.
- No se declara apto para autoservicio masivo hasta tener monitoreo, alertas, restore ensayado, soporte y onboarding autoservicio.
- Algunos módulos conservan compatibilidad legacy interna para no romper datos históricos.

## Frontend y UX
- El sistema oculta IA para tenants sin plan IA, pero el backend sigue siendo la fuente de verdad.
- Warnings de lint frontend preexistentes no bloquean build, pero conviene reducir deuda antes de escalar equipo.

