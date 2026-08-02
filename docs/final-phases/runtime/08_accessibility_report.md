# Informe de accesibilidad de 5-C1

Método: Axe Core 4.12.1 inyectado por Playwright sobre DOM renderizado, reglas WCAG 2 A y AA.

Rutas evaluadas: `/login`, `/grc`, `/metricas`, `/bi`, `/reportes/studio`.

Resultado final: cero violaciones `critical` y cero violaciones `serious` en las rutas evaluadas.

Hallazgos corregidos durante la ejecución:

- Contraste insuficiente de texto blanco en naranja y teal, y texto secundario sobre superficie gris.
- Región con scroll de historial/bitácora no accesible por teclado.

La prueba se ejecuta en navegador real. La auditoría de todas las rutas, lectores de pantalla con usuarios, y pruebas en producción queda asignada a 5-C11; no se afirma como validada en esta baseline.
