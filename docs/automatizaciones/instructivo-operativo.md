# Instructivo de Operación: Flujo de Automatización de Sucursales (InvGate Service Desk)

> Manual de procedimiento y referencia operativa para la gestión del workflow de
> Automatización de Sucursales en **InvGate Service Desk** (Correo Argentino).
> Explica la coordinación entre el **Ticket Padre** y los **Tickets Hijos**,
> detalla dónde debe interactuar cada sector técnico y cómo interpretar el
> **Tablero Status Proyecto**.

## 1. Matriz RACI Integrada y Directorio de Acceso Rápido

- **Responsable:** ejecuta la tarea técnica en sistemas corporativos o en sitio.
- **Aprobador:** coordina, valida requisitos y autoriza formalmente el avance.
- **Consultado:** provee parámetros, rangos de direccionamiento o datos fiscales.
- **Informado:** realiza seguimiento pasivo (observador).

| Sector / Área | Rol RACI | Ticket / Tarea en InvGate | Alcance operativo principal |
| --- | --- | --- | --- |
| **Mesa de Coordinación (MDC)** | **Aprobador** | Ticket Padre / Proceso central | Lanzamiento, monitoreo del Tablero Status y decisión de Go / No Go |
| **Jefe de Sucursal / Zonal** | **Informado** | Observador asignado | Seguimiento en vivo del estado de modernización de su local |
| **Redes e Infraestructura (TECO / Redes N2)** | **Responsable / Consultado** | `Revisión de Red e Infraestructura` / `IPs` | Adecuación de cableado, bocas de red y reserva de rango IP/Gateway |
| **Lab Ensamble (Microinformática)** | **Responsable** | `Ticket 1.1 - Despacho Servidor MOA` | Masterizado en Windows 11, configuración base y despacho |
| **Micro Mobile** | **Responsable** | `Ticket 1.2 - Despacho HandHeld` | Enrolamiento, carga de apps postales y despacho de lectores |
| **Asistencia Operativa** | **Responsable** | `Habilitación de Servicios M&F` | SmartPoint, códigos QR, alta en `BR_ADT_BR` y SAS a `SA` |
| **Facturación / Impuestos** | **Responsable / Consultado** | `Alta Fiscal: Punto de Venta y CAI` | Punto de Venta (PDV), CAI y registro en INTEGRA |
| **Soporte Técnico TI** | **Responsable** | Tareas de configuración lógica | Hostnames, IP definitiva, ruta BUI y validación del servidor en sitio |
| **Desarrollo (Sucursales y OnBase)** | **Responsable** | Subprocesos `DESA Sucursales` y `DESA On Base` | Alta documental NIS y parametrización de cobro (**adjuntar BITMAPS**) |
| **Servicio Técnico (Field Services)** | **Responsable** | `Instalación y Despliegue en Sitio` | Montaje de hardware, balanzas, impresoras y acta de conformidad |
| **Gestión de Identidades (GDI)** | **Responsable** | `Altas de Usuarios Mosaic` | Creación de cuentas y perfiles para ventanilla |

## 2. Arquitectura del Flujo: Proceso Padre y Subprocesos

```
[ Solicitud Inicial MDC (Padre) ] ──► Formulario Inicial + Plan de Equipamiento
                                                 │
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │    PROCESO PADRE (Seguimiento Central)       │
                          └──────────────────────┬───────────────────────┘
                                                 │
       ┌─────────────┬───────────────┬───────────┴───┬────────────────┬
       ▼             ▼               ▼               ▼                ▼
  [Redes/TECO]  [Lab Ensamble]   [Micro Mobile]   [Asistencia Op] [Impuestos]
       │             │               │               │                │
       └─────────────┴───────────────┼───────────────┴────────────────┘
                                     │ (Actualización bidireccional)
                                     ▼
                          ┌──────────────────────────────────────────────┐
                          │         TABLERO STATUS PROYECTO              │
                          │   [ACTUALIZAR] ──▶ Refresca semáforos        │
                          │   [AVANZAR]    ──▶ Habilita Subprocesos/GO   │
                          └──────────────────────┬───────────────────────┘
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │    SUBPROCESOS: DESA SUCURSALES Y ONBASE     │
                          └──────────────────────┬───────────────────────┘
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │     IMPLEMENTACIÓN FINAL EN SUCURSAL         │
                          │  (Field Services + Altas Mosaic + Baja Giro) │
                          └──────────────────────┬───────────────────────┘
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │      CIERRE Y RELANZAMIENTO COMERCIAL        │
                          └──────────────────────────────────────────────┘
```

> **Reglas fundamentales de interacción en InvGate:**
>
> 1. **Los tickets derivados alimentan al padre:** al presionar **Resolver**, el
>    resultado impacta directamente sobre el expediente central.
> 2. **Actualización bajo demanda:** el *Tablero Status Proyecto* toma una captura
>    al abrirse; para ver las últimas resoluciones, MDC debe presionar
>    **ACTUALIZAR**.
> 3. **No alterar categorías asignadas:** cambiar la categoría de un ticket hijo
>    rompe las listas de verificación y desacopla los campos obligatorios.

## 3. Torre de Control: el Tablero Status Proyecto (MDC)

El Coordinador de MDC gestiona la compuerta de decisión dentro del Ticket Padre
evaluando los **9 indicadores clave**:

| # | Indicador | Sector responsable | Condición para avanzar | Acción ante estado pendiente |
| --- | --- | --- | --- | --- |
| 1 | **Nuevo Servidor** | Lab Ensamble | `Despachado` / `Entregado` | Reclamar número de guía / remito |
| 2 | **Nuevo HandHeld** | Micro Mobile | `Despachado` / `Entregado` | Consultar preparación y despacho |
| 3 | **Equipamiento - Otro** | Logística TI | `En sitio` / `Despachado` | Verificar remitos de periféricos |
| 4 | **Red y Cableado** | TECO / Redes N2 | `Finalizado` | Reclamar certificación y rango IP |
| 5 | **Servicios M&F** | Asistencia Operativa | `Realizado` | Consultar SmartPoint, QR, SAS, `BR_ADT_BR` |
| 6 | **CAI Informado** | Impuestos / Facturación | `Si` | Reclamar CAI en INTEGRA |
| 7 | **Punto de Venta** | Impuestos / Facturación | `Si` | Confirmar alta del PDV |
| 8 | **Carpeta BUI** | Facturación / Soporte TI | `Si` | Validar ruta de red compartida BUI |
| 9 | **Acción a Tomar** | MDC (Coordinación) | `ACTUALIZAR` o `AVANZAR` | Decisión del coordinador |

> **Cómo operar el selector de Acción:**
>
> - **ACTUALIZAR:** si algún indicador sigue amarillo/pendiente. Re-escanea los
>   tickets hijos y actualiza los semáforos sin mover el proyecto de etapa.
> - **AVANZAR (GO):** solo cuando los 8 semáforos están cumplidos. Dispara en
>   paralelo los subprocesos de **Desarrollo (Sucursales y OnBase)** y la
>   posterior **Implementación en Sitio**.

## 4. Fichas Operativas por Sector

- **Mesa de Coordinación (MDC)** — lanzamiento, tablero y decisión de avance.
- **Redes e Infraestructura** — cableado, bocas de red y rango IP.
- **Laboratorio de Ensamble — Servidor MOA** — masterizado y despacho.
- **Micro Mobile — HandHelds** — enrolamiento y despacho.
- **Asistencia Operativa — Servicios M&F** — SmartPoint, QR, `BR_ADT_BR`, SAS.
- **Soporte Técnico TI** — hostnames, IP definitiva, BUI, servidor en sitio.
- **Desarrollo — Sucursales y OnBase** — NIS, BITMAPS, cobro.
- **Servicio Técnico — Field Services** — instalación y acta de conformidad.
- **Gestión de Identidades — GDI** — altas de usuarios Mosaic.

### Procedimiento en sistemas corporativos (fuera de InvGate)

1. **SmartPoint y códigos QR:** coordinar terminales y tramitar QR para ventanillas.
2. **Parametrización en `BR_ADT_BR`:** alta y configuración de la sucursal automatizada.
3. **Cambio de categoría en SAS:** tipificar la oficina como **Sucursal Automatizada (`SA`)**.

## 5. Preguntas Frecuentes

> **Completé mi tarea en el sistema corporativo pero el Tablero de MDC no avanza. ¿Por qué?**
> Terminar la tarea fuera de InvGate no actualiza el flujo. Es indispensable
> entrar a InvGate, tildar los checklists y resolver el ticket. Además MDC debe
> presionar **ACTUALIZAR** para refrescar los semáforos.

> **¿Quién carga el CAI y el Punto de Venta?**
> Facturación / Impuestos. Asistencia Operativa gestiona SAS, `BR_ADT_BR`,
> SmartPoint y QR, pero no los datos tributarios.

> **¿Por qué mi ticket hijo no muestra checklists ni campos obligatorios?**
> Ocurre si el ticket se abrió en una categoría manual genérica. Para heredar las
> listas y campos debe originarse por el workflow o dentro de su categoría.

## 6. Problemas frecuentes

| Problema | Acción resolutiva de MDC |
| --- | --- |
| En Mosaic aparece "error en vuelco de especies valorizadas" | Verificar con Soporte Técnico y, si no, con Asistencia Operativa |
| Mosaic pide lector de huellas y la sucursal no tiene | Ticket a Soporte Técnico para deshabilitar el lector |

## 7. Checklist Global de Cierre para Relanzamiento

- [ ] **Servidor MOA:** despacho, recepción y configuración definitiva.
- [ ] **HandHelds:** dispositivos enrolados y operativos.
- [ ] **Red y Cableado:** bocas de mostrador y rack certificados por TECO/Redes N2.
- [ ] **Asistencia Operativa:** SmartPoint, QR, `BR_ADT_BR` y SAS completados.
- [ ] **Impuestos / Facturación:** CAI en INTEGRA y Punto de Venta informado.
- [ ] **Desarrollo:** BITMAPS adjuntado y NIS registrado en OnBase.
- [ ] **Instalación de Campo:** visita técnica completada y acta firmada.
- [ ] **Accesos y Sistemas:** usuarios Mosaic habilitados y Giros dado de baja.
- [ ] **Tablero InvGate:** los 8 semáforos en verde y Ticket Padre cerrado.
