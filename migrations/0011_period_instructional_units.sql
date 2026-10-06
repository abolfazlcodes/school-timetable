ALTER TABLE periods
  ADD COLUMN instructional_units integer NOT NULL DEFAULT 1;

ALTER TABLE periods
  ADD CONSTRAINT periods_instructional_units_range
  CHECK (instructional_units BETWEEN 1 AND 4);

COMMENT ON COLUMN periods.instructional_units IS
  'تعداد واحد آموزشی هفتگی قابل ارائه در این زنگ؛ مستقل از مدت واقعی زنگ بر حسب دقیقه';
