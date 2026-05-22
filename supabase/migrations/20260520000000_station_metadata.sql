-- =================================================================
-- Migration: station_metadata
-- Adds DB-backed `protected` and `station_group` columns to stations,
-- and backfills them from the values previously sourced from mockStations
-- at runtime. Additive only; safe to re-run.
-- =================================================================

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS protected boolean NOT NULL DEFAULT false;

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS station_group text;


-- =================================================================
-- Backfill: protected supervisors
-- =================================================================
UPDATE stations SET protected = true
WHERE id IN (
  'st_loading_supervisor',
  'st_small_supervisor',
  'st_proc_supervisor',
  'st_meat_supervisor',
  'st_supervisor',
  'st_ahb_meat_supervisor',
  'st_ahb_supervisor'
);


-- =================================================================
-- Backfill: station_group
-- =================================================================

-- Loading Dock
UPDATE stations SET station_group = 'Operations'
WHERE id IN ('st_loading_helper_1', 'st_loading_hogselector');

UPDATE stations SET station_group = 'Support'
WHERE id IN ('st_loading_cooler', 'st_loading_maps_helper');

UPDATE stations SET station_group = 'Helpers'
WHERE id IN (
  'st_loading_helper_2',
  'st_loading_helper_3',
  'st_loading_helper_4',
  'st_loading_helper_5',
  'st_loading_helper_6'
);

-- Small Pro
UPDATE stations SET station_group = 'Slabs'
WHERE id IN (
  'st_small_slab_off',
  'st_small_slab_on',
  'st_small_slab_garlic',
  'st_small_slab_jalapeno',
  'st_small_slab_maple',
  'st_small_slab_nna',
  'st_small_slab_sugar_free'
);

UPDATE stations SET station_group = 'Specialty Cuts'
WHERE id IN (
  'st_small_euro',
  'st_small_sandwich',
  'st_small_jowl',
  'st_small_back_rib',
  'st_small_spare_rib'
);

UPDATE stations SET station_group = 'Other'
WHERE id IN (
  'st_small_banquet',
  'st_small_kaiser',
  'st_small_custom'
);

-- Processing Floor
UPDATE stations SET station_group = 'Set Up'
WHERE id IN (
  'st_proc_barn_setup',
  'st_proc_blood_pit',
  'st_proc_clean_side',
  'st_proc_blood_setup',
  'st_proc_suckling_tank'
);

UPDATE stations SET station_group = 'Operations'
WHERE id IN ('st_proc_rollers_gams', 'st_proc_bone_heads');

-- Meat Cutting (Hog Break + After Hog Break) - Main Room
UPDATE stations SET station_group = 'Main Room'
WHERE id IN (
  'st_meat_saw',
  'st_meat_neck_bones',
  'st_meat_proof',
  'st_meat_skinner',
  'st_meat_whiz_knife',
  'st_meat_picnic_1',
  'st_meat_picnic_2',
  'st_meat_rib_1',
  'st_meat_rib_2',
  'st_meat_loin_trim',
  'st_meat_loin_butt',
  'st_meat_butt_trim',
  'st_meat_small_saw',
  'st_meat_float',
  'st_ahb_meat_saw',
  'st_ahb_meat_proof',
  'st_ahb_meat_skinner',
  'st_ahb_meat_picnic',
  'st_ahb_meat_rib',
  'st_ahb_meat_loin_trim',
  'st_ahb_meat_loin_butt',
  'st_ahb_meat_butt_trim',
  'st_ahb_meat_small_saw',
  'st_ahb_meat_cleanup'
);

-- Meat Cutting - Bellies
UPDATE stations SET station_group = 'Bellies'
WHERE id IN (
  'st_meat_bellies_1',
  'st_meat_bellies_2',
  'st_meat_bellies_3',
  'st_meat_bellies_4',
  'st_ahb_meat_bellies_1',
  'st_ahb_meat_bellies_2',
  'st_ahb_meat_bellies_3'
);

-- Meat Cutting - Cutting Room
UPDATE stations SET station_group = 'Cutting Room'
WHERE id IN (
  'st_meat_cr_proof',
  'st_meat_cr_1',
  'st_meat_cr_2',
  'st_ahb_meat_cr_1',
  'st_ahb_meat_cr_2',
  'st_ahb_meat_wash'
);

-- Packaging - Main Room
UPDATE stations SET station_group = 'Main Room'
WHERE id IN (
  'st_lead',
  'st_feed',
  'st_end',
  'st_pack_box_trim',
  'st_pack_dump_barrels',
  'st_pack_bellie',
  'st_pack_floater',
  'st_pack_overstock',
  'st_pack_offal',
  'st_pack_sungiven',
  'st_ahb_lead',
  'st_ahb_feed',
  'st_ahb_end',
  'st_ahb_pack_bellie',
  'st_ahb_pack_floater',
  'st_ahb_pack_offal',
  'st_ahb_pack_vac_pac',
  'st_ahb_pack_vac_box'
);

-- Packaging - Downstairs
UPDATE stations SET station_group = 'Downstairs'
WHERE id IN (
  'st_pack_downstairs_lead',
  'st_pack_vac_pac_bag',
  'st_pack_vac_pac_box',
  'st_pack_forklift',
  'st_ahb_pack_downstairs',
  'st_ahb_pack_sungiven',
  'st_ahb_pack_cleanup',
  'st_ahb_pack_forklift'
);
