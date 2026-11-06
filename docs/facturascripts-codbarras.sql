-- EUREKA · Código de barras sin guion en FacturaScripts
-- Las etiquetas codifican la referencia SIN guion (PEK-0897 -> PEK0897) para que la
-- pistola la escriba igual con cualquier distribución de teclado. FS encuentra el
-- producto al escanear por su campo "codbarras".
-- Ejecutar UNA vez en la base de datos de FacturaScripts (ver FS_DB_NAME en /var/www/factura/config.php).

-- 1) Pone el código de barras sin guion en los productos que ya existen (solo PEK-...).
--    Sustituye si está vacío o si tiene guion (p.ej. se copió la referencia "PEK-0897").
--    No toca un código de barras propio (un EAN del proveedor, sin guion).
UPDATE variantes
   SET codbarras = REPLACE(referencia, '-', '')
 WHERE referencia LIKE 'PEK-%'
   AND (codbarras IS NULL OR codbarras = '' OR codbarras LIKE '%-%');

-- 2) A partir de ahora se pone solo al crear o guardar un producto PEK-...
DROP TRIGGER IF EXISTS eureka_codbarras_ins;
DROP TRIGGER IF EXISTS eureka_codbarras_upd;
DELIMITER //
CREATE TRIGGER eureka_codbarras_ins BEFORE INSERT ON variantes FOR EACH ROW
BEGIN
  IF NEW.referencia LIKE 'PEK-%' AND (NEW.codbarras IS NULL OR NEW.codbarras = '' OR NEW.codbarras LIKE '%-%') THEN
    SET NEW.codbarras = REPLACE(NEW.referencia, '-', '');
  END IF;
END//
CREATE TRIGGER eureka_codbarras_upd BEFORE UPDATE ON variantes FOR EACH ROW
BEGIN
  IF NEW.referencia LIKE 'PEK-%' AND (NEW.codbarras IS NULL OR NEW.codbarras = '' OR NEW.codbarras LIKE '%-%') THEN
    SET NEW.codbarras = REPLACE(NEW.referencia, '-', '');
  END IF;
END//
DELIMITER ;

-- 3) Comprobación: codbarras debe salir sin guion (PEK0897)
SELECT referencia, codbarras FROM variantes WHERE referencia LIKE 'PEK-%' ORDER BY referencia LIMIT 15;
SELECT COUNT(*) AS con_guion_todavia FROM variantes WHERE referencia LIKE 'PEK-%' AND codbarras LIKE '%-%';
