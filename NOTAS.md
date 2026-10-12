# Misterio · Cuaderno de notas

Documento vivo: lo que se ha hecho, las ideas que van saliendo y las decisiones tomadas.
Las ideas son **ideas**, no compromisos.

## Qué es
Juego de misterio multijugador pensado **solo para móviles**. Uno hace de **anfitrión** y el resto se une
con un código o un QR. Sin servidor propio: el móvil del anfitrión hace de servidor (P2P con PeerJS).

- Web publicada: https://arlanzon29.github.io/Misterio/
- Repo: https://github.com/arlanzon29/Misterio

## Hecho (registro)
| Qué | Estado |
|---|---|
| Esqueleto React + Vite en `client/` | Hecho |
| Primer intento con servidor Socket.IO | Descartado (Pages no ejecuta servidores) |
| Multijugador P2P con PeerJS (anfitrión = servidor) | Hecho y probado entre móviles con datos móviles |
| Sala con código de 4 letras, QR y enlace `?sala=XXXX` | Hecho |
| Despliegue automático en GitHub Pages (GitHub Actions) | Hecho |
| Nombre guardado en `localStorage` | Hecho |
| Foto de perfil con cámara, recorte 128×128, guardada en `localStorage` | Hecho |
| Botón "Empezar" del anfitrión y fase "Partida en curso" | Hecho |
| Preferencias en el lobby: malo / no malo + nivel bajo/medio/alto, con ✅ de listo | Hecho (privadas, solo las guarda el anfitrión) |
| Reconexión: identidad estable por móvil, estado "desconectado", volver a la sala | Hecho y probado |
| Versión visible (commit + fecha) en inicio y sala | Hecho |

## Decisiones técnicas
- **P2P con PeerJS**: sin servidor ni cuentas. El anfitrión guarda el estado y los secretos.
- Señalización con el servidor gratuito de PeerJS; STUN público. No se usa TURN (probado con datos móviles y funciona).
- La información privada de cada jugador **nunca** va en la vista pública de la sala.
- Identidad por móvil (`misterio:id`) para poder reconectar; fallback por nombre.
- La app usa `localStorage` para: nombre, foto, identidad y última sala.

## Limitaciones conocidas
- Si se apaga el móvil del **anfitrión**, la partida se pierde (el estado vive en su dispositivo).
- El anfitrión técnicamente podría ver los secretos (está en su dispositivo).
- Algunas redes (NAT simétrico, wifis corporativas) pueden necesitar un servidor TURN.
- Trabajar en `D:` impide los enlaces simbólicos: no usar workspaces de npm.

## Foco actual
**Hombres lobo** (deducción social). El resto de ideas quedan como alternativas; se retoman si hace falta.
A tener en cuenta: el nombre comercial "Castronegro" no se usa; tema de hombres lobo y mecánicas propias.

**Restricción de diseño:** la primera historia tiene que funcionar con **3 jugadores** (mínimo). Los lobos clásicos no
funcionan con 3 (1 lobo contra 2 aldeanos termina en la primera noche), así que hay que rediseñar: aldeanos NPC
como sospechosos/testigos con pistas, y/o formato cooperativo o 1 contra 2 asimétrico. Escala: más jugadores = más lobos.

**Formato de la primera historia (decidido):** 3 jugadores + 3 NPC = 6 personajes. Los NPC no hablan: se les
interroga con preguntas fijas y dan declaraciones generadas desde el estado oculto de la partida.
Borrador de reglas en discusión (lobo entre los 6, posible traidor humano).

## Ideas sobre el juego (por orden de aparición)
1. **Varias historias**, prefijadas o procedurales, como "paquetes de datos" sobre un motor genérico.
2. **Hombres lobo** (estilo Castronegro): deducción social, noche/día. Descartado como referencia: "se ha quedado obsoleto".
3. **Blood on the Clocktower**: nadie queda fuera (voto fantasma), información privada que puede ser falsa,
   orden de noche, nominaciones. Se plantea un Narrador automático.
4. **Misterio tipo Cluedo**: uno de los personajes es el **asesino**. (Idea más reciente; por desarrollar.)
5. **Rol de "malo" con nivel** bajo/medio/alto elegido en el lobby.
6. **Uso del móvil ajustable por historia**: algunas historias con uso mínimo (el móvil como apoyo: ver tu rol,
   pistas, votar) y otras muy dependientes del móvil (acciones, tiempo real, pantalla casi siempre activa).
   Idea: que cada historia declare su "intensidad de móvil" y se vea al elegirla.
7. **Componentes físicos** (p. ej. cartas): el juego mezcla material real con el móvil. Por explorar: qué hace
   cada parte (cartas = pistas/objetos/escenas, móvil = secretos, votos, temporizador, comprobación).
8. **Menos jugadores necesarios**: en juegos como hombres lobo hace falta mucha gente. La app podría reducirlo con
   personajes no jugadores (NPC) que ocupan roles, y con narrador automático (un humano menos). Por definir:
   qué hace cada NPC y cómo se mantiene la tensión sin que sean predecibles.
   **Problema detectado:** los NPC no participan en el diálogo, que es el corazón de la deducción social. Vías a
   explorar: NPC como fuente de información (testigos, declaraciones fijas que se pueden contrastar) en vez de
   sospechosos que votan; o que un jugador humano "interprete" a un NPC; o NPC con declaraciones pregrabadas.
   Una IA conversacional no es viable sin servidor.

## Preguntas abiertas
- ¿Qué significa exactamente el **nivel** del malo (bajo/medio/alto)?
- ¿Deducción social (votación) o investigación (pistas) como primer motor?
- ¿Narrador automático o anfitrión como Narrador?
- ¿Cuántos jugadores es lo normal?
- ¿Historias inventadas o adaptaciones? (Ojo con la propiedad intelectual de juegos comerciales.)
- ¿Cómo se reparten las preferencias de "malo" entre los jugadores al empezar?

## Pendiente técnico
- Reparto real de roles al empezar, usando las preferencias del lobby.
- Cada jugador ve solo su rol; muertos/eliminados como espectadores.
- Reconexión del anfitrión (guardar la partida y recrear la sala con el mismo código).
- Posible TURN de respaldo si algún jugador no logra conectar.
- Restringir qué datos ve el anfitrión si se quiere evitar trampas.
