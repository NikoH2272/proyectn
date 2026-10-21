# Paso a producción · pumasgaming.com

El sitio se publica solo con GitHub Pages cuando se sube a `main` (repo `NikoH2272/pumasgaming`, dominio en `CNAME`).
**La base de datos (Supabase) es la misma en local y en producción**, así que los SQL ya ejecutados aplican a las dos.

---

## 1. Antes de subir: base de datos

Corre en Supabase → SQL Editor los SQL que falten, **en orden** (marca ☑ en `sql/README.md`):

| # | Archivo | Imprescindible para |
|---|---------|---------------------|
| 01–05 | Login, roles, usuarios, reparación de funciones | Login de todos los admins |
| 06 | Dragon Fest | Portales Dragon Fest |
| 07–08 | Entrenos LATAM (con Pumas) | Sección LATAM y `/entrenoslatam/` |
| 09 | Guardar y corregir entrenos | Botón "Cargar a la base de datos" y página Corregir entrenos |
| 10 | ZMF femenino | Portal ZMF femenino y su guardado |
| 11 | Links de grupos | Opcional: los links ya vienen en el código; esto los deja editables en la base |
| 12 | Optimizar LATAM + respaldo | Muy recomendado: baja el consumo de datos del plan gratis y activa el botón **Generar respaldo** del panel |
| 13 | Histórico ordenable | Botón PR / PG del histórico (sin él también funciona, calculando en el navegador) |
| 14 | Top killers | Mínimo 3 salas y top 10 por kills totales (sin él, la tabla por kills muestra solo 5) |
| 15 | Top Booyah | Destacado de equipos con más booyahs (sin él se calcula con el histórico) |
| 16 | Ordenar por PR / PG / KILLS | Orden exacto del Top 50 y del Histórico (sin él, el Top 50 se reordena con lo que ya llegó) |

Comprobaciones rápidas en Supabase:
- [ ] `select usuario, rol, activo from usuarios_admin;` → cada admin con su rol; **coachniko = superadmin**.
- [ ] Ninguna contraseña quedó como `CAMBIAR_CLAVE_...` (si dudas, cámbiala desde el panel **Usuarios y roles**).
- [ ] `select id, latam, orden, link from portales order by orden;` → links de los grupos cargados (columna `link`).

## 2. Antes de subir: archivos

- [ ] Logos y mascotas en `<portal>/imagenes/` (lista en `docs/TRABAJO_EN_PARALELO.md`).
- [ ] Fondos de ZMF: `zmf/imagenes/fondozmf.png` y `fondozmffem.png` (800×1000).
- [ ] Opcional: `entrenoslatam/imagenes/latam.png` (logo de Entrenos LATAM).
- [ ] Prueba local con `python -m http.server 5173` y revisa la lista del punto 4.

> **Ojo:** al subir se borran del sitio las carpetas viejas `ascensos/`, `ascensosnova/`, `lucksquad/`, `maya/` y `procesador/` (ya están borradas en tu copia local). Si alguien tiene esos enlaces guardados, dejarán de funcionar.

## 3. Subir

```bash
git checkout -b nico/portales-latam
```

```bash
git add -A
```

```bash
git commit -m "Portales por entreno, Entrenos LATAM, roles y guardado en Supabase"
```

```bash
git push -u origin nico/portales-latam
```

Luego crea el Pull Request a `main` en GitHub y únelo. GitHub Pages publica en 1–3 minutos.

> Si prefieres subir directo a `main`: `git checkout main`, `git add -A`, `git commit -m "..."`, `git push`.

**Caché:** los CSS/JS llevan `?v=AAAAMMDDx` en el HTML. Si cambias un archivo del kit, sube también esa versión en los HTML para que los navegadores no usen la copia vieja. Para revisar después de publicar: **Ctrl+F5**.

## 4. Después de subir: revisar en pumasgaming.com

- [ ] `/` → Entrenamientos (últimos 3), **Entrenos LATAM** (6 tarjetas, botones Portal/Unirse/Instagram), **Rankings Pumas** (PR y KDA) y **Rankings LATAM** (tocar un equipo muestra su %).
- [ ] `/entrenoslatam/` → cifras, Top 50 semana, Top 100 histórico, killers, calendario, destacados y tablas por entreno.
- [ ] `/admin/login.html` con **coachniko** → ve Usuarios y roles, Corregir entrenos y Personalizar.
- [ ] Con **adminrow** → entra directo a `/row/admin.html` y no ve los otros portales.
- [ ] En una herramienta: subir logs → generar tabla → **Cargar a la base de datos** → confirmar → aparece en el portal y en Entrenos LATAM.
- [ ] En **Corregir entrenos**: borrar ese entreno de prueba.
- [ ] En celular: menú, portada y tablas sin scroll horizontal.

## 5. Respaldo

En el plan gratis de Supabase no hay copias automáticas descargables. Entra como **coachniko** → panel `/admin/` → **Respaldo → Generar respaldo** y guarda el `.json` (por ejemplo, cada semana y antes de cambios grandes). No incluye contraseñas ni los archivos de logs del storage.

## 6. Si algo sale mal

- **Volver a la versión anterior del sitio:** en GitHub → el commit → *Revert*, o:

```bash
git revert HEAD
```

```bash
git push
```

- **Un admin no puede entrar o no ve lo suyo:** panel **Usuarios y roles** (coachniko) o `sql/04_corregir_usuarios.sql`; si falta el rol en la sesión, `sql/05_reparar_funciones.sql`.
- **Un entreno se cargó mal:** **Corregir entrenos** → borrar y volver a cargar.

## Límites conocidos

- Las páginas son estáticas: la protección de las herramientas es en el navegador, pero **toda escritura** se valida en la base (sesión + permiso del rol).
- La llave de Supabase en el código es la pública (`anon`); es normal que sea visible.
- Por ahora se guardan los **resultados**, no los archivos de log (para no gastar espacio).
- La página de entrenamientos de Pumas calcula desde sus logs en storage: corregir un nombre de Pumas se ve en LATAM, no en esa página.
