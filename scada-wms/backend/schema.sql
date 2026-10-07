-- SCADA Mini WMS — PostgreSQL schema (target backend for the prototype's domain model).
-- One database, every tenant row carries org_id, isolation enforced by RLS:
--   SET app.org_id = '<uuid>' at the start of each request transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE plan_code      AS ENUM ('start', 'seller', 'pro');
CREATE TYPE user_role      AS ENUM ('owner', 'storekeeper');
CREATE TYPE location_type  AS ENUM ('cell', 'container');
CREATE TYPE movement_type  AS ENUM ('receipt', 'move', 'pick', 'pack', 'ship', 'adjust');
CREATE TYPE order_status   AS ENUM ('new', 'to_pick', 'picking', 'picked', 'packed', 'shipped');
CREATE TYPE sales_channel  AS ENUM ('manual', 'site', 'wb', 'ozon', 'ym');

CREATE TABLE organization (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  plan            plan_code NOT NULL DEFAULT 'start',
  trial_ends_at   timestamptz,
  settings        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  name            text NOT NULL,
  email           citext,
  password_hash   text,
  role            user_role NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE warehouse (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organization(id),
  name      text NOT NULL,
  address   text NOT NULL DEFAULT ''
);

CREATE TABLE zone (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  warehouse_id  uuid NOT NULL REFERENCES warehouse(id),
  code          text NOT NULL,
  name          text NOT NULL,
  UNIQUE (warehouse_id, code)
);

CREATE TABLE cell (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  warehouse_id  uuid NOT NULL REFERENCES warehouse(id),
  zone_id       uuid NOT NULL REFERENCES zone(id),
  code          text NOT NULL,                       -- A-01-03, printed in the QR
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, code)
);

CREATE TABLE product (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  name          text NOT NULL,
  article       text NOT NULL DEFAULT '',
  sku           text NOT NULL,
  brand         text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT '',
  unit          text NOT NULL DEFAULT 'шт',
  weight_g      integer,
  size          text,
  color         text,
  photo_url     text,
  marketplace   jsonb NOT NULL DEFAULT '{}',          -- {"wb": nmID, "ozon": offer_id, "ym": offerId}
  archived      boolean NOT NULL DEFAULT false,      -- never hard-delete a product with history
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, sku)
);
CREATE INDEX product_search ON product USING gin ((name || ' ' || sku || ' ' || article) gin_trgm_ops);

CREATE TABLE product_barcode (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organization(id),
  product_id  uuid NOT NULL REFERENCES product(id),
  code        text NOT NULL,
  UNIQUE (org_id, code)                                  -- one barcode → one product per tenant
);

CREATE TABLE container (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organization(id),
  code      text NOT NULL,                             -- BOX-0001 or ORD-1582
  order_id  uuid,                                      -- FK added below
  UNIQUE (org_id, code)
);

-- Source of truth for stock: what, where, how much. Changed only together with stock_movement.
CREATE TABLE stock_balance (
  org_id         uuid NOT NULL REFERENCES organization(id),
  product_id     uuid NOT NULL REFERENCES product(id),
  location_type  location_type NOT NULL,
  location_id    uuid NOT NULL,
  qty            integer NOT NULL CHECK (qty >= 0),
  reserved       integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= qty),
  PRIMARY KEY (org_id, product_id, location_type, location_id)
);
CREATE INDEX stock_by_location ON stock_balance (org_id, location_type, location_id);

CREATE TABLE stock_movement (
  id             uuid PRIMARY KEY,                      -- = client op id → idempotent replay from the outbox
  org_id         uuid NOT NULL REFERENCES organization(id),
  ts             timestamptz NOT NULL DEFAULT now(),
  user_id        uuid NOT NULL REFERENCES app_user(id),
  type           movement_type NOT NULL,
  product_id     uuid NOT NULL REFERENCES product(id),
  qty            integer NOT NULL CHECK (qty > 0),
  from_type      location_type,
  from_id        uuid,
  to_type        location_type,
  to_id          uuid,
  doc_type       text,                                  -- order | receipt | inventory
  doc_id         uuid,
  note           text
);
CREATE INDEX movement_journal ON stock_movement (org_id, ts DESC);
CREATE INDEX movement_product ON stock_movement (org_id, product_id, ts DESC);

CREATE TABLE sales_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  number        text NOT NULL,
  channel       sales_channel NOT NULL DEFAULT 'manual',
  external_id   text,                                   -- marketplace order / assembly task id
  status        order_status NOT NULL DEFAULT 'new',
  customer      text NOT NULL DEFAULT '',
  picker_id     uuid REFERENCES app_user(id),
  packer_id     uuid REFERENCES app_user(id),
  container_id  uuid REFERENCES container(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, number),
  UNIQUE (org_id, channel, external_id)
);
CREATE INDEX order_queue ON sales_order (org_id, status, created_at);
ALTER TABLE container ADD FOREIGN KEY (order_id) REFERENCES sales_order(id);

CREATE TABLE order_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organization(id),
  order_id    uuid NOT NULL REFERENCES sales_order(id),
  product_id  uuid NOT NULL REFERENCES product(id),
  qty         integer NOT NULL CHECK (qty > 0),
  picked_qty  integer NOT NULL DEFAULT 0,
  packed_qty  integer NOT NULL DEFAULT 0
);

CREATE TABLE order_event (
  id        bigserial PRIMARY KEY,
  org_id    uuid NOT NULL REFERENCES organization(id),
  order_id  uuid NOT NULL REFERENCES sales_order(id),
  ts        timestamptz NOT NULL DEFAULT now(),
  user_id   uuid REFERENCES app_user(id),
  text      text NOT NULL
);

CREATE TABLE picking_task (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  order_id      uuid NOT NULL REFERENCES sales_order(id),
  status        text NOT NULL DEFAULT 'open',           -- open | in_progress | done
  assignee_id   uuid REFERENCES app_user(id),
  container_id  uuid REFERENCES container(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pick_line (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organization(id),
  task_id        uuid NOT NULL REFERENCES picking_task(id),
  order_item_id  uuid NOT NULL REFERENCES order_item(id),
  product_id     uuid NOT NULL REFERENCES product(id),
  cell_id        uuid NOT NULL REFERENCES cell(id),
  qty            integer NOT NULL CHECK (qty > 0),
  picked_qty     integer NOT NULL DEFAULT 0,
  seq            integer NOT NULL                        -- route order
);

CREATE TABLE receipt (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organization(id),
  number      text NOT NULL,
  supplier    text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'expected',          -- expected | in_progress | done
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, number)
);

CREATE TABLE receipt_line (
  org_id        uuid NOT NULL REFERENCES organization(id),
  receipt_id    uuid NOT NULL REFERENCES receipt(id),
  product_id    uuid NOT NULL REFERENCES product(id),
  expected_qty  integer NOT NULL DEFAULT 0,
  received_qty  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (receipt_id, product_id)
);

CREATE TABLE inventory_session (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organization(id),
  user_id      uuid NOT NULL REFERENCES app_user(id),
  status       text NOT NULL DEFAULT 'open',
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE TABLE inventory_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  session_id    uuid NOT NULL REFERENCES inventory_session(id),
  cell_id       uuid NOT NULL REFERENCES cell(id),
  product_id    uuid NOT NULL REFERENCES product(id),
  expected_qty  integer NOT NULL,
  counted_qty   integer NOT NULL
);

-- Background jobs without Redis/Kafka: workers poll with FOR UPDATE SKIP LOCKED.
CREATE TABLE job (
  id          bigserial PRIMARY KEY,
  org_id      uuid REFERENCES organization(id),
  kind        text NOT NULL,                              -- import.products, marketplace.sync, …
  payload     jsonb NOT NULL,
  run_at      timestamptz NOT NULL DEFAULT now(),
  attempts    integer NOT NULL DEFAULT 0,
  done_at     timestamptz,
  error       text
);
CREATE INDEX job_due ON job (run_at) WHERE done_at IS NULL;

-- Tenant isolation
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_user','warehouse','zone','cell','product','product_barcode','container',
    'stock_balance','stock_movement','sales_order','order_item','order_event','picking_task','pick_line',
    'receipt','receipt_line','inventory_session','inventory_line']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING (org_id = current_setting(''app.org_id'')::uuid)', t);
  END LOOP;
END $$;
