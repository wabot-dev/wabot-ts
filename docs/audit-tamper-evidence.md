# Auditoría — Tamper-evidence (hashing) · Análisis para continuar

> Estado: **diseño acordado, sin implementar.** Retomar desde aquí.
> Fecha del análisis: 2026-07-26.
> Base ya construida: commit `7403260` — "Add per-repository audit trails (and drop the soft-delete field)".

## 1. Contexto

El sistema de auditoría **ya existe y está en `main`/rama** (`AuditLog` in-memory + `PgAuditLog`,
`@repository({ audit })`, `recover()`, actor por log-context, streams custom, tablas
`audit_<stream>` append-only). Ver skill `wabot-persistence` → sección "Audit trail".

Lo que falta y aquí se diseña: **evidencia de manipulación (tamper-evidence)** para compliance —
que se pueda **detectar** si alguien editó/borró/insertó entradas de auditoría, incluso con acceso
directo a la base de datos.

## 2. Mecanismo: cadena de hash por stream

Cada entrada guarda un hash que cubre su contenido **+ el hash de la anterior** del mismo stream:

```
seq_n     = seq_{n-1} + 1                                   // secuencia monótona por stream
prevHash  = hash_{n-1}                                      // genesis: seed fijo por stream
hash_n    = HMAC_SHA256(key_active, prevHash ‖ canonical(entry_n))
```

Columnas nuevas en `audit_<stream>`: `seq BIGINT`, `prev_hash`, `hash`, `key_id`, `signed BOOLEAN`.

Detección:

- **Editar** una entrada → su hash deja de cuadrar → rompe toda la cadena posterior.
- **Borrar** → el `prev_hash` de la siguiente no enlaza → hueco.
- **Insertar** en medio → cadena rota.
- `verify(stream)` recorre por `seq`, recomputa y reporta la **primera posición rota**.

## 3. El límite honesto (crítico)

Una cadena de hash **sola no detiene a quien controla toda la BD** (podría reescribir la cadena
completa desde el punto manipulado). Se cierra con **una o ambas**:

1. **HMAC con clave fuera de la BD** (no hash pelado). Quien solo tiene Postgres no puede recomputar
   hashes válidos sin la clave → toda alteración es detectable. La clave vive en un secreto
   (env `WABOT_AUDIT_HMAC_KEY` por ahora → migrable a Vault/KMS). **Se conecta con el item de
   secrets del roadmap.**
2. **Checkpoints anclados externamente**: periódicamente se emite `{ stream, seq, hash, at }`
   (opcionalmente firmado) a un lugar que el atacante no controla (S3 WORM, correo firmado, otro
   servicio, transparency log). El framework **emite** el checkpoint; **dónde se ancla** lo decide
   la app. `verify` compara contra el último checkpoint anclado.

Sin al menos (1), el hashing detecta errores/accidentes, no un atacante con acceso a la BD.

## 4. HMAC vs firma asimétrica

|                                      | HMAC (llavero simétrico)         | Firma asimétrica (priv/pub)       |
| ------------------------------------ | -------------------------------- | --------------------------------- |
| Rotación verificable                 | ✅ con `key_id` + retener claves | ✅ con `key_id` + claves públicas |
| Verificador externo sin poder forjar | ❌ (verificar == poder forjar)   | ✅                                |
| Costo / complejidad                  | bajo                             | medio (gestión par de claves)     |

**Decisión pendiente:** ¿verificación **solo interna** (equipo/sistema propio) → HMAC; o **tercero
independiente** debe poder verificar sin poder falsificar (auditor/regulador) → asimétrica?

## 5. Rotación de clave (sí sigue verificable, con cuidado)

- Rotar = **agregar** una clave activa nueva, **sin borrar** las viejas. Las viejas quedan en el
  **llavero solo para verificar**.
- Cada entrada guarda su `key_id`. La cadena **cruza el límite de rotación sin romperse**: el
  `prevHash` es solo bytes; verificar N usa su clave, N+1 usa la suya. **Nunca se re-firman las
  viejas** (sería reescribir la historia).
- **Trampa:** si pierdes/destruyes una clave vieja, **ese tramo deja de ser verificable** (HMAC
  necesita la clave exacta). Por eso: retener claves mientras se necesite verificar sus tramos, y
  emitir un **checkpoint firmado en cada rotación** como sello del tramo.
- `verify()` distingue **tres** estados, no dos: `ok` · `broken` (manipulado) · `unverifiable`
  (falta la clave del tramo). No dice "roto" cuando en realidad es "no tengo la clave".

## 6. Migración de auditorías legacy (sin firma)

Caso real del usuario: ya tiene años de auditorías **sin ninguna firma**; quiere migrarlas y
consultarlas, **sin firmarlas**.

**No firmarlas es lo correcto** — firmar hoy datos cuya integridad nunca estuvo protegida es
_security theater_. La evidencia de manipulación aplica **solo hacia adelante**.

Dos piezas ortogonales:

1. **`auditLog.import(entries[])`** — inserta entradas históricas **como están**, preservando
   `id`/`createdAt`/`actor` **originales** (no `Date.now()`, no contexto), **sin encadenar**
   (`signed = false`). Consultable de inmediato vía `query()`. **Funciona con o sin tamper-evidence
   activo** (la importación es independiente de la firma). Importación en **lotes** (INSERT
   multi-fila) para millones.

```ts
await auditLog.import([
  {
    stream: 'order',
    id: legacy.id,
    createdAt: legacy.timestamp,
    action: 'destroyed',
    target: legacy.orderId,
    actor: { type: 'user', id: legacy.userId },
    data: legacy.snapshot,
  },
  // …batches
])
```

2. **Cadena forward-only.** Al activar tamper-evidence, el _genesis_ es la primera entrada firmada.
   Las legacy quedan en el mismo stream (o en `order_legacy`, a elección) **consultables pero sin
   firma**. `verify()` cubre **solo el tramo firmado** y es explícito:

```ts
// { ok: true, signedFrom: <seq>, unsignedCount: 4200000, brokenAt: undefined }
```

Los legacy cuentan como "fuera de la garantía", no como "roto".

**Guía de migración:** importar primero, activar firma después (genesis limpio); preservar
id/createdAt/actor; lotes.

## 7. Tensión retención vs inmutabilidad

Borrar entradas viejas (escalar a millones) **rompe la cadena**. Se reconcilia **sellando**:
checkpoint de un rango + **partición por tiempo** de `audit_<stream>` → una partición sellada (con
su checkpoint firmado) se puede archivar/drop sin romper la verificación del resto.

## 8. Costos a aceptar

- **Serialización por stream**: cada append depende del hash anterior → escritos al mismo stream se
  serializan (advisory lock por stream). Cross-stream sigue paralelo. Por eso: **opt-in por stream**
  (`audit: { tamperEvident: true }`) — solo los streams críticos pagan la contención.
- **Serialización canónica**: el hash va sobre una forma **determinista** de la entrada (claves
  ordenadas, encoding fijo del JSONB). Si no es determinista → falsos positivos en `verify`. Detalle
  crítico de correctitud. Definir el `canonical(entry)` con cuidado (p. ej. JSON con claves
  ordenadas recursivamente, o concatenación de campos con longitudes prefijadas).

## 9. API objetivo

```ts
// nuevo
auditLog.import(entries: IAuditEntryImport[]): Promise<void>   // backfill sin firma, timestamps originales
auditLog.verify(stream, opts?): Promise<{ ok, signedFrom?, unsignedCount, brokenAt?, unverifiableFrom? }>
auditLog.checkpoint(stream): Promise<{ stream, seq, hash, at, keyId }>   // para anclar externamente

// config
@repository({ audit: { tamperEvident: true, /* events, stream, pool */ } })
```

Entrada extendida: `IAuditEntry` + `seq`, `prevHash`, `hash`, `keyId`, `signed`.

## 10. Decisiones pendientes antes de implementar

1. **Cripto**: HMAC (interno) vs asimétrica (verificador externo). → depende de si un tercero debe
   verificar sin poder forjar.
2. **Fuente de clave**: `WABOT_AUDIT_HMAC_KEY` ahora, migrable a Vault/KMS (item secrets). Formato de
   **llavero** (`{ keyId: key }`) desde el día uno para rotación.
3. **Checkpoints/anclaje**: ¿implementar `checkpoint()` + verificación contra checkpoint ahora, y
   dejar el **anclaje externo** como hook de la app? Recomendado: sí, hook.

## 11. Fase de implementación propuesta

- **Fase A**: `import()` + campo `signed` (desbloquea la migración legacy del usuario **ya**, sin
  depender del hashing).
- **Fase B**: cadena HMAC opt-in por stream (`seq`/`prevHash`/`hash`/`keyId`) + `canonical()` +
  serialización por stream (advisory lock) + `verify()` con estados ok/broken/unverifiable +
  llavero con rotación.
- **Fase C** (con secrets): clave desde secret manager; `checkpoint()` + anclaje externo (hook);
  partición por tiempo + sellado para retención.
- Opción: si se necesita verificador externo, sustituir HMAC por firma asimétrica en Fase B.

## 12. Recomendación de arranque

**Opt-in por stream + HMAC con llavero (rotación desde el día uno) + `import()` + `verify()`**, y
`checkpoint()`/anclaje externo + fuente-de-clave-por-secreto en la fase junto con **secrets**.
`import()` puede ir incluso **antes** que todo el hashing, porque cubre el caso legacy del usuario
de forma independiente.
