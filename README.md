# Capa de Presentación

Dashboard web del Sistema de Monitoreo de Cadena de Frío. HTML + Bootstrap 5 + JavaScript vanilla, servido con nginx en Docker.

## Funcionalidad

- **Login** con JWT contra la API (`/api/auth/login`).
- **Panel de monitoreo**: KPIs (sedes, cámaras, sensores, alertas activas), última temperatura por cámara con validación contra el rango permitido, y alertas activas con opción de resolverlas.
- Refresco automático cada 30 segundos.

## Estructura

```
├── Dockerfile           # nginx:alpine sirviendo /public
├── nginx.conf
├── docker-compose.yml   # expone http://localhost:8080
└── public/
    ├── login.html
    ├── index.html       # dashboard
    ├── css/             # bootstrap.min.css (local) + styles.css
    └── js/              # api.js, login.js, dashboard.js, bootstrap.bundle.min.js
```

Bootstrap está incluido localmente (sin CDN) para que funcione sin acceso a internet.

## Ejecutar

Desde la raíz del proyecto (levanta las tres capas):

```bash
docker-compose up -d
```

| Servicio | URL |
|---|---|
| Dashboard | http://localhost:8080 |
| API | http://localhost:3000 |

Credenciales de prueba: `admin@farmacia.com` / `admin123`
