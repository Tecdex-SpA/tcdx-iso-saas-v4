# Frontend con Nginx proxy — laboratorio y producción

## Laboratorio actual

El frontend público del laboratorio no se expone directamente por 8080.

```text
http://192.168.100.130:3000 → Nginx → http://127.0.0.1:8080
```

Next.js corre interno en 8080. Nginx expone 3000 porque el acceso directo a 8080 queda bloqueado fuera de Ubuntu/Next/UFW en el laboratorio.

## Configuración Nginx de laboratorio

Archivo sugerido:

```bash
/etc/nginx/sites-available/tcdx-frontend-compat.conf
```

Contenido:

```nginx
server {
    listen 3000;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Validación:

```bash
sudo nginx -t
sudo systemctl restart nginx
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:8080/login
```

## Producción Oracle Cloud

En OCI, el patrón recomendado será:

```text
https://compliance.tcdx.cl → Nginx 443 → http://127.0.0.1:8080
```

Nginx debe terminar TLS o recibir tráfico desde un balanceador/proxy HTTPS.
