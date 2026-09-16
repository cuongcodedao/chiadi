-- ChiaDi — DDL gốc. File này là nguồn chuẩn của lược đồ, db/schema.ts chỉ soi lại.
--   psql $DATABASE_URL -f db/schema.sql
--
-- Bất biến quan trọng nhất nằm ở cuối file: assert_expense_balanced.
-- Mọi cột tiền là bigint, đơn vị đồng, không bao giờ có phần thập phân.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- nhóm
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  -- Slug chính là mật khẩu. Không endpoint nào được liệt kê cột này.
  slug        text        not null unique,
  name        text        not null check (length(btrim(name)) > 0),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- thành viên
create table if not exists members (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        not null references groups(id) on delete cascade,
  name         text        not null check (length(btrim(name)) > 0),
  -- Thứ tự ổn định. splitByUnits phá hòa phần lẻ theo vị trí, nên thứ tự này
  -- quyết định ai chịu đồng lẻ — nó phải cố định, không được sắp lại theo tên.
  sort_order   integer     not null,

  -- Tài khoản nhận tiền (màn 9). Quan hệ 1-1 với thành viên nên để thẳng ở đây,
  -- không tách bảng riêng.
  bank_code    text,
  bank_account text,
  bank_holder  text,

  created_at   timestamptz not null default now(),
  unique (group_id, sort_order)
);

create index if not exists members_group_idx on members (group_id, sort_order);

-- ---------------------------------------------------------------- khoản chi
create table if not exists expenses (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references groups(id) on delete cascade,
  title       text        not null check (length(btrim(title)) > 0),
  total       bigint      not null check (total > 0),
  split_mode  text        not null check (split_mode in ('equal', 'manual', 'units')),
  -- actorId do client gửi, server KHÔNG xác minh được. Đây là cái giá của việc
  -- bỏ đăng nhập. Bù lại bằng bảng activities.
  created_by  uuid        references members(id) on delete set null,
  spent_at    timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Xóa mềm. computeBalances không biết khái niệm xóa — người gọi phải lọc trước.
  deleted_at  timestamptz
);

create index if not exists expenses_group_idx
  on expenses (group_id, spent_at desc)
  where deleted_at is null;

-- Ai bỏ tiền ra.
create table if not exists expense_payers (
  expense_id uuid   not null references expenses(id) on delete cascade,
  member_id  uuid   not null references members(id)  on delete cascade,
  amount     bigint not null check (amount > 0),
  primary key (expense_id, member_id)
);

-- Ai hưởng, đã tính sẵn thành tiền. Không bao giờ lưu tỷ lệ rồi tính lúc render:
-- 100.000đ chia 3 không chia hết, ai chịu đồng lẻ phải chốt ngay lúc ghi.
-- Cho phép 0đ để giữ lại danh sách người được chọn (chia tay, có người phần 0).
create table if not exists expense_shares (
  expense_id uuid   not null references expenses(id) on delete cascade,
  member_id  uuid   not null references members(id)  on delete cascade,
  amount     bigint not null check (amount >= 0),
  -- Số suất, chỉ có nghĩa khi split_mode = 'units'. Tiền vẫn là amount ở trên —
  -- cột này chỉ để mở khoản chi ra sửa thì thấy lại đúng số suất đã gõ.
  units      integer check (units is null or units >= 0),
  primary key (expense_id, member_id)
);

-- Cho database đã tạo trước khi có cột này.
alter table expense_shares add column if not exists units integer;

create index if not exists expense_shares_member_idx on expense_shares (member_id);
create index if not exists expense_payers_member_idx on expense_payers (member_id);

-- ---------------------------------------------------------------- đã chuyển
create table if not exists settlements (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references groups(id) on delete cascade,
  from_member uuid        not null references members(id) on delete cascade,
  to_member   uuid        not null references members(id) on delete cascade,
  amount      bigint      not null check (amount > 0),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (from_member <> to_member)
);

create index if not exists settlements_group_idx
  on settlements (group_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------- lịch sử
-- Thứ dập tắt tranh cãi, và là thứ bù lại cho việc không xác minh được actorId.
-- Ghi mọi thao tác, kể cả giá trị cũ và mới khi có người sửa (màn 10).
create table if not exists activities (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references groups(id) on delete cascade,
  actor_id   uuid        references members(id) on delete set null,
  kind       text        not null check (kind in (
                'group_created', 'group_renamed',
                'member_added', 'member_joined', 'member_renamed', 'member_removed',
                'expense_added', 'expense_edited', 'expense_deleted',
                'settled', 'settle_undone', 'bank_saved')),
  -- Tên người thao tác, chụp lại lúc ghi. Giao diện tự thay bằng "Bạn" khi
  -- actor_id trùng người đang xem, nên summary KHÔNG chứa tên người thao tác.
  actor_name text,
  -- Vị ngữ tiếng Việt dựng sẵn lúc ghi: "thêm khoản Cà phê sáng · 165.000đ".
  -- Dựng sẵn để lịch sử không đổi nghĩa khi tiêu đề khoản chi bị sửa về sau.
  summary    text        not null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

-- Cho database đã tạo trước khi có cột này.
alter table activities add column if not exists actor_name text;

-- Và cho database tạo trước khi có ba loại hoạt động mới.
alter table activities drop constraint if exists activities_kind_check;
alter table activities add constraint activities_kind_check check (kind in (
  'group_created', 'group_renamed',
  'member_added', 'member_joined', 'member_renamed', 'member_removed',
  'expense_added', 'expense_edited', 'expense_deleted',
  'settled', 'settle_undone', 'bank_saved'));

create index if not exists activities_group_idx on activities (group_id, created_at desc);

-- ---------------------------------------------------------------- bất biến 2
-- Bản sao ở tầng ứng dụng là validateExpense() trong lib/split.ts.
-- Giữ CẢ HAI: bản kia để báo lỗi cho người dùng bằng tiếng Việt,
-- bản này là thứ không thể lách kể cả khi ai đó gọi thẳng vào database.
--
-- Trigger là CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED: các dòng payer và
-- share được chèn lần lượt, nên phép kiểm chỉ có nghĩa ở thời điểm commit.
create or replace function assert_expense_balanced() returns trigger
language plpgsql as $$
declare
  v_expense_id uuid;
  v_total      bigint;
  v_paid       bigint;
  v_shared     bigint;
begin
  if tg_table_name = 'expenses' then
    v_expense_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_expense_id := case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  end if;

  select total into v_total from expenses where id = v_expense_id;

  -- Khoản chi bị xóa cứng trong cùng transaction thì không còn gì để kiểm.
  if v_total is null then
    return null;
  end if;

  select coalesce(sum(amount), 0) into v_paid   from expense_payers where expense_id = v_expense_id;
  select coalesce(sum(amount), 0) into v_shared from expense_shares where expense_id = v_expense_id;

  if v_paid <> v_total then
    raise exception
      'Khoản chi % lệch: tổng người trả % khác tổng khoản chi %',
      v_expense_id, v_paid, v_total;
  end if;

  if v_shared <> v_total then
    raise exception
      'Khoản chi % lệch: tổng chia % khác tổng khoản chi %',
      v_expense_id, v_shared, v_total;
  end if;

  return null;
end;
$$;

drop trigger if exists expenses_balanced        on expenses;
drop trigger if exists expense_payers_balanced  on expense_payers;
drop trigger if exists expense_shares_balanced  on expense_shares;

create constraint trigger expenses_balanced
  after insert or update of total on expenses
  deferrable initially deferred
  for each row execute function assert_expense_balanced();

create constraint trigger expense_payers_balanced
  after insert or update or delete on expense_payers
  deferrable initially deferred
  for each row execute function assert_expense_balanced();

create constraint trigger expense_shares_balanced
  after insert or update or delete on expense_shares
  deferrable initially deferred
  for each row execute function assert_expense_balanced();
