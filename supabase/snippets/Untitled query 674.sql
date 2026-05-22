SELECT id, protected, station_group
FROM stations
WHERE protected = true OR station_group IS NOT NULL
ORDER BY work_area_id, display_order;