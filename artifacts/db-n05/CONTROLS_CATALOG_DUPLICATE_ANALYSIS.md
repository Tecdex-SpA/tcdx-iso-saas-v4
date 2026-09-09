# DB-N05 controls_catalog duplicate analysis

Source SHA-256: `5ebe8c04225bbe19a0f5b4a56b648af8fc43019f0195b8854384a4bbbf9c3ab0`. Immutable source: `artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt`.

All 16 groups are excluded from the versioned loader. Semantic identity is (standard_code, version_code, control_code) from iso_controls. QA UUIDs below are evidence references only. No rows deleted, merged or selected arbitrarily.

| Standard | Clause | Rows | Classification | Evidence / decision |
| --- | --- | ---: | --- | --- |
| ISO27001 | 1 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 4 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 5 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 6 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 7 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 8 | 5 | REQUIRES_MANUAL_REVIEW | 5 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | 9 | 11 | REQUIRES_MANUAL_REVIEW | 11 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO27001 | GENERAL | 12 | REQUIRES_MANUAL_REVIEW | 12 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 1 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 4 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 5 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 6 | 4 | REQUIRES_MANUAL_REVIEW | 4 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 7 | 5 | REQUIRES_MANUAL_REVIEW | 5 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 8 | 5 | REQUIRES_MANUAL_REVIEW | 5 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | 9 | 9 | REQUIRES_MANUAL_REVIEW | 9 distinct payloads; no version authority; compatibility only, does not block versioned load |
| ISO9001 | GENERAL | 15 | REQUIRES_MANUAL_REVIEW | 15 distinct payloads; no version authority; compatibility only, does not block versioned load |

Distinct descriptions under a reused clause do not establish semantic equivalence. LEGACY_DUPLICATE or COMPATIBILITY_DUPLICATE is not asserted without lineage proving that classification. Manual review applies only to a future legacy migration, not to the present versioned source.

## ISO27001 / 1

- `1d4fe8ec-edc5-49be-9a90-b44eff8744c8`: Define el alcance del sistema de gestión de seguridad de la información (source_type=generic, active=t).
- `3cc182db-77f1-42cb-abf5-bff7389d0c23`: Acciones correctivas (source_type=generic, active=t).
- `ecd01ba2-6eff-42ca-8763-66db394a3c98`: Mejora continua (source_type=generic, active=t).
- `f171ebed-c5e5-4e75-ae33-b99ca46854bf`: Gestión de incidentes (source_type=generic, active=t).

## ISO27001 / 4

- `b561b55f-18b0-41a7-bec8-13dd089977af`: Se identifican interfaces con terceros (source_type=generic, active=t).
- `ce2a2990-1397-4237-b1d9-ad4a44daa635`: Se definen requisitos de seguridad (source_type=generic, active=t).
- `cf5ac1f4-1046-4aa5-9520-ec0bcd2aafbf`: Se identifican partes interesadas (source_type=generic, active=t).
- `db8f68e8-b2ad-4a4b-91e5-e6bfee706ee1`: Se determina el alcance del SGSI (source_type=generic, active=t).

## ISO27001 / 5

- `11c814cd-eab8-40f1-baa3-fc107c0addc0`: Recursos asignados (source_type=generic, active=t).
- `94dbf6a8-e9dd-4381-8143-7c4e91b1c66a`: Roles definidos (CISO o responsable) (source_type=generic, active=t).
- `d40dca18-a2f9-4d3f-93ab-68d4d8848832`: Existe política de seguridad (source_type=generic, active=t).
- `f99c4524-09ad-4fce-b2c8-09bbe5da6751`: Compromiso de la dirección (source_type=generic, active=t).

## ISO27001 / 6

- `361b92c2-c87a-4315-aab7-94fe193f6599`: Objetivos de seguridad definidos (source_type=generic, active=t).
- `5c7c79e3-db38-4028-846b-377fd5352553`: Riesgos identificados (source_type=generic, active=t).
- `7b0f7218-dbea-4c69-ad78-977a964b277f`: Plan de tratamiento (source_type=generic, active=t).
- `d7a2ed69-1e63-421c-9fe0-6c60e359495a`: Metodología de riesgos definida (source_type=generic, active=t).

## ISO27001 / 7

- `7ad9ff15-c1eb-4c25-b051-f650b020ddad`: Capacitación en seguridad (source_type=generic, active=t).
- `9c364889-d18c-4c7f-b5b9-80f274bbba1b`: Control documental (source_type=generic, active=t).
- `acb49a5a-6cc3-4fb4-8810-8dd443a1940c`: Concientización (phishing) (source_type=generic, active=t).
- `ba7dab13-2b09-47b6-8460-4a616c239946`: Comunicación definida (source_type=generic, active=t).

## ISO27001 / 8

- `3c72fe8e-4584-4b29-add3-dc1d6bf60ba1`: Controles según SoA (source_type=generic, active=t).
- `4ea5d324-dd60-413e-bb80-185ce1799852`: Gestión de cambios (source_type=generic, active=t).
- `8dbb3952-60bb-4541-abb7-89935e500b5e`: Inventario de activos (source_type=generic, active=t).
- `adc07ce9-8281-46a5-88ab-7db6ab83abfb`: Evaluación de riesgos periódica (source_type=generic, active=t).
- `ba3c38f6-34a0-4597-8f0f-a08eb4b85e90`: Proveedores evaluados (source_type=generic, active=t).

## ISO27001 / 9

- `1093e8ed-44d2-47b6-bb98-44bc00b85905`: EDR o antivirus activo (source_type=generic, active=t).
- `1b9d7810-b084-43b3-81ad-c3b7492adf33`: Control de accesos RBAC (source_type=generic, active=t).
- `2070f8f1-5796-4e68-8320-e9688b7f44e3`: MFA implementado (source_type=generic, active=t).
- `6e7f1df2-8def-489c-983c-a1741677df4b`: Backups probados (source_type=generic, active=t).
- `7acdad44-28d2-4c69-ab85-0713dad8b7d9`: Cifrado de datos (source_type=generic, active=t).
- `804654f5-4fe9-4e4f-b1f4-b3b8c25d83ec`: Gestión de vulnerabilidades (source_type=generic, active=t).
- `96cd2a9e-f7a7-41ea-b9f0-003b2b500531`: Monitoreo de seguridad (source_type=generic, active=t).
- `984b450b-f0dd-4c1e-b71c-7d014673dc80`: Logs activos (source_type=generic, active=t).
- `9c925425-7bb7-4149-8290-879509368285`: Revisión dirección (source_type=generic, active=t).
- `da4aa13d-b5a9-4c61-ada0-b4c9389ec3e6`: KPIs definidos (source_type=generic, active=t).
- `ea171534-cba0-4b14-aed1-4aac1cd18794`: Auditorías internas (source_type=generic, active=t).

## ISO27001 / GENERAL

- `02e946e5-01ab-482b-ba8d-725f3508a2f9`: Se controlan dispositivos (source_type=generic, active=t).
- `0d6f78dd-fd45-44ab-8eec-c631c7aa24e4`: Se realizan respaldos (source_type=generic, active=t).
- `1a0541bd-7ce5-454b-930c-671d19d2d08b`: Existe política de seguridad de la información (source_type=generic, active=t).
- `375b2d5e-917b-411f-afa5-c871539d8887`: Se gestionan vulnerabilidades (source_type=generic, active=t).
- `667f9b78-138c-41b3-845b-d8fdfcb725b0`: Se gestionan incidentes (source_type=generic, active=t).
- `67e67e4e-5b0f-49a7-ba96-89b4f34b83cd`: Se gestionan accesos de usuarios (source_type=generic, active=t).
- `6c144c5a-228e-4410-88da-3443b60b10e9`: Se identifican, evalúan, priorizan y tratan vulnerabilidades técnicas que puedan afectar activos, sistemas, servicios o información sensible. (source_type=generic, active=t).
- `6fc96414-f6ba-4346-9c8c-98521ae1291c`: Se cifran datos (source_type=generic, active=t).
- `a8707ef7-3d39-4631-97c0-2b6d16c319b4`: Se monitorean logs (source_type=generic, active=t).
- `adafe2a5-7ac4-42e6-8b1b-898cd298985c`: Se capacita al personal (source_type=generic, active=t).
- `c8fedda5-3837-41ca-ab48-6f6308b29523`: Se controlan accesos físicos a áreas críticas, oficinas, salas técnicas, equipos y ubicaciones donde se procesa o almacena información sensible. (source_type=generic, active=t).
- `ea335994-c2b5-498c-8673-e2510c460c49`: Se realizan auditorías (source_type=generic, active=t).

## ISO9001 / 1

- `2af6acb9-47fb-4a61-bd3b-e44e76e92c45`: Mejora continua (source_type=generic, active=t).
- `48934add-d16a-42f8-84f3-51a507766a5e`: Esta norma especifica requisitos para un sistema de gestión de calidad cuando una organización necesita demostrar su capacidad para proporcionar productos y servicios conformes. (source_type=generic, active=t).
- `bc31ec8c-64fb-42c7-8cd0-eedef5094632`: Acciones correctivas (source_type=generic, active=t).
- `ed1e0845-c6a0-4539-a766-a70448beffdf`: Gestión no conformidades (source_type=generic, active=t).

## ISO9001 / 4

- `a11f69a5-1ebe-40eb-b734-c8753b2e7f17`: Se define el alcance del SGC (source_type=generic, active=t).
- `da3c7271-4c2c-4e52-8e85-e060a96963ba`: Se determinan necesidades y expectativas (source_type=generic, active=t).
- `e9ea963e-3a7c-4714-b88c-f0003e896f8e`: Se documentan procesos e interacción (source_type=generic, active=t).
- `f9cadf35-c435-476a-bcd5-afebe36defb2`: Se identifican partes interesadas (source_type=generic, active=t).

## ISO9001 / 5

- `52d8a76a-a643-43ec-8a3f-c0bf64cbdf68`: Enfoque al cliente (source_type=generic, active=t).
- `a698cc97-f5ba-4e17-a701-8e71d0b055f7`: Existe política de calidad (source_type=generic, active=t).
- `e5cb4eea-b780-4201-8e6f-f48c59727e16`: Roles definidos (source_type=generic, active=t).
- `f008d7d3-1b6b-40fc-9d6d-f5b7b1e0b024`: Alta dirección comprometida (source_type=generic, active=t).

## ISO9001 / 6

- `066bb312-339f-422d-9cb1-94faaf29ed73`: Objetivos de calidad (source_type=generic, active=t).
- `06d0dc9d-7229-4643-b0e5-81419e14f533`: Control de cambios (source_type=generic, active=t).
- `aa11563a-75b7-42e1-a450-2fb70ed00c1e`: Acciones para riesgos (source_type=generic, active=t).
- `d9c6a0f8-a80b-4080-9b8f-46cfbdbcfc1b`: Identificación de riesgos (source_type=generic, active=t).

## ISO9001 / 7

- `0122ea5a-900e-4a44-a593-fc3ea2fcd4a7`: Recursos disponibles (source_type=generic, active=t).
- `2d705f4d-effc-4f24-8d64-e89e6d4c9d7a`: Competencias evaluadas (source_type=generic, active=t).
- `6551859f-fbab-4321-9a76-3f52891268ef`: Control documental (source_type=generic, active=t).
- `71e45de6-b5af-480b-8d68-c8f458e286ed`: Capacitación (source_type=generic, active=t).
- `c1dcfe75-d457-42fc-a160-53353313f5d6`: Comunicación interna (source_type=generic, active=t).

## ISO9001 / 8

- `79d42314-46fa-4506-bc8c-f3b2f9a48d1e`: Control proveedores (source_type=generic, active=t).
- `c41e97c6-83b4-446a-849e-5621cf40b59e`: Trazabilidad (source_type=generic, active=t).
- `c65ddca8-b85e-4936-ae3d-cc01aa4f14e9`: Control operacional (source_type=generic, active=t).
- `da75ae52-b948-4ddb-a6f0-590d6ad77a1e`: Revisión requisitos cliente (source_type=generic, active=t).
- `f649bac8-9ef4-4435-bf39-27c58b1721d1`: Control no conformidades (source_type=generic, active=t).

## ISO9001 / 9

- `1157f515-8aff-4675-b0ba-6816468eb446`: Enfoque basado en procesos (source_type=generic, active=t).
- `34a2c0fc-332c-43a3-b5de-aba7acdb4dc0`: Auditorías internas (source_type=generic, active=t).
- `34a50a3e-f251-4725-932e-db238ebe1ceb`: Revisión dirección (source_type=generic, active=t).
- `3f627eed-3bdc-45ae-a5f0-7d119a8f5f8c`: Enfoque basado en riesgos (source_type=generic, active=t).
- `4c5a970c-0859-475f-9152-8ea2d5c0c259`: Monitoreo procesos (source_type=generic, active=t).
- `8a599d11-6778-4a29-84fd-5247c99e5be1`: Evidencia objetiva (source_type=generic, active=t).
- `a411fb6d-da76-4954-8b44-b3654c3d4a8b`: KPIs definidos (source_type=generic, active=t).
- `b38c25ff-daee-4491-a605-d944f9f2151b`: Trazabilidad documental (source_type=generic, active=t).
- `fddbe69a-0587-4af5-94da-e366f35bcc40`: Satisfacción cliente (source_type=generic, active=t).

## ISO9001 / GENERAL

- `16c2a525-fdde-479d-8af7-198e994fc9fa`: Procesos documentados (source_type=generic, active=t).
- `240cced0-85d8-486a-8663-74791eeb4d66`: Gestión de reclamos (source_type=generic, active=t).
- `2b133239-0722-4e27-8749-df79b2d9bb25`: Se controlan proveedores (source_type=generic, active=t).
- `34193a55-96cd-4a45-ba89-2758de180651`: Se gestionan riesgos (source_type=generic, active=t).
- `7e3a35db-9278-48a5-b794-12845818af37`: Medición de satisfacción del cliente (source_type=generic, active=t).
- `87b594af-023f-4b73-a8bf-91beb8badb79`: Se mide satisfacción del cliente (source_type=generic, active=t).
- `93653d60-e557-4bae-b895-89e1280e519d`: Se definen responsabilidades (source_type=generic, active=t).
- `bf78de00-aef4-46e4-a83a-27bcdfa80027`: Se documentan procesos (source_type=generic, active=t).
- `c0546d55-9899-4c23-92b4-443cd60a6102`: Mejora continua (source_type=generic, active=t).
- `c9a9a442-c504-445d-ae76-f80129815b67`: Se mejora continuamente (source_type=generic, active=t).
- `d00a7109-f863-415d-b406-def59be20b87`: Existe política de calidad (source_type=generic, active=t).
- `d0c2e03d-46f8-4014-9192-02f202a81b74`: Indicadores definidos (source_type=generic, active=t).
- `d5f33396-31ce-40ab-aa3d-c0abd43af216`: Se realizan auditorías internas (source_type=generic, active=t).
- `db6b6615-a3c6-4588-a80d-7f0b2257d89c`: Se controlan procesos (source_type=generic, active=t).
- `fae19968-c66b-4e09-a2bd-d14cb6a82584`: Se gestionan no conformidades (source_type=generic, active=t).
