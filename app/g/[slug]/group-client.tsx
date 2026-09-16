"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { GroupData, GroupExpense, GroupSettlement } from "@/db/queries";
import { readIdentity, rememberGroup, rememberIdentity } from "@/lib/identity";
import { formatVnd } from "@/lib/split";
import { expenseSubtitle, initial, memberCount, shortWhen } from "@/lib/ui";

import { addMember, claimMember, markSettled, undoSettlement } from "../../actions";
import { AddExpenseSheet } from "./add-expense-sheet";
import { useEscape } from "./use-escape";
import { BankSheet } from "./bank-sheet";
import { ManageSheet } from "./manage-sheet";
import { QrSheet } from "./qr-sheet";

type Sheet =
  | { kind: "add" }
  | { kind: "edit"; expense: GroupExpense }
  | { kind: "qr"; toId: string; amount: number }
  | { kind: "bank"; memberId: string }
  | { kind: "menu" }
  | { kind: "manage" }
  | null;

export function GroupClient({ group }: { group: GroupData }) {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"expenses" | "balances">("expenses");
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    rememberGroup(group.slug, group.name);
  }, [group.slug, group.name]);

  useEffect(() => {
    const stored = readIdentity(group.slug);
    // Người đã rời khỏi nhóm thì id cũ không còn dùng được nữa.
    const valid = stored && group.members.some((m) => m.id === stored) ? stored : null;
    setMeId(valid);
    setReady(true);
    if (valid) void claimMember({ slug: group.slug, memberId: valid });
  }, [group.slug, group.members]);

  const nameOf = useMemo(() => {
    const map = new Map(group.members.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? "Ai đó";
  }, [group.members]);

  const memberOf = useMemo(
    () => new Map(group.members.map((m) => [m.id, m])),
    [group.members],
  );

  const myBalance = meId
    ? (group.balances.find((b) => b.memberId === meId)?.amount ?? 0)
    : 0;

  /** Người đang xem cần trả cho ai, bao nhiêu — đã gộp theo cách trả gọn nhất. */
  const myDebts = meId ? group.transfers.filter((t) => t.from === meId) : [];
  const myCredits = meId ? group.transfers.filter((t) => t.to === meId) : [];

  /**
   * Chọn nhầm tên là xem số dư của người khác và ghi khoản chi sai người.
   * Trả về trạng thái chưa chọn, màn 2 hiện lại ngay.
   */
  function forgetMe() {
    rememberIdentity(group.slug, null);
    setMeId(null);
    setSheet(null);
  }

  function choose(memberId: string) {
    rememberIdentity(group.slug, memberId);
    setMeId(memberId);
    void claimMember({ slug: group.slug, memberId });
  }

  return (
    <main className="screen">
      <header className="bar">
        <div className="min-w-0">
          <div className="gname truncate">{group.name}</div>
          <div className="sub">{memberCount(group.members.length)}</div>
        </div>
        <div className="inl gap-[6px]">
          <ShareButton slug={group.slug} />
          <button
            className="icon"
            onClick={() => setSheet({ kind: "menu" })}
            aria-label="Sửa nhóm, xem lịch sử"
          >
            ⋯
          </button>
        </div>
      </header>

      {group.balanceError && (
        <p className="warn mx-4 mt-3">
          Số dư đang lệch: {group.balanceError}. Xem lại lịch sử thay đổi giúp mình.
        </p>
      )}

      {group.expenses.length === 0 ? (
        <EmptyState slug={group.slug} onAdd={() => setSheet({ kind: "add" })} />
      ) : (
        <>
          <Hero
            ready={ready}
            meId={meId}
            balance={myBalance}
            debts={myDebts}
            credits={myCredits}
            nameOf={nameOf}
            onQr={(toId, amount) => setSheet({ kind: "qr", toId, amount })}
            mySettlements={
              meId ? group.settlements.filter((s) => s.from === meId).slice(0, 3) : []
            }
            slugForUndo={group.slug}
            hasBank={Boolean(meId && memberOf.get(meId)?.bank)}
            onMyBank={() => meId && setSheet({ kind: "bank", memberId: meId })}
            slug={group.slug}
            onSettled={() => router.refresh()}
          />

          <div className="board">
            <div className="pad">
              <div className="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === "expenses"}
                  className={tab === "expenses" ? "on" : undefined}
                  onClick={() => setTab("expenses")}
                >
                  Khoản chi
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "balances"}
                  className={tab === "balances" ? "on" : undefined}
                  onClick={() => setTab("balances")}
                >
                  Số dư cả nhóm
                </button>
              </div>
            </div>

            {tab === "expenses" ? (
              <ExpenseList
                group={group}
                meId={meId}
                nameOf={nameOf}
                onEdit={
                  meId ? (expense) => setSheet({ kind: "edit", expense }) : undefined
                }
              />
            ) : (
              <BalanceList group={group} meId={meId} nameOf={nameOf} />
            )}
          </div>

          <div className="foot mt-auto">
            <button className="btn" onClick={() => setSheet({ kind: "add" })}>
              Thêm khoản chi
            </button>
          </div>
        </>
      )}

      {/* Màn 2 — hỏi ngay lần đầu mở link. */}
      {ready && !meId && (
        <IdentitySheet group={group} onChoose={choose} onAdded={() => router.refresh()} />
      )}

      {(sheet?.kind === "add" || sheet?.kind === "edit") && meId && (
        <AddExpenseSheet
          group={group}
          meId={meId}
          editing={sheet.kind === "edit" ? sheet.expense : undefined}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}

      {sheet?.kind === "qr" && meId && (
        <QrSheet
          slug={group.slug}
          groupName={group.name}
          me={memberOf.get(meId)!}
          to={memberOf.get(sheet.toId)!}
          amount={sheet.amount}
          onClose={() => setSheet(null)}
          onSettled={() => {
            setSheet(null);
            router.refresh();
          }}
          onNeedBank={() => setSheet({ kind: "bank", memberId: sheet.toId })}
        />
      )}

      {sheet?.kind === "menu" && (
        <MenuSheet
          slug={group.slug}
          canManage={Boolean(meId)}
          meName={meId ? nameOf(meId) : null}
          onManage={() => setSheet({ kind: "manage" })}
          onSwitch={forgetMe}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "manage" && meId && (
        <ManageSheet
          group={group}
          meId={meId}
          onClose={() => setSheet(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {sheet?.kind === "bank" && meId && (
        <BankSheet
          slug={group.slug}
          meId={meId}
          member={memberOf.get(sheet.memberId)!}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

/** Bảng chọn sau nút ⋯ — chỗ để những việc hiếm làm, không chiếm chỗ ở header. */
function MenuSheet({
  slug,
  canManage,
  meName,
  onManage,
  onSwitch,
  onClose,
}: {
  slug: string;
  canManage: boolean;
  meName: string | null;
  onManage: () => void;
  onSwitch: () => void;
  onClose: () => void;
}) {
  useEscape(onClose);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Nhóm này">
        <div className="grab" />
        <div className="gap7">
          {meName && (
            <button className="opt" onClick={onSwitch}>
              Tôi không phải {meName}
            </button>
          )}
          {canManage && (
            <button className="opt" onClick={onManage}>
              Sửa tên nhóm và thành viên
            </button>
          )}
          <Link href={`/g/${slug}/history`} className="opt">
            Lịch sử thay đổi
          </Link>
          {/* Đang ở trong nhóm thì không có đường nào về trang chủ — thiếu chỗ này
              là muốn tạo nhóm mới phải tự gõ lại địa chỉ. */}
          <Link href="/" className="opt">
            Tạo nhóm mới
          </Link>
        </div>
        <p className="t12 m mt10 leading-[1.5]">
          Nhóm này vẫn mở lại được từ trang chủ, miễn là bạn dùng đúng trình duyệt này.
        </p>
        <button className="ghost block mt14" onClick={onClose}>
          Đóng
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ màn 3 */

function Hero({
  ready,
  meId,
  balance,
  debts,
  credits,
  nameOf,
  onQr,
  mySettlements,
  slugForUndo,
  hasBank,
  onMyBank,
  slug,
  onSettled,
}: {
  ready: boolean;
  meId: string | null;
  balance: number;
  debts: { to: string; amount: number }[];
  credits: { from: string; amount: number }[];
  nameOf: (id: string) => string;
  onQr: (toId: string, amount: number) => void;
  mySettlements: GroupSettlement[];
  slugForUndo: string;
  hasBank: boolean;
  onMyBank: () => void;
  slug: string;
  onSettled: () => void;
}) {
  if (!ready) {
    return (
      <div className="hero">
        <div className="skel h-[13px] w-[64px]" />
        <div className="skel h-[38px] w-[210px] mt-2" />
        <div className="skel h-[118px] w-full mt14 rounded-[12px]" />
      </div>
    );
  }

  if (!meId) return <div className="hero h-[120px]" />;

  return (
    <div className="hero">
      <div className="lbl">Bạn đang</div>
      {/* Toàn bộ sự táo bạo của sản phẩm dồn vào đúng dòng này. */}
      {balance < 0 ? (
        <div className="big neg">nợ {formatVnd(-balance)}</div>
      ) : balance > 0 ? (
        <div className="big pos">được nhận {formatVnd(balance)}</div>
      ) : (
        <div className="big">không nợ ai</div>
      )}

      {debts.length > 0 && (
        <div className="card mt14">
          {debts.map((t) => (
            <DebtRow
              key={t.to}
              slug={slug}
              meId={meId}
              toId={t.to}
              name={nameOf(t.to)}
              amount={t.amount}
              onQr={() => onQr(t.to, t.amount)}
              onSettled={onSettled}
            />
          ))}
        </div>
      )}

      {meId && mySettlements.length > 0 && (
        <div className="mt12">
          {mySettlements.map((settlement) => (
            <UndoRow
              key={settlement.id}
              slug={slugForUndo}
              meId={meId}
              settlement={settlement}
              name={nameOf(settlement.to)}
              onUndone={onSettled}
            />
          ))}
        </div>
      )}

      {debts.length === 0 && credits.length > 0 && (
        <>
          <div className="card mt14">
            {credits.map((t) => (
              <div key={t.from} className="row">
                <span className="av">{initial(nameOf(t.from))}</span>
                <div className="grow">
                  <div className="t15">{nameOf(t.from)} trả bạn</div>
                  <div className="t15 b text-[16px]">{formatVnd(t.amount)}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Người được nhận mới là người cần dán tài khoản lên — trước đây chỉ
              mở được từ sheet QR của người khác, tức là phải chờ người nợ làm hộ. */}
          <button className="ghost block mt10" onClick={onMyBank}>
            {hasBank
              ? "Sửa tài khoản nhận tiền của bạn"
              : "Thêm tài khoản để cả nhóm quét QR trả bạn"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Bấm nhầm "Đã chuyển" là ghi sai số dư của cả nhóm, nên phải gỡ lại được.
 * Để mờ và nhỏ, ngay dưới số dư — thấy được mà không tranh chỗ với nút QR.
 */
function UndoRow({
  slug,
  meId,
  settlement,
  name,
  onUndone,
}: {
  slug: string;
  meId: string;
  settlement: GroupSettlement;
  name: string;
  onUndone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function undo() {
    setError(null);
    startTransition(async () => {
      const result = await undoSettlement({
        slug,
        actorId: meId,
        settlementId: settlement.id,
      });
      if (!result.ok) setError(result.error);
      else onUndone();
    });
  }

  return (
    <div className="inl t12 m">
      <span className="grow">
        Đã chuyển {formatVnd(settlement.amount)} cho {name} · {shortWhen(settlement.createdAt)}
      </span>
      <button className="tap accent disabled:opacity-50" onClick={undo} disabled={pending}>
        {pending ? "Đang gỡ…" : "Hoàn tác"}
      </button>
      {error && <span className="t12 neg">{error}</span>}
    </div>
  );
}

function DebtRow({
  slug,
  meId,
  toId,
  name,
  amount,
  onQr,
  onSettled,
}: {
  slug: string;
  meId: string;
  toId: string;
  name: string;
  amount: number;
  onQr: () => void;
  onSettled: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function settle() {
    setError(null);
    startTransition(async () => {
      const result = await markSettled({
        slug,
        actorId: meId,
        toMemberId: toId,
        amount,
      });
      if (!result.ok) setError(result.error);
      else onSettled();
    });
  }

  return (
    <div className="row">
      <span className="av">{initial(name)}</span>
      <div className="grow">
        <div className="t15">Trả {name}</div>
        <div className="t15 b text-[16px]">{formatVnd(amount)}</div>
        {error && <div className="t12 neg mt4">{error}</div>}
      </div>
      <div className="flex flex-col gap-[5px] items-end">
        <button className="pill" onClick={onQr}>
          Quét QR
        </button>
        {/* Cố tình nhỏ và mờ: bấm nhầm là ghi sai số dư, nên nó không được
            hấp dẫn bằng nút QR. Có trạng thái đang lưu để chặn bấm hai lần. */}
        <button className="tap disabled:opacity-50" onClick={settle} disabled={pending}>
          {pending ? "Đang lưu…" : "Đã chuyển"}
        </button>
      </div>
    </div>
  );
}

function ExpenseList({
  group,
  meId,
  nameOf,
  onEdit,
}: {
  group: GroupData;
  meId: string | null;
  nameOf: (id: string) => string;
  onEdit?: (expense: GroupExpense) => void;
}) {
  return (
    <div className="list">
      {group.expenses.map((e) => (
        <button
          key={e.id}
          className="li text-left"
          onClick={() => onEdit?.(e)}
          disabled={!onEdit}
        >
          <div className="grow">
            <div className="t15">{e.title}</div>
            <div className="t12 m mt4">
              {expenseSubtitle({
                payerIds: e.payerIds,
                shareCount: e.shareCount,
                splitMode: e.splitMode,
                nameOf,
                meId,
              })}
            </div>
          </div>
          <div className="right">
            <div className="t15 b">{formatVnd(e.total)}</div>
            <div className="t12 m mt4">{shortWhen(e.spentAt)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ màn 6 */

function BalanceList({
  group,
  meId,
  nameOf,
}: {
  group: GroupData;
  meId: string | null;
  nameOf: (id: string) => string;
}) {
  return (
    <>
      <div className="list">
        {group.balances.map((b) => (
          <div key={b.memberId} className="bal">
            <span className="inl">
              <span className="av">{initial(nameOf(b.memberId))}</span>
              <span className="t15">
                {nameOf(b.memberId)}
                {b.memberId === meId && <span className="t13 m"> · bạn</span>}
              </span>
            </span>
            <span
              className={
                b.amount === 0 ? "t15 m" : b.amount < 0 ? "t15 b neg" : "t15 b pos"
              }
            >
              {formatVnd(b.amount, { sign: true })}
            </span>
          </div>
        ))}
      </div>

      {group.transfers.length > 0 && (
        <div className="card mx-4 mt14">
          <div className="p-[14px]">
            <div className="t14 b">Cách trả gọn nhất</div>
            <div className="t12 m mt4">
              {group.transfers.length} lần chuyển cho cả nhóm
            </div>
            <div className="stack mt12">
              {group.transfers.map((t, i) => (
                <div
                  key={`${t.from}-${t.to}-${i}`}
                  className={
                    t.from === meId || t.to === meId ? "inl t14 me" : "inl t14"
                  }
                >
                  <span>{nameOf(t.from)}</span>
                  <span className="m">→</span>
                  <span>{nameOf(t.to)}</span>
                  <span className="ml-auto b">{formatVnd(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ màn 7 */

function EmptyState({ slug, onAdd }: { slug: string; onAdd: () => void }) {
  return (
    // Bọc lại thành một khối: trên máy tính màn hình này là lưới hai cột, mấy
    // mảnh rời sẽ bị xếp vào các ô khác nhau.
    <div className="emptywrap">
      <div className="empty">
        <div className="blob">🧾</div>
        <div className="text-[17px] font-medium mt14">Bắt đầu với khoản đầu tiên</div>
        <p className="t14 m mt6 leading-[1.5]">
          Gửi link cho cả nhóm để ai cũng tự thêm được khoản mình đã trả.
        </p>
      </div>
      {/* Lúc nhóm vừa tạo, việc cần nhất là kéo người khác vào — nên gửi link
          là nút chính, thêm khoản chi lùi xuống thành liên kết. */}
      <div className="px-[18px] pt-5">
        <ShareLinkButton slug={slug} />
        <button className="ghost block mt12" onClick={onAdd}>
          Thêm khoản chi
        </button>
      </div>
      <CopyLinkCard slug={slug} />
    </div>
  );
}

function groupUrl(slug: string): string {
  if (typeof window === "undefined") return `/g/${slug}`;
  return `${window.location.origin}/g/${slug}`;
}

function useCopy(slug: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(groupUrl(slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return { copied, copy };
}

function ShareLinkButton({ slug }: { slug: string }) {
  const { copied, copy } = useCopy(slug);

  async function share() {
    const url = groupUrl(slug);
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // Người dùng đóng bảng chia sẻ — rơi xuống chép link.
      }
    }
    await copy();
  }

  return (
    <button className="btn" onClick={share}>
      {copied ? "Đã chép link" : "Gửi link cho cả nhóm"}
    </button>
  );
}

function ShareButton({ slug }: { slug: string }) {
  const { copied, copy } = useCopy(slug);

  async function share() {
    const url = groupUrl(slug);
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        /* rơi xuống chép link */
      }
    }
    await copy();
  }

  return (
    <button className="icon" onClick={share} aria-label="Gửi link cho cả nhóm">
      {copied ? "✓" : "↗"}
    </button>
  );
}

function CopyLinkCard({ slug }: { slug: string }) {
  const { copied, copy } = useCopy(slug);
  const [url, setUrl] = useState(`/g/${slug}`);
  useEffect(() => setUrl(groupUrl(slug).replace(/^https?:\/\//, "")), [slug]);

  return (
    <div className="card mx-[18px] mt-[22px] mb-[18px]">
      <div className="row px-[14px] py-[12px]">
        <span className="m">🔗</span>
        <span className="grow t13 m truncate">{url}</span>
        <button className="tap accent" onClick={copy}>
          {copied ? "Đã chép" : "Chép"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ màn 2 */

function IdentitySheet({
  group,
  onChoose,
  onAdded,
}: {
  group: GroupData;
  onChoose: (id: string) => void;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) {
      setError("Nhập tên của bạn");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addMember({ slug: group.slug, name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChoose(result.data.memberId);
      onAdded();
    });
  }

  return (
    <>
      <div className="scrim" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Bạn là ai trong nhóm?">
        <div className="grab" />
        <div className="text-[18px] font-medium">Bạn là ai trong nhóm?</div>
        <p className="t13 m mt4 leading-[1.5]">
          Chọn tên để xem bạn đang nợ hay được nhận.
        </p>

        {!adding ? (
          <>
            <div className="gap7 mt14">
              {group.members.map((m) => (
                <button key={m.id} className="opt" onClick={() => onChoose(m.id)}>
                  <span className="av">{initial(m.name)}</span>
                  {m.name}
                </button>
              ))}
            </div>
            <button className="ghost block mt14" onClick={() => setAdding(true)}>
              Tên tôi chưa có trong danh sách
            </button>
          </>
        ) : (
          <div className="mt14">
            <label className="lbl block" htmlFor="my-name">
              Tên của bạn
            </label>
            <input
              id="my-name"
              className="field mt6"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              maxLength={40}
              autoFocus
              autoComplete="off"
            />
            {error && <p className="warn mt12">{error}</p>}
            <button className="btn mt16" onClick={add} disabled={pending}>
              {pending ? "Đang thêm…" : "Vào nhóm"}
            </button>
            <button className="ghost block mt8" onClick={() => setAdding(false)}>
              Quay lại danh sách
            </button>
          </div>
        )}

        {error && !adding && <p className="warn mt12">{error}</p>}
      </div>
    </>
  );
}
