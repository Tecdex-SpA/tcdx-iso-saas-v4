# Permission Catalog Gap

Runtime active permission keys: 121
Catalog permission keys from baseline/migrations including this closeout: 203
RUNTIME_MISSING_IN_CATALOG: 0

| permission | group | classification | evidence |
| --- | --- | --- | --- |
| actions.approve | actions | PRESENT_AND_USED | backend/src/routes/action-plans.routes.js:77<br>backend/src/routes/action-plans.routes.js:77 |
| actions.delete | actions | PRESENT_AND_USED | backend/src/routes/action-plans.routes.js:81<br>backend/src/routes/action-plans.routes.js:81 |
| actions.manage | actions | PRESENT_AND_USED | backend/src/routes/action-plans.routes.js:73<br>backend/src/routes/action-plans.routes.js:73<br>backend/src/routes/ai.routes.js:19 |
| actions.view | actions | PRESENT_AND_USED | backend/src/routes/action-plans.routes.js:69<br>backend/src/routes/action-plans.routes.js:69<br>backend/src/routes/iso-operational-execution.routes.js:7 |
| admin_saas.manage | admin_saas | PRESENT_UNUSED |  |
| admin_saas.view | admin_saas | PRESENT_UNUSED |  |
| admin.directory.group.readonly | admin | PRESENT_UNUSED |  |
| admin.directory.user.readonly | admin | PRESENT_UNUSED |  |
| ai.auditor | ai | PRESENT_UNUSED |  |
| ai.compliance | ai | PRESENT_UNUSED |  |
| ai.view | ai | PRESENT_AND_USED | backend/src/app.js:397<br>backend/src/app.js:399<br>backend/src/app.js:397 |
| assets.manage | assets | PRESENT_UNUSED |  |
| assets.view | assets | PRESENT_UNUSED |  |
| assurance_tests.read | assurance_tests | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:38 |
| audit.plan.manage | audit | PRESENT_AND_USED | backend/src/routes/grc.routes.js:109<br>backend/src/routes/grc.routes.js:110<br>backend/src/routes/grc.routes.js:112 |
| audit.plan.read | audit | PRESENT_AND_USED | backend/src/routes/grc.routes.js:108<br>backend/src/routes/grc.routes.js:111<br>backend/src/routes/grc.routes.js:108 |
| audit.report.generate | audit | PRESENT_UNUSED |  |
| audit.review | audit | PRESENT_AND_USED | backend/src/app.js:356<br>backend/src/app.js:356<br>backend/src/routes/grc.routes.js:114 |
| audit.workpaper.manage | audit | PRESENT_AND_USED | backend/src/routes/grc.routes.js:116<br>backend/src/routes/grc.routes.js:117<br>backend/src/routes/grc.routes.js:118 |
| audits.manage | audits | PRESENT_UNUSED |  |
| audits.view | audits | PRESENT_UNUSED |  |
| bia.approve | bia | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:214 |
| bia.manage | bia | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:389<br>backend/src/routes/phase3.routes.js:394<br>backend/src/routes/phase3.routes.js:405 |
| bia.read | bia | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:384<br>backend/src/routes/phase3.routes.js:386<br>scripts/rbac02/build-rbac02-route-matrix.js:24 |
| commercial.catalog.manage | commercial | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:115 |
| commercial.catalog.read | commercial | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:109 |
| commercial.entitlement.manage | commercial | PRESENT_UNUSED |  |
| commercial.entitlement.override | commercial | PRESENT_UNUSED |  |
| commercial.entitlement.read | commercial | PRESENT_UNUSED |  |
| commercial.health.read | commercial | PRESENT_UNUSED |  |
| commercial.methodology.manage | commercial | PRESENT_UNUSED |  |
| commercial.methodology.read | commercial | PRESENT_UNUSED |  |
| commercial.pack.install | commercial | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:145 |
| commercial.pack.manage | commercial | PRESENT_UNUSED |  |
| commercial.pack.read | commercial | PRESENT_UNUSED |  |
| commercial.plan.manage | commercial | PRESENT_UNUSED |  |
| commercial.plan.read | commercial | PRESENT_UNUSED |  |
| commercial.subscription.manage | commercial | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:127<br>backend/src/middleware/rbac.middleware.js:133<br>backend/src/middleware/rbac.middleware.js:139 |
| commercial.subscription.read | commercial | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:121<br>scripts/rbac02/build-rbac02-route-matrix.js:44 |
| commercial.trial.manage | commercial | PRESENT_UNUSED |  |
| commercial.usage.read | commercial | PRESENT_UNUSED |  |
| commercial.workpaper.manage | commercial | PRESENT_UNUSED |  |
| commercial.workpaper.read | commercial | PRESENT_UNUSED |  |
| connectors.credentials.manage | connectors | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:167<br>backend/src/routes/phase2.routes.js:164<br>backend/src/routes/phase2.routes.js:166 |
| connectors.logs.read | connectors | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:162<br>backend/src/routes/phase2.routes.js:162 |
| connectors.manage | connectors | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:164<br>backend/src/routes/phase2.routes.js:166 |
| connectors.read | connectors | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:160<br>backend/src/routes/phase2.routes.js:161<br>backend/src/routes/phase2.routes.js:163 |
| connectors.sync.run | connectors | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:168<br>backend/src/routes/phase2.routes.js:173<br>backend/src/routes/phase2.routes.js:168 |
| continuity.activate | continuity | PRESENT_UNUSED |  |
| continuity.approve | continuity | PRESENT_UNUSED |  |
| continuity.manage | continuity | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:426<br>backend/src/routes/phase3.routes.js:431<br>backend/src/routes/phase3.routes.js:428 |
| continuity.read | continuity | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:286<br>backend/src/routes/phase3.routes.js:421<br>backend/src/routes/phase3.routes.js:448 |
| continuity.tests.manage | continuity | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:453<br>backend/src/routes/phase3.routes.js:458<br>backend/src/routes/phase3.routes.js:455 |
| controls.manage | controls | PRESENT_UNUSED |  |
| controls.view | controls | PRESENT_UNUSED |  |
| crisis.manage | crisis | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:480<br>backend/src/routes/phase3.routes.js:485<br>backend/src/routes/phase3.routes.js:501 |
| crisis.read | crisis | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:475<br>backend/src/routes/phase3.routes.js:477 |
| dashboards.read | dashboards | PRESENT_AND_USED | backend/src/services/commercial/entitlementResolver.service.js:148<br>backend/src/services/commercial/entitlementResolver.service.js:148<br>backend/src/services/commercial/entitlementResolver.service.js:148 |
| data.catalog.read | data | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:34 |
| data.governance | data | PRESENT_UNUSED |  |
| data.lineage | data | PRESENT_UNUSED |  |
| data.lineage.read | data | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:135<br>backend/src/routes/phase5.routes.js:139<br>backend/src/routes/phase5.routes.js:135 |
| data.quality.read | data | PRESENT_UNUSED |  |
| data.semantic_layer | data | PRESENT_UNUSED |  |
| dealer.billing.read | dealer | PRESENT_UNUSED |  |
| dealer.clients.view | dealer | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:45 |
| dealer.quotes.manage | dealer | PRESENT_UNUSED |  |
| drive.metadata.readonly | drive | PRESENT_UNUSED |  |
| evidence.request.manage | evidence | PRESENT_AND_USED | backend/src/routes/grc.routes.js:92<br>backend/src/routes/grc.routes.js:94<br>backend/src/routes/grc.routes.js:95 |
| evidence.request.read | evidence | PRESENT_AND_USED | backend/src/routes/grc.routes.js:91<br>backend/src/routes/grc.routes.js:93<br>backend/src/routes/grc.routes.js:91 |
| evidence.review | evidence | PRESENT_AND_USED | backend/src/routes/grc.routes.js:96<br>backend/src/routes/grc.routes.js:97<br>backend/src/routes/grc.routes.js:96 |
| evidences.upload | evidences | PRESENT_UNUSED |  |
| evidences.view | evidences | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:29 |
| findings.manage | findings | PRESENT_UNUSED |  |
| findings.view | findings | PRESENT_UNUSED |  |
| framework.manage | framework | PRESENT_AND_USED | backend/src/routes/grc.routes.js:105<br>backend/src/routes/grc.routes.js:106<br>backend/src/routes/grc.routes.js:105 |
| framework.read | framework | PRESENT_AND_USED | backend/src/routes/grc.routes.js:102<br>backend/src/routes/grc.routes.js:103<br>backend/src/routes/grc.routes.js:104 |
| gap.evaluate | gap | PRESENT_AND_USED | backend/src/routes/grc.routes.js:127<br>backend/src/routes/grc.routes.js:127 |
| gap.link | gap | PRESENT_UNUSED |  |
| gap.manage | gap | PRESENT_UNUSED |  |
| gap.read | gap | PRESENT_AND_USED | backend/src/routes/grc.routes.js:126<br>backend/src/routes/grc.routes.js:128<br>backend/src/routes/grc.routes.js:126 |
| gap.transition | gap | PRESENT_AND_USED | backend/src/routes/grc.routes.js:129<br>backend/src/routes/grc.routes.js:129 |
| grc.connectors.manage | grc | PRESENT_UNUSED |  |
| grc.escalation.manage | grc | PRESENT_AND_USED | backend/src/routes/grc.routes.js:162<br>backend/src/routes/grc.routes.js:162 |
| grc.escalations.manage | grc | PRESENT_UNUSED |  |
| grc.export.generate | grc | PRESENT_AND_USED | backend/src/routes/grc.routes.js:178<br>backend/src/routes/grc.routes.js:196<br>backend/src/routes/grc.routes.js:178 |
| grc.gaps.manage | grc | PRESENT_UNUSED |  |
| grc.phase2.export | grc | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:206<br>backend/src/routes/phase2.routes.js:184<br>backend/src/routes/phase2.routes.js:185 |
| grc.runtime.adapter.read | grc | PRESENT_UNUSED |  |
| grc.scheduler.run | grc | PRESENT_AND_USED | backend/src/routes/grc.routes.js:160<br>backend/src/routes/grc.routes.js:160 |
| health.view | health | PRESENT_UNUSED |  |
| imports.catalog.download | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:170 |
| imports.confirm | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:194 |
| imports.errors.download | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:206 |
| imports.history.read | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:182 |
| imports.preview | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:176 |
| imports.read | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:152<br>backend/src/middleware/rbac.middleware.js:158<br>backend/src/middleware/rbac.middleware.js:188 |
| imports.rollback | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:200 |
| imports.template.download | imports | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:164 |
| incidents.close | incidents | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:140<br>backend/src/routes/phase2.routes.js:134<br>backend/src/routes/phase2.routes.js:140 |
| incidents.command | incidents | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:135<br>backend/src/routes/phase2.routes.js:136<br>backend/src/routes/phase2.routes.js:138 |
| incidents.manage | incidents | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:132<br>backend/src/routes/phase2.routes.js:132 |
| incidents.notifications.manage | incidents | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:137<br>backend/src/routes/phase2.routes.js:137 |
| incidents.read | incidents | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:129<br>backend/src/routes/phase2.routes.js:130<br>backend/src/routes/phase2.routes.js:131 |
| iso.actions | iso | PRESENT_UNUSED |  |
| knowledge.ingest | knowledge | PRESENT_UNUSED |  |
| knowledge.rag.answer | knowledge | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:260 |
| knowledge.read | knowledge | PRESENT_UNUSED |  |
| knowledge.retrieval.read | knowledge | PRESENT_AND_USED | backend/src/middleware/rbac.middleware.js:254 |
| loss_events.read | loss_events | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:37 |
| metric.alert | metric | PRESENT_UNUSED |  |
| metric.calculate | metric | PRESENT_UNUSED |  |
| metric.compare | metric | PRESENT_UNUSED |  |
| metric.freshness | metric | PRESENT_UNUSED |  |
| metric.reconcile | metric | PRESENT_UNUSED |  |
| metric.retention | metric | PRESENT_UNUSED |  |
| metric.snapshot | metric | PRESENT_UNUSED |  |
| metrics.actions.propose | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:132 |
| metrics.actions.review | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:133<br>backend/src/routes/phase5.routes.js:134 |
| metrics.catalog | metrics | PRESENT_UNUSED |  |
| metrics.catalog.read | metrics | PRESENT_UNUSED |  |
| metrics.comparisons.read | metrics | PRESENT_UNUSED |  |
| metrics.data_trust | metrics | PRESENT_UNUSED |  |
| metrics.engine | metrics | PRESENT_UNUSED |  |
| metrics.indicators.read | metrics | PRESENT_UNUSED |  |
| metrics.indicators.technical | metrics | PRESENT_UNUSED |  |
| metrics.jobs.run | metrics | PRESENT_UNUSED |  |
| metrics.manage | metrics | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:512<br>backend/src/routes/phase3.routes.js:517<br>backend/src/routes/phase3.routes.js:220 |
| metrics.measure | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:132<br>backend/src/routes/phase5.routes.js:143<br>backend/src/routes/phase5.routes.js:144 |
| metrics.methodology.manage | metrics | PRESENT_UNUSED |  |
| metrics.methodology.publish | metrics | PRESENT_UNUSED |  |
| metrics.methodology.review | metrics | PRESENT_UNUSED |  |
| metrics.publish | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:131<br>backend/src/routes/phase5.routes.js:138<br>backend/src/routes/phase5.routes.js:131 |
| metrics.read | metrics | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:507<br>backend/src/routes/phase3.routes.js:509<br>backend/src/routes/phase5.routes.js:124 |
| metrics.recalculate | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:127<br>backend/src/routes/phase5.routes.js:128<br>backend/src/routes/phase5.routes.js:129 |
| metrics.record | metrics | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:533<br>backend/src/routes/phase3.routes.js:535 |
| metrics.snapshots.publish | metrics | PRESENT_UNUSED |  |
| metrics.validate | metrics | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:133<br>backend/src/routes/phase5.routes.js:134<br>backend/src/routes/phase5.routes.js:137 |
| modules.view | modules | PRESENT_UNUSED |  |
| nonconformities.view | nonconformities | PRESENT_UNUSED |  |
| observation.link | observation | PRESENT_AND_USED | backend/src/routes/grc.routes.js:157<br>backend/src/routes/grc.routes.js:157 |
| observation.manage | observation | PRESENT_AND_USED | backend/src/routes/grc.routes.js:154<br>backend/src/routes/grc.routes.js:155<br>backend/src/routes/grc.routes.js:154 |
| observation.read | observation | PRESENT_AND_USED | backend/src/routes/grc.routes.js:152<br>backend/src/routes/grc.routes.js:153<br>backend/src/routes/grc.routes.js:152 |
| observation.transition | observation | PRESENT_AND_USED | backend/src/routes/grc.routes.js:156<br>backend/src/routes/grc.routes.js:156 |
| operations.360.read | operations | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:231<br>backend/src/routes/phase3.routes.js:275<br>backend/src/routes/phase3.routes.js:324 |
| operations.dashboard.read | operations | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:15<br>backend/src/routes/phase3.routes.js:236<br>backend/src/routes/phase3.routes.js:241 |
| operations.import | operations | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:246<br>backend/src/routes/phase3.routes.js:251<br>backend/src/routes/phase3.routes.js:256 |
| organizations.manage | organizations | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:308<br>backend/src/routes/phase3.routes.js:313<br>backend/src/routes/phase3.routes.js:211 |
| organizations.read | organizations | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:303<br>backend/src/routes/phase3.routes.js:305 |
| pack.install | pack | PRESENT_UNUSED |  |
| plan.publish | plan | PRESENT_UNUSED |  |
| privacy.approve | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:115<br>backend/src/routes/phase2.routes.js:119 |
| privacy.breaches.manage | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:126<br>backend/src/routes/phase2.routes.js:127<br>backend/src/routes/phase2.routes.js:126 |
| privacy.dpia.manage | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:117<br>backend/src/routes/phase2.routes.js:120<br>backend/src/routes/phase2.routes.js:117 |
| privacy.manage | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:105<br>backend/src/routes/phase2.routes.js:112<br>backend/src/routes/phase2.routes.js:113 |
| privacy.read | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:110<br>backend/src/routes/phase2.routes.js:111<br>backend/src/routes/phase2.routes.js:114 |
| privacy.requests.manage | privacy | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:123<br>backend/src/routes/phase2.routes.js:124<br>backend/src/routes/phase2.routes.js:123 |
| processes.approve | processes | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:212 |
| processes.manage | processes | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:292<br>backend/src/routes/phase3.routes.js:297<br>backend/src/routes/phase3.routes.js:335 |
| processes.read | processes | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:330<br>backend/src/routes/phase3.routes.js:332 |
| profile.read | profile | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:42 |
| quantitative_risk.approve | quantitative_risk | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:221 |
| quantitative_risk.manage | quantitative_risk | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:549<br>backend/src/routes/phase3.routes.js:554<br>backend/src/routes/phase3.routes.js:221 |
| quantitative_risk.read | quantitative_risk | PRESENT_AND_USED | backend/src/routes/operational-risks.routes.js:11<br>backend/src/routes/operational-risks.routes.js:11<br>backend/src/routes/phase3.routes.js:544 |
| readiness.generate | readiness | PRESENT_AND_USED | backend/src/routes/grc.routes.js:101<br>backend/src/routes/grc.routes.js:101 |
| readiness.read | readiness | PRESENT_AND_USED | backend/src/routes/grc.routes.js:67<br>backend/src/routes/grc.routes.js:100<br>backend/src/routes/grc.routes.js:67 |
| regulatory.manage | regulatory | PRESENT_UNUSED |  |
| regulatory.read | regulatory | PRESENT_UNUSED |  |
| reports.download | reports | PRESENT_UNUSED |  |
| reports.generate | reports | PRESENT_UNUSED |  |
| reports.read | reports | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:33<br>scripts/rbac02/build-rbac02-route-matrix.js:39 |
| reports.schedule | reports | PRESENT_UNUSED |  |
| reports.view | reports | PRESENT_UNUSED |  |
| risk_matrix.manage | risk_matrix | PRESENT_UNUSED |  |
| risk_matrix.view | risk_matrix | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:30<br>scripts/rbac02/build-rbac02-route-matrix.js:31 |
| semantic_source.validate | semantic_source | PRESENT_UNUSED |  |
| semantic.contracts.manage | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:88<br>backend/src/routes/phase5.routes.js:90<br>backend/src/routes/phase5.routes.js:91 |
| semantic.contracts.publish | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:96<br>backend/src/routes/phase5.routes.js:96 |
| semantic.contracts.read | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:86<br>backend/src/routes/phase5.routes.js:87<br>backend/src/routes/phase5.routes.js:89 |
| semantic.contracts.review | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:94<br>backend/src/routes/phase5.routes.js:95<br>backend/src/routes/phase5.routes.js:94 |
| semantic.lineage.read | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:106<br>backend/src/routes/phase5.routes.js:106 |
| semantic.mappings.manage | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:99<br>backend/src/routes/phase5.routes.js:100<br>backend/src/routes/phase5.routes.js:99 |
| semantic.mappings.read | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:98<br>backend/src/routes/phase5.routes.js:98 |
| semantic.mappings.validate | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:97<br>backend/src/routes/phase5.routes.js:101<br>backend/src/routes/phase5.routes.js:97 |
| semantic.observations.ingest | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:103<br>backend/src/routes/phase5.routes.js:108<br>backend/src/routes/phase5.routes.js:116 |
| semantic.observations.read | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:104<br>backend/src/routes/phase5.routes.js:105<br>backend/src/routes/phase5.routes.js:107 |
| semantic.sufficiency.manage | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:110<br>backend/src/routes/phase5.routes.js:112<br>backend/src/routes/phase5.routes.js:113 |
| semantic.sufficiency.publish | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:114<br>backend/src/routes/phase5.routes.js:114 |
| semantic.sufficiency.read | semantic | PRESENT_AND_USED | backend/src/routes/phase5.routes.js:109<br>backend/src/routes/phase5.routes.js:111<br>backend/src/routes/phase5.routes.js:109 |
| services.manage | services | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:362<br>backend/src/routes/phase3.routes.js:367<br>backend/src/routes/phase3.routes.js:213 |
| services.read | services | PRESENT_AND_USED | backend/src/routes/phase3.routes.js:357<br>backend/src/routes/phase3.routes.js:359 |
| standards.manage | standards | PRESENT_UNUSED |  |
| standards.view | standards | PRESENT_UNUSED |  |
| suppliers.approve | suppliers | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:147<br>backend/src/routes/phase2.routes.js:157 |
| suppliers.assess | suppliers | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:152<br>backend/src/routes/phase2.routes.js:155<br>backend/src/routes/phase2.routes.js:156 |
| suppliers.manage | suppliers | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:145<br>backend/src/routes/phase2.routes.js:148<br>backend/src/routes/phase2.routes.js:149 |
| suppliers.portal.manage | suppliers | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:158<br>backend/src/routes/phase2.routes.js:158 |
| suppliers.read | suppliers | PRESENT_AND_USED | backend/src/routes/phase2.routes.js:142<br>backend/src/routes/phase2.routes.js:143<br>backend/src/routes/phase2.routes.js:144 |
| surveys.read | surveys | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:36 |
| users.manage | users | PRESENT_AND_USED | scripts/rbac02/build-rbac02-route-matrix.js:43 |
| workflow.manage | workflow | PRESENT_AND_USED | backend/src/routes/grc.routes.js:68<br>backend/src/routes/grc.routes.js:69<br>backend/src/routes/grc.routes.js:74 |
| workflow.read | workflow | PRESENT_AND_USED | backend/src/routes/grc.routes.js:76<br>backend/src/routes/grc.routes.js:79<br>backend/src/routes/grc.routes.js:80 |
| workflow.transition | workflow | PRESENT_AND_USED | backend/src/routes/grc.routes.js:85<br>backend/src/routes/grc.routes.js:87<br>backend/src/routes/grc.routes.js:88 |
