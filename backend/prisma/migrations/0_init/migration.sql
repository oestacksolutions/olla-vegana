-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `contrasena` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Admin_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Categoria` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `padreId` VARCHAR(191) NULL,

    UNIQUE INDEX `Categoria_slug_key`(`slug`),
    INDEX `Categoria_padreId_idx`(`padreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Producto` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `precioBase` DECIMAL(10, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `destacado` BOOLEAN NOT NULL DEFAULT false,
    `categoriaId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Producto_slug_key`(`slug`),
    INDEX `Producto_categoriaId_idx`(`categoriaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Variante` (
    `id` VARCHAR(191) NOT NULL,
    `productoId` VARCHAR(191) NOT NULL,
    `precio` DECIMAL(10, 2) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Variante_productoId_idx`(`productoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImagenProducto` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `posicion` INTEGER NOT NULL DEFAULT 0,
    `productoId` VARCHAR(191) NOT NULL,
    `varianteId` VARCHAR(191) NULL,

    INDEX `ImagenProducto_productoId_idx`(`productoId`),
    INDEX `ImagenProducto_varianteId_idx`(`varianteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Atributo` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Atributo_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValorAtributo` (
    `id` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `atributoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ValorAtributo_atributoId_valor_key`(`atributoId`, `valor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValorVariante` (
    `varianteId` VARCHAR(191) NOT NULL,
    `valorAtributoId` VARCHAR(191) NOT NULL,

    INDEX `ValorVariante_valorAtributoId_idx`(`valorAtributoId`),
    PRIMARY KEY (`varianteId`, `valorAtributoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovimientoStock` (
    `id` VARCHAR(191) NOT NULL,
    `varianteId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('INGRESO', 'AJUSTE', 'VENTA', 'DEVOLUCION') NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MovimientoStock_varianteId_idx`(`varianteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PuntoRetiro` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `horarios` TEXT NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `PuntoRetiro_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pedido` (
    `id` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `metodoPago` ENUM('MERCADO_PAGO', 'TRANSFERENCIA') NOT NULL,
    `estadoPago` ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO') NOT NULL DEFAULT 'PENDIENTE',
    `estado` ENUM('NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO') NOT NULL DEFAULT 'NUEVO',
    `total` DECIMAL(10, 2) NOT NULL,
    `puntoRetiroId` VARCHAR(191) NOT NULL,
    `mpPreferenciaId` VARCHAR(191) NULL,
    `mpPagoId` VARCHAR(191) NULL,
    `notaPago` TEXT NULL,
    `pagoVerificadoEn` DATETIME(3) NULL,
    `pagadoEn` DATETIME(3) NULL,
    `retiradoEn` DATETIME(3) NULL,
    `venceEn` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Pedido_numero_key`(`numero`),
    INDEX `Pedido_correo_idx`(`correo`),
    INDEX `Pedido_estado_idx`(`estado`),
    INDEX `Pedido_estadoPago_idx`(`estadoPago`),
    INDEX `Pedido_creadoEn_idx`(`creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservaStock` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `varianteId` VARCHAR(191) NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `estado` ENUM('ACTIVA', 'CONFIRMADA', 'LIBERADA') NOT NULL DEFAULT 'ACTIVA',
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `venceEn` DATETIME(3) NOT NULL,
    `confirmadaEn` DATETIME(3) NULL,
    `liberadaEn` DATETIME(3) NULL,

    INDEX `ReservaStock_estado_venceEn_idx`(`estado`, `venceEn`),
    INDEX `ReservaStock_varianteId_idx`(`varianteId`),
    UNIQUE INDEX `ReservaStock_pedidoId_varianteId_key`(`pedidoId`, `varianteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemPedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `productoId` VARCHAR(191) NOT NULL,
    `varianteId` VARCHAR(191) NULL,
    `nombreProducto` VARCHAR(191) NOT NULL,
    `detalleVariante` VARCHAR(191) NULL,
    `cantidad` INTEGER NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,

    INDEX `ItemPedido_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistorialEstadoPedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `estadoAnterior` ENUM('NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO') NULL,
    `estadoNuevo` ENUM('NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO') NOT NULL,
    `nota` VARCHAR(191) NULL,
    `adminId` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HistorialEstadoPedido_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventoPago` (
    `id` VARCHAR(191) NOT NULL,
    `proveedor` VARCHAR(191) NOT NULL,
    `idExterno` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `contenido` JSON NOT NULL,
    `pedidoId` VARCHAR(191) NULL,
    `procesadoEn` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventoPago_idExterno_idx`(`idExterno`),
    INDEX `EventoPago_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `id` VARCHAR(191) NOT NULL,
    `imagenUrl` VARCHAR(191) NOT NULL,
    `dispositivo` ENUM('ESCRITORIO', 'CELULAR') NOT NULL,
    `posicion` INTEGER NOT NULL DEFAULT 0,
    `posicionImagen` VARCHAR(191) NOT NULL DEFAULT 'center',
    `terminaEn` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Configuracion` (
    `clave` VARCHAR(191) NOT NULL,
    `valor` TEXT NOT NULL,
    `actualizadoEn` DATETIME(3) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Categoria` ADD CONSTRAINT `Categoria_padreId_fkey` FOREIGN KEY (`padreId`) REFERENCES `Categoria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Producto` ADD CONSTRAINT `Producto_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Variante` ADD CONSTRAINT `Variante_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImagenProducto` ADD CONSTRAINT `ImagenProducto_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImagenProducto` ADD CONSTRAINT `ImagenProducto_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `Variante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValorAtributo` ADD CONSTRAINT `ValorAtributo_atributoId_fkey` FOREIGN KEY (`atributoId`) REFERENCES `Atributo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValorVariante` ADD CONSTRAINT `ValorVariante_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `Variante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValorVariante` ADD CONSTRAINT `ValorVariante_valorAtributoId_fkey` FOREIGN KEY (`valorAtributoId`) REFERENCES `ValorAtributo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovimientoStock` ADD CONSTRAINT `MovimientoStock_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `Variante`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pedido` ADD CONSTRAINT `Pedido_puntoRetiroId_fkey` FOREIGN KEY (`puntoRetiroId`) REFERENCES `PuntoRetiro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservaStock` ADD CONSTRAINT `ReservaStock_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservaStock` ADD CONSTRAINT `ReservaStock_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `Variante`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPedido` ADD CONSTRAINT `ItemPedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPedido` ADD CONSTRAINT `ItemPedido_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPedido` ADD CONSTRAINT `ItemPedido_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `Variante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistorialEstadoPedido` ADD CONSTRAINT `HistorialEstadoPedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistorialEstadoPedido` ADD CONSTRAINT `HistorialEstadoPedido_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventoPago` ADD CONSTRAINT `EventoPago_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

