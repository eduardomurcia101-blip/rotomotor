CREATE DATABASE IF NOT EXISTS rutamotor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rutamotor;

CREATE TABLE IF NOT EXISTS productos (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria ENUM('baterias', 'motor-filtros', 'llantas-ruedas', 'iluminacion') NOT NULL,
  precio_cop INT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin (
  id_admin INT NOT NULL AUTO_INCREMENT,
  nombre_admin VARCHAR(100) NOT NULL,
  `contraseña_admin` VARCHAR(255) NOT NULL,
  PRIMARY KEY (id_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO productos (id, nombre, descripcion, categoria, precio_cop, stock) VALUES
(1, 'Batería compacta 12V', 'Para automóviles compactos y uso diario.', 'baterias', 249900, 11),
(2, 'Batería para camioneta 12V', 'Mayor capacidad para camionetas.', 'baterias', 389900, 6),
(3, 'Batería para motocicleta', 'Formato compacto para moto urbana.', 'baterias', 119900, 14),
(4, 'Cargador portátil de batería', 'Práctico cargador para tener a mano.', 'baterias', 179900, 6),
(5, 'Terminales para batería', 'Par de terminales de repuesto.', 'baterias', 24900, 21),
(6, 'Batería AGM para motocicleta 12V', 'Batería sellada para motocicleta de uso diario.', 'baterias', 159900, 34),
(7, 'Batería de litio para motocicleta', 'Alternativa liviana para motos compatibles.', 'baterias', 289900, 5),
(8, 'Filtro de aire para motor', 'Repuesto para el sistema de admisión.', 'motor-filtros', 45900, 20),
(9, 'Filtro de aceite', 'Para el mantenimiento periódico del motor.', 'motor-filtros', 32900, 25),
(10, 'Bujía para automóvil', 'Repuesto para motor a gasolina.', 'motor-filtros', 28900, 30),
(11, 'Correa de accesorios', 'Repuesto para el sistema de accesorios.', 'motor-filtros', 74900, 10),
(12, 'Filtro de combustible', 'Ayuda a retener impurezas del combustible.', 'motor-filtros', 39900, 16),
(13, 'Aceite 4T para motocicleta', 'Aceite para motor de cuatro tiempos; verifica la viscosidad indicada por el fabricante.', 'motor-filtros', 49900, 24),
(14, 'Kit de arrastre para motocicleta', 'Cadena, piñón y corona para transmisión final.', 'motor-filtros', 189900, 9),
(15, 'Pastillas de freno delanteras para moto', 'Repuesto de fricción para freno delantero de disco.', 'motor-filtros', 44900, 18),
(16, 'Kit de discos de clutch para moto', 'Discos de embrague para reemplazo y mantenimiento.', 'motor-filtros', 99900, 7),
(17, 'Kit de pistón y anillos para moto', 'Componentes de repuesto para reparación de motor.', 'motor-filtros', 149900, 6),
(18, 'Kit de empaques para motor de moto', 'Juego de juntas para mantenimiento del motor.', 'motor-filtros', 69900, 8),
(19, 'Filtro de aceite para motocicleta', 'Filtro de repuesto para sistema de lubricación.', 'motor-filtros', 19900, 27),
(20, 'Filtro de aire para motocicleta', 'Elemento filtrante para la admisión de aire.', 'motor-filtros', 24900, 20),
(21, 'Carburador para motocicleta 125 cc', 'Repuesto para sistema de alimentación compatible.', 'motor-filtros', 139900, 4),
(22, 'Cable de clutch para motocicleta', 'Cable de repuesto para accionamiento del embrague.', 'motor-filtros', 22900, 15),
(23, 'Llanta para automóvil rin 15', 'Llanta de uso urbano para automóvil.', 'llantas-ruedas', 329900, 10),
(24, 'Llanta para camioneta rin 16', 'Llanta de repuesto para camioneta.', 'llantas-ruedas', 489900, 7),
(25, 'Llanta para motocicleta', 'Llanta de repuesto para moto urbana.', 'llantas-ruedas', 159900, 14),
(26, 'Rin de aleación rin 15', 'Rin de repuesto para automóvil.', 'llantas-ruedas', 429900, 5),
(27, 'Válvula para llanta', 'Válvula de repuesto para rueda.', 'llantas-ruedas', 9900, 40),
(28, 'Llanta delantera para motocicleta', 'Llanta delantera para moto urbana; verifica la medida compatible.', 'llantas-ruedas', 169900, 8),
(29, 'Llanta trasera para motocicleta', 'Llanta trasera de repuesto; confirma la medida de tu moto.', 'llantas-ruedas', 199900, 6),
(30, 'Cámara para llanta de motocicleta', 'Cámara de repuesto para rueda compatible.', 'llantas-ruedas', 39900, 14),
(31, 'Kit de rodamientos de rueda para moto', 'Rodamientos de repuesto para mantenimiento de rueda.', 'llantas-ruedas', 54900, 10),
(32, 'Bombillo LED para faro', 'Bombillo LED de repuesto para faro delantero.', 'iluminacion', 89900, 18),
(33, 'Exploradoras auxiliares', 'Juego de luces auxiliares para vehículo.', 'iluminacion', 159900, 9),
(34, 'Luz trasera para automóvil', 'Repuesto para el conjunto de luz trasera.', 'iluminacion', 129900, 6),
(35, 'Bombillo para luz direccional', 'Bombillo de repuesto para direccional.', 'iluminacion', 18900, 24),
(36, 'Barra LED auxiliar', 'Iluminación adicional para tu vehículo.', 'iluminacion', 219900, 4),
(37, 'Faro delantero para motocicleta', 'Conjunto de faro delantero para moto compatible.', 'iluminacion', 119900, 5),
(38, 'Stop trasero para motocicleta', 'Luz trasera de repuesto para motocicleta.', 'iluminacion', 69900, 7),
(39, 'Direccionales LED para moto', 'Juego de luces direccionales para motocicleta.', 'iluminacion', 49900, 11),
(40, 'Bombillo para faro de motocicleta', 'Bombillo de repuesto para faro delantero.', 'iluminacion', 24900, 16);
