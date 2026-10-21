# Olla Vegana

Desarrollo de la plataforma web institucional de Olla Vegana, una organización que promueve la alimentación basada en plantas y desarrolla iniciativas solidarias.

## Descripción del proyecto

El proyecto consiste en el desarrollo de un sitio web institucional que comunica la identidad, la propuesta y las actividades de Olla Vegana. Incluye una sección de tienda online para la comercialización de productos, con funcionalidades de gestión para facilitar su mantenimiento por parte de la organización.

## Objetivos

- Comunicar la identidad y la propuesta de Olla Vegana.
- Presentar información sobre la organización, sus actividades y campañas.
- Facilitar el acceso a los puntos de retiro y a los canales de contacto.
- Incorporar una tienda online con catálogo de productos.
- Permitir la gestión de productos, precios, variantes y stock mediante un panel de administración.
- Integrar medios de pago y opciones de retiro.

## Alcance funcional

### Sitio institucional
- Inicio.
- Nuestra propuesta.
- Información sobre la organización.
- Ubicaciones y puntos de retiro.
- Campañas e iniciativas solidarias.
- Contacto y redes sociales.
- Información sobre donaciones.

### Tienda online
- Catálogo de productos.
- Detalle de productos, precios y variantes.
- Carrito de compras.
- Proceso de compra e integración de pagos.
- Información sobre modalidades y puntos de retiro.

### Panel de administración
- Alta y eliminación de productos.
- Modificación de precios y descripciones.
- Gestión de variantes y stock.
- Administración del catálogo.

## Tecnologías

- **Frontend:** React + JSX + Vite.
- **Estilos:** Tailwind CSS + PostCSS.
- **Iconografía:** Lucide React.
- **Mapas:** Leaflet + React Leaflet.
- **Calidad:** Oxlint.

## Estructura del repositorio

```text
olla-vegana/
├── src/
│   ├── assets/       # Marca y fotografías de productos
│   ├── components/   # Componentes de UI reutilizables
│   ├── context/      # Estado global de la aplicación
│   ├── data/         # Datos mock iniciales
│   ├── App.jsx       # Orquestador principal
│   ├── index.css     # Estilos globales y Tailwind
│   └── main.jsx      # Punto de entrada
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── README.md
```

Los componentes y archivos de datos contienen stubs y mocks iniciales para comenzar el desarrollo por etapas, sin lógica de producción todavía.

## Desarrollo

El proyecto se organizará por etapas, contemplando diseño de interfaz, desarrollo frontend, desarrollo backend, integración de servicios y pruebas de calidad (QA).

```bash
npm install
npm run dev
```

Para validar la entrega:

```bash
npm run build
npm run lint
```

El desarrollo del frontend se implementará en las siguientes etapas sobre la estructura modular existente:

1. Sistema visual y componentes base.
2. Sitio institucional y mapa de puntos de distribución.
3. Catálogo, variantes, carrito y checkout.
4. Integración de pagos, retiro y panel de administración.

## Estado del proyecto

En etapa inicial de organización y preparación del desarrollo.

## Equipo

Desarrollado por el equipo de Oestack en colaboración con Olla Vegana.