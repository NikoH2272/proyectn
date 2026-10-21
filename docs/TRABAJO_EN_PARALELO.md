# Cómo trabajamos en paralelo (Nico + Claude)

## Quién es dueño de qué

Cada portal vive en su carpeta y no depende de los otros. Así podemos trabajar al mismo tiempo sin pisarnos.

| Carpeta | Qué es | Regla |
|---------|--------|-------|
| `ascensosqfd/`, `row/`, `rusheo/`, `zmf/`, `dragonfest/` | Un portal cada una | Se trabaja **uno por persona a la vez** |
| ↳ `index.html` | Portal público de resultados (lee la base de datos) | |
| ↳ `admin.html` | Herramienta para procesar salas (con login) | |
| `dragonfest/` | `index.html` = portal mixto · `femenino.html` = portal femenino · `admin.html` = herramienta compartida | |
| `zmf/` | `index.html` = portal mixto · `femenino.html` = portal femenino · `admin.html` = herramienta compartida | |
| `entrenoslatam/` | Portal que junta los resultados de todos los entrenos LATAM (solo lectura) | |
| `entrenamientos/` | Portal de Pumas | Igual que los portales |
| `portal-kit/` | Estilo, login, sesión, efectos, usuarios (lo usan todos) | **Avisar antes de tocar** |
| `admin/` | Panel central | **Avisar antes de tocar** |
| `sql/` | Cambios de base de datos | Solo archivos nuevos numerados (ver `sql/README.md`) |
| `index.html`, `style.css` | Portal principal | **Avisar antes de tocar** |

Imágenes de cada portal (las pones tú a mano en `<carpeta>/imagenes/`):

| Portal | Logo | Mascota (PNG vertical, sin fondo) |
|--------|------|-----------------------------------|
| Ascensos QFD | `ascensosqfd/imagenes/qfd.png` | `ascensosqfd/imagenes/mascotaqfd.png` |
| ROW x Maya | `row/imagenes/row.png` | `row/imagenes/mascotarow.png` |
| Rusheo | `rusheo/imagenes/rusheo.png` | `rusheo/imagenes/mascotarusheo.png` |
| ZMF mixto | `zmf/imagenes/zmf.png` | `zmf/imagenes/mascotazmf.png` |
| ZMF femenino | `zmf/imagenes/zmffem.png` | `zmf/imagenes/mascotazmffem.png` |
| Dragon Fest mixto | `dragonfest/imagenes/dragonfest.png` | `dragonfest/imagenes/mascotadragonfest.png` |
| Dragon Fest femenino | `dragonfest/imagenes/dragonfestfem.png` | `dragonfest/imagenes/mascotadragonfestfem.png` |
| Entrenos LATAM | `entrenoslatam/imagenes/latam.png` | `entrenoslatam/imagenes/mascotalatam.png` |

Si falta el logo se ve el de Pumas; si falta la mascota, simplemente no aparece.

Fondos de la imagen descargable de ZMF (4:5, 800×1000): `zmf/imagenes/fondozmf.png` (mixto) y `zmf/imagenes/fondozmffem.png` (femenino).

Links de los grupos de cada entreno (botón "Unirse" del index): Supabase → Table Editor → `portales` → columna `link`.

## Flujo con git

1. **Antes de empezar:** trae lo último de `main`.
   ```bash
   git checkout main
   git pull
   ```
2. **Crea una rama por tarea**, con prefijo de quién la hace:
   - tú: `nico/row-tabla-general`
   - Claude: `claude/zmf-guardado`
   ```bash
   git checkout -b nico/row-tabla-general
   ```
3. **Commits pequeños** que toquen solo la carpeta de la tarea.
4. **Al terminar:** sube la rama y únela a `main` (con un Pull Request o un merge).
5. **El otro actualiza su rama** con `main` antes de seguir, para recibir los cambios.

En la app de Claude puedes abrir una sesión por portal: cada sesión trabaja en su propia rama o worktree, sin mezclarse con la tuya.

## Flujo con Supabase

1. Claude escribe el SQL en un archivo nuevo de `sql/`.
2. Tú lo revisas y lo ejecutas en el SQL Editor.
3. Marcas ☑ en `sql/README.md` y haces commit.
4. Si falla, pegas el error en el chat.

Claude **no tiene acceso** a tu Supabase: todo lo de la base pasa por ti.

## Cómo pedir un cambio

Una tarea por mensaje, diciendo **portal + qué quieres**. Ejemplos:
- "ROW: que la tabla general lea de `v_tabla_general`".
- "ZMF: guardar cada sesión procesada en `portal_sesiones` y subir los logs a storage".
