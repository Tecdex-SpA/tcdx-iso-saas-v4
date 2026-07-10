# Operations daily checklist

## Objetivo

Checklist diario minimo para operar pilotos Credex y Tecdex.

## Checklist

- [ ] Public HTTPS:

```bash
curl -I https://tcdx-iso.tecdex.net
```

- [ ] Backend service:

```bash
ssh tecdex@192.168.2.41
sudo systemctl status tecdx-backend.service --no-pager -l
curl -s -i http://localhost:3000/api/health
```

- [ ] Frontend/Nginx:

```bash
ssh tecdex@192.168.2.43
sudo nginx -t
sudo systemctl status nginx --no-pager -l
curl -I http://localhost
```

- [ ] DB readiness:

```bash
ssh tecdex@192.168.2.40
pg_isready
psql -d tecdx_saas -c "select 1;"
```

- [ ] AI Engine health or degraded:

```bash
ssh tecdex@192.168.2.44
curl -s http://localhost:8001/health
sudo systemctl status ai-engine.service --no-pager -l
```

- [ ] Ultimo backup:

```bash
ls -lh /tmp/tcdx-backups 2>/dev/null || true
```

- [ ] Errores backend recientes:

```bash
sudo journalctl -u tecdex-backend.service -n 200 --no-pager
```

- [ ] Disco basico:

```bash
df -h
```

- [ ] Certificado TLS publico:

```bash
curl -Iv https://tcdx-iso.tecdex.net 2>&1 | grep -Ei "expire|issuer|subject|SSL connection" || true
```

## Criterio diario

- SaaS operativo: publico HTTPS, backend, frontend y DB OK.
- SaaS degradado: AI Engine falla pero backend mantiene fallback y flujos
  criticos funcionan.
- SaaS caido: publico HTTPS, backend, frontend o DB falla de forma sostenida.

Registrar desviaciones en el log de incidentes o deploy segun corresponda.
