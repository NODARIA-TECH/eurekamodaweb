-- EUREKA · Código de barras sin guion en FacturaScripts
-- Las etiquetas codifican la referencia SIN guion (PEK-0897 -> PEK0897) para que la
-- pistola la escriba igual con cualquier distribución de teclado. FS encuentra el
-- producto al escanear por su campo "codbarras".
-- Ejecutar UNA vez en la base de datos de FacturaScripts (ver FS_DB_NAME en /var/www/factura/config.php).

-- 1) Rellena el código de barras de los productos que ya existen (solo PEK-..., solo si está vacío)
UPDATE variantes
   SET codbarras = REPLACE(referencia, '-', '')
 WHERE (codbarras IS NULL OR codbarras = '')
   AND referencia LIKE 'PEK-%';

-- 2) A partir de ahora se rellena solo al crear o guardar un producto PEK-...
DROP TRIGGER IF EXISTS eureka_codbarras_ins;
DROP TRIGGER IF EXISTS eureka_codbarras_upd;
DELIMITER //
CREATE TRIGGER eureka_codbarras_ins BEFORE INSERT ON variantes FOR EACH ROW
BEGIN
  IF (NEW.codbarras IS NULL OR NEW.codbarras = '') AND NEW.referencia LIKE 'PEK-%' THEN
    SET NEW.codbarras = REPLACE(NEW.referencia, '-', '');
  END IF;
END//
CREATE TRIGGER eureka_codbarras_upd BEFORE UPDATE ON variantes FOR EACH ROW
BEGIN
  IF (NEW.codbarras IS NULL OR NEW.codbarras = '') AND NEW.referencia LIKE 'PEK-%' THEN
    SET NEW.codbarras = REPLACE(NEW.referencia, '-', '');
  END IF;
END//
DELIMITER ;

-- 3) Comprobación
SELECT referencia, codbarras FROM variantes WHERE referencia LIKE 'PEK-%' ORDER BY referencia LIMIT 10;
