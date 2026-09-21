# Backlog de revisión — `@cervello/react`

> Informe de revisión de 2026-09-07 sobre `packages/cervello/`, tras la tanda de cambios de perf
> (batching por microtask, caché de proxies hijos en `Map`, `deepEqualJson`, refinamiento por valor
> de `select` para cambios de ancestro).
>
> **Estado: nada implementado.** Este fichero es la unidad de trabajo para retomarlo en otra sesión.
> Los hallazgos están verificados leyendo `src/lib/**`, el diff en curso y las fuentes de React 18.2.0
> en `node_modules/.pnpm/`.

---

## 0 · Cómo retomar esto

1. Lee `CLAUDE.md` (arquitectura y comportamientos aceptados) y este fichero.
2. Elige una tanda de la sección 4. **No mezcles tandas en un mismo commit.**
3. Cada hallazgo trae ubicación exacta, fix propuesto y el test que lo cierra.
4. Antes de tocar A4 o A7: `cd packages/cervello && pnpm bench` para tener línea base.

---

## 1 · Hechos verificados sobre React (no re-investigar)

### `startTransition` no tiene ningún efecto sobre una escritura de cervello

Cadena verificada en las fuentes instaladas de React 18.2.0:

1. `store.x = 1` es un `set` síncrono del Proxy: muta el raw al momento, dispara `afterChange`,
   incrementa `version`. React no interviene — no hay estado de React de por medio.
2. El único update de React es `setRenderCount` dentro de `reRender()`, y sale de
   `queueMicrotask(flush)` — `src/lib/utils/subject.ts:132`.
3. `startTransition` restaura `ReactCurrentBatchConfig.transition` en un `finally` en cuanto el
   callback retorna — `react/cjs/react.development.js:2432-2435`. El microtask corre después.
4. `requestUpdateLane` — `react-dom/cjs/react-dom.development.js:25391` — encuentra
   `transition === null` y ninguna prioridad de evento activa → `DefaultEventPriority` → **DefaultLane**.
5. `DefaultLane` pertenece a `SyncDefaultLanes` (`:5672`) → `includesBlockingLane` es `true` →
   `shouldTimeSlice` es `false` (`:25737`) → `renderRootSync`.

**Conclusión: todo re-render provocado por cervello es un render bloqueante y no interrumpible,
siempre, con o sin `startTransition`.**

| | Con `startTransition` | Sin él |
|---|---|---|
| Valor escrito / orden / batching | idéntico | idéntico |
| Prioridad del re-render | DefaultLane (bloqueante) | DefaultLane (bloqueante) |
| `isPending` de `useTransition` | `true` y vuelve a `false` casi al instante — **no cubre el re-render** | n/a |
| Suspense que suspende | muestra el fallback | muestra el fallback |
| Interrumpible por input | no | no |

Inofensivo pero inútil, y engañoso para quien lea el código. Lo mismo aplica a las transiciones async
de React 19 (el peer range es `>= 18.2.0`): React solo puede seguir la cadena de promesas que le
devuelve el scope, y el microtask de flush no forma parte de ella.

**La receta correcta hoy** — diferir en el lado de lectura, no en el de escritura:

```jsx
const s = useStore({ select: ['query'] })
const deferredQuery = useDeferredValue(s.query)  // la lista pesada sí va a prioridad transition
```

### Tearing

Como DefaultLane no es time-sliced, un re-render de cervello no puede desgarrarse contra sí mismo.
Una escritura que cae en mitad de un render de transición ajeno sí desgarra el trabajo en curso, pero
el `setState` DefaultLane que llega un microtask después reinicia la raíz (`prepareFreshStack`), así
que nada roto llega a commitear — **siempre que al menos un componente montado re-renderice**.
El único hueco real es **A10**.

### Recuperación del gap de suscripción

`src/lib/store/new-index.ts:165` es correcto, pero sobre-dispara: `version` sube en **cada** escritura
del store, así que en un store activo casi todo montaje paga un render extra. Aceptable.

---

## 2 · Comportamientos por diseño — NO proponer arreglarlos

### A5 · `setValueOnMount` es un efecto de montaje, no una query gestionada
`src/lib/store/new-index.ts:136-145`

Su propósito es dar al desarrollador una forma de hacer un init / cambio de store al montar,
**exactamente como lo haría dentro de un `useEffect`**. Hereda el contrato de React para efectos de
montaje, y eso es lo correcto:

- Corre dos veces bajo StrictMode — igual que cualquier `useEffect` de montaje.
- No cancela al desmontar; una resolución tardía escribe igual en el store global — igual que un
  `fetch` sin `AbortController` dentro de un `useEffect`.
- Dos montajes que resuelven fuera de orden → gana el último, sin guarda de obsolescencia.

Añadir una guarda por `version()` o un ref `isMounted` **cambiaría la semántica que se busca**:
convertiría un efecto de montaje transparente en una capa de sincronización opinada, y el
desarrollador dejaría de poder razonar sobre ella como razona sobre `useEffect`. Quien necesite
cancelación o anti-obsolescencia la implementa en su propio callback, igual que en un efecto.

### Otros ya documentados en `CLAUDE.md`
Objetos complejos (`Date`/`Map`/`Set`/instancias de clase) aplanados por `deepClone` —
`nonReactive()` es la vía de escape. Referencias circulares cortadas a `null`. Escrituras durante
renders time-sliced que convergen en el siguiente flush. Aislamiento por request en SSR.

---

## 3 · Hallazgos abiertos

### A1 · ALTA — `flush()` sin `try/finally`: un subscriber que lance congela el store para siempre
`src/lib/utils/subject.ts:70-125`

`isFlushing = true` antes de repartir, `isFlushing = false` después. Si cualquier `observer.next`
lanza (típicamente un `onChange` de usuario), `isFlushing` se queda en `true` de forma permanente:
`next()` ya nunca agenda (`if (!isScheduled && !isFlushing)`) y `scheduleFlush()` sale por el
early-return. **Toda la reactividad de ese store muere en silencio, en toda la app.** Además los
observers restantes del snapshot pierden ese batch.

**Fix:** `try { …reparto… } finally { isFlushing = false }` + aislar el error por observer
(try/catch individual, re-lanzar en `queueMicrotask` para que llegue a `window.onerror` sin romper
el bucle).
**Test** (`src/test/lib/subject.test.ts`): un observer que lanza no impide que el siguiente reciba el
batch, ni que el siguiente `next()` se entregue.

---

### A2 · ALTA — Proxies hijos "zombis" tras `$value` / `reset()`
`src/lib/helpers/new-proxify-store.ts:146,172,177`

`childProxies.clear()` descarta el mapa del padre, pero un proxy hijo que el usuario ya capturó
(`const { address } = useStore()`, `const a = store.address`) conserva su propio `ROOT_VALUE`
apuntando al raw desconectado y su `parentObjectToProxify` apuntando a la root vieja. Escribir por él
(`address.city = 'X'`) muta el huérfano: **el store no cambia**, pero se emite igualmente un
`StoreChange` con `fieldPath: 'address.city'` y un `storeValue` obsoleto → todos los subscribers
re-renderizan y leen el valor viejo; `onChange`/`afterChange` reciben un cambio que no está en el store.

El refinamiento nuevo de `select` **aumenta la exposición**: ahora los selectores se filtran fuera de
los cambios `'root'`, así que un componente puede seguir renderizando legítimamente con un proxy hijo
desestructurado y obsoleto después de un `reset()`.

**Fix propuesto:** contador `generation` a nivel de store, incrementado en cada `$value`/`$$value`;
cada proxy hijo lo sella y, si no coincide, re-resuelve su raw desde la root viva con su `fieldPath`
(reutilizando `getValueAtPath`, `src/lib/utils/object.ts:311`). Si la ruta ya no resuelve, descartar
la escritura en vez de emitir.
**Alternativa más barata:** el hijo guarda `{parentProxy, key}` y valida `parentRaw[key] === miRoot`
en el `set`.
**Test** (`src/test/lib/proxify-store.test.ts`): proxy hijo capturado antes de `reset()`/`$value` —
la escritura o se redirige al raw vivo, o no emite.

---

### A3 · MEDIA-ALTA — Regresión de `select` con un campo top-level llamado `root`
`src/lib/store/new-index.ts:183-211`

Antes, `changedPath === 'root'` cortocircuitaba a `return true`: un campo llamado `root`
**sobre-renderizaba** (seguro). Ahora esa rama se salta el match por path y ejecuta el refinamiento de
store completo contra los valores *del campo*, así que `select: ['root']` — un `FieldPath`
perfectamente válido según `src/types/shared.ts:27-40` — compara
`getValueAtPath(prevDelCampo, 'root')` vs `getValueAtPath(newDelCampo, 'root')` → normalmente
`undefined === undefined` → **el componente no re-renderiza nunca**. El sobre-render se convirtió en
sub-render.

**Fix:** dejar de sobrecargar el string. Centinela no colisionable para el cambio de store completo
(`Symbol`, o un flag `isRoot` en el change). Se emite en dos sitios
(`new-proxify-store.ts:150,184`) y se lee en uno (`new-index.ts`). Actualizar la "known limitation"
de `CLAUDE.md`.
**Test** (`src/test/components.test.tsx`): store con un campo top-level llamado `root` +
`select: ['root']` re-renderiza al escribirlo.

---

### A4 · MEDIA — Que una escritura content-equal notifique o no depende de si el campo se leyó antes
`src/lib/helpers/new-proxify-store.ts:203-221`

El cortocircuito de igualdad solo corre si `childProxies` ya tiene entrada para la key, es decir, si
el campo se leyó al menos una vez a través del proxy. Los arrays nunca tienen entrada (`isObject`
excluye arrays, `src/lib/utils/object.ts:238-242`), así que `store.list = [...mismo...]` **siempre**
notifica. Los componentes sin `select` re-renderizan por un no-op, y el comportamiento depende del
orden de render de componentes ajenos.

Ya es un hueco conocido: el test `Refinement shields selected components from content-equal
reassignments of NEVER-READ fields` (`src/test/components.test.tsx:1128`) lo blinda **solo** para
usuarios de `select`.

**Fix:** hacer la comparación de contenido incondicional en el `set` trap, antes de tocar el proxy
hijo. **Medir con `pnpm bench`** desde `packages/cervello/` — añade una comparación a cada escritura
de objeto.
**Test** (`src/test/lib/proxify-store.test.ts`): escritura content-equal a un campo nunca leído, y a
un array, no notifican.

---

### A6 · MEDIA — `afterChange` se dispara en fase de render *(introducido en el diff en curso)*
`src/lib/helpers/new-proxify-store.ts:158`

El seed `$$value` es una escritura **en fase de render** (`new-index.ts:93-102`), y ahora invoca
`afterChange` de forma síncrona. Cualquier `setState` dentro del `afterChange` del usuario pasa a ser
un update en fase de render sobre otro componente (React avisa: *"Cannot update a component while
rendering a different component"*); cualquier efecto (analytics, DOM) corre también en renders
descartados y dos veces bajo StrictMode. `store$$.next` era seguro aquí porque difiere a microtask;
`afterChange` no.

**✅ DECIDIDO — diferir a microtask.** El `afterChange` del seed se encola con `queueMicrotask` en
lugar de invocarse en línea. Sigue disparándose para *todas* las emisiones — la frase nueva de
`README.md`/`CLAUDE.md` se mantiene válida — pero nunca dentro del render.
Nota de implementación: el `afterChange` de los otros dos puntos de emisión (`:191` y `:236`) ya corre
fuera del render; decidir si se difieren también por coherencia de orden, o solo el del seed.

---

### A7 · MEDIA — `$value` guarda el objeto del llamante por referencia
`src/lib/helpers/new-proxify-store.ts:171,176`

`cervello(initialValue)` clona (`new-index.ts:63`) y `reset()` clona, pero `store.$value = obj`
retiene `obj` por referencia: `const v = {count:0}; store.$value = v; v.count = 5` **muta el store en
silencio**, sin notificación ni `afterChange`. Igual con `store.address = obj`.

Relacionado y más grave: `{...store}` se expande a través del `get` trap, así que las propiedades
objeto del spread son **instancias de Proxy**; reasignar eso (`store.$value = {...store, x:1}`)
planta Proxies dentro del raw, rompiendo el invariante "el raw nunca contiene Proxies" que justifica
todo el diseño del `Map` de `childProxies`, y deja a esos proxies inyectados con el `emitPrefix`
equivocado para futuras escrituras (`get` trap, `:105`, los devuelve intactos).

**✅ DECIDIDO — desenvolver Proxies, sin clonar.** Normalizar únicamente el caso peligroso:
recorrer el valor entrante desenvolviendo `RAW_VALUE`. **No** se clona: el aliasing con el objeto del
llamante se queda como está y se documenta en el README, junto a la recomendación de usar
`{...store.$value}` en vez de `{...store}`. Medir con `pnpm bench` — es hot path.

---

### A8 · BAJA-MEDIA — Mutación de refs en fase de render
`src/lib/store/new-index.ts:88,93-102,108,113-129`

`optionsRef`, `isInitialValueSet`, `seenVersion` y `selectFieldPaths` se escriben durante el render.
En modo concurrente React puede renderizar y **descartar** (transición interrumpida, retry de
Suspense, segunda pasada de `useDeferredValue`, prerender de Offscreen).

**Matiz importante:** el seed `$$value` es un trade-off consciente, está documentado y cubierto por
tests de StrictMode; moverlo a un efecto cambiaría la semántica (el primer paint mostraría el valor
sin sembrar). **No tocarlo.**

**Sí arreglar:** `optionsRef.current = options` → mover a `useInsertionEffect`/`useLayoutEffect`
(patrón estándar de "latest ref"), para que un render descartado no instale un `onChange` obsoleto o
que nunca se commiteó.

---

### A9 · BAJA — El array del batch se comparte con el código de usuario
`src/lib/utils/subject.ts:96-104`

Todos los observers reciben **la misma** instancia, y `onChange(storeChanges)` la expone. Un
`changes.sort()` en un componente corrompe el batch de todos los demás en ese microtask. Está
documentado en `CLAUDE.md`/`README.md`, pero sigue siendo un footgun de API pública.

**Fix:** `Object.freeze(values)` solo en dev (`process.env.NODE_ENV !== 'production'`), manteniendo la
instancia compartida en prod.

---

### A10 · BAJA (doc) — `select` filtra re-renders pero no lecturas
Nada ata `select: ['a']` a lo que el componente lee de verdad. Leer `store.b` en un componente con
`select: ['a']` da un valor que no se actualiza nunca, y es el único camino por el que un componente
de cervello puede quedar visiblemente *torn* (ver sección 1). Difícil avisar en dev sin trackear
lecturas.

**Fix:** el README debe enunciarlo como **regla obligatoria**, no como recomendación.

---

### A11 · NITS
- `src/lib/utils/subject.ts:102` — `if (observersSnapshot[i].id !== undefined)` siempre es cierto
  (`useId()` siempre devuelve string). Check muerto.
- `afterChange` recibe un array de un elemento por emisión, mientras `onChange` recibe el batch
  entero, con el mismo tipo `Array<StoreChange<T>>`. O se documenta la diferencia, o se coalesce
  `afterChange` también por microtask.
- Aliasing entre stores: `src/lib/helpers/new-proxify-store.ts:135` desenvuelve `newValue[RAW_VALUE]`
  de **cualquier** proxy de cervello, así que asignar un proxy anidado del store A dentro del B hace
  que compartan un mismo raw; las escrituras en uno mutan el otro sin notificar.

---

## 4 · Tandas de ejecución

### Tanda 1 — Bugs, sin cambio de API
1. **A1** `subject.ts` — `try/finally` + aislamiento de errores por observer. Quitar el check muerto
   de `id` (A11).
2. **A3** `new-proxify-store.ts` + `new-index.ts` — centinela de cambio-raíz no colisionable.
3. **A4** `new-proxify-store.ts` — comparación de contenido incondicional en el `set` trap, con
   `pnpm bench` antes/después.
4. **A2** `new-proxify-store.ts` — invalidación por `generation` para proxies hijos desconectados.
5. **A8** `new-index.ts` — `optionsRef` a `useInsertionEffect`.
6. **A9** `subject.ts` — `Object.freeze` del batch solo en dev.

### Tanda 2 — Semántica (ya decidida)
- **A6** diferir el `afterChange` del seed con `queueMicrotask`.
- **A7** desenvolver `RAW_VALUE` en el valor entrante de `$value`.
- A5 está **cerrado como por diseño** (sección 2): nada que hacer.

### Tanda 3 — Soporte real de transiciones *(opcional, API nueva, descartada por ahora)*
La prioridad hay que capturarla en el momento de la **escritura**, porque el flush ya no puede saberlo:

```ts
let transitionDepth = 0
export function cervelloTransition (scope: () => void): void {
  transitionDepth++
  try { scope() } finally { transitionDepth-- }
}
// subject.next() -> guarda `isTransition: transitionDepth > 0` en el FlushItem
// observer de useStore -> isTransition ? startTransition(reRender) : reRender()
```

Advertencia: un flush marcado como transición pasa a ser time-sliced e interrumpible, lo que
**reabre el tearing real** (el store se lee en vivo durante el render). Debe ser opt-in explícito;
`onChange` debería seguir a prioridad normal. Ojo también con el warning de React *"Detected a large
number of updates inside startTransition…"* (`react.development.js:2441`, salta con >10 fibers): hoy
cervello nunca lo dispara justo porque sus updates escapan de la transición.

### Tanda 4 — Documentación
- `CLAUDE.md` → "Accepted/known behaviors": la nota de `startTransition`/DefaultLane (sección 1) y el
  porqué de A5 (sección 2), para que no se vuelvan a marcar como bugs.
- `README.md` → regla dura de `select` (A10), la receta con `useDeferredValue`, y el aliasing de
  `$value` con la recomendación `{...store.$value}` (A7).
- `CLAUDE.md` → actualizar la "known limitation" del campo `root` una vez cerrado A3.

---

## 5 · Verificación

```bash
pnpm test                                    # vitest one-shot sobre el paquete (desde la raíz)
pnpm lint                                    # arreglar también errores preexistentes en ficheros tocados
cd packages/cervello && pnpm bench           # antes/después de A4 y A7 — los únicos que tocan hot path
pnpm build                                   # regenerar types/ al final
```

Tests nuevos por hallazgo:

| Hallazgo | Fichero | Qué asegura |
|---|---|---|
| A1 | `src/test/lib/subject.test.ts` | Un observer que lanza no impide que los demás reciban, ni que el siguiente `next()` se entregue |
| A2 | `src/test/lib/proxify-store.test.ts` | Proxy hijo capturado antes de `reset()`/`$value`: la escritura se redirige al raw vivo o no emite |
| A3 | `src/test/components.test.tsx` | Campo top-level llamado `root` + `select: ['root']` re-renderiza |
| A4 | `src/test/lib/proxify-store.test.ts` | Content-equal a un campo nunca leído, y a un array, no notifican |
| A6 | `src/test/strict-mode.test.tsx` | `afterChange` no corre en fase de render con un seed `initialValue` |
| A7 | `src/test/lib/proxify-store.test.ts` | `store.$value = {...store, x:1}` no deja Proxies en el raw |

`src/test/lifecycle.test.tsx` corre **sin `act()`** a propósito (act vuelca los efectos pasivos antes
que los microtasks, justo al revés que en producción). Es el sitio para cualquier test de ordenación
real, incluido comprobar que una escritura dentro de `startTransition` da el mismo resultado que fuera.
