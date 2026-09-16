"use client";

import { useMemo, useState, useTransition } from "react";

import type { GroupData, GroupExpense } from "@/db/queries";
import { formatVnd, parseVnd, splitByUnits, splitEqual } from "@/lib/split";

import { addExpense, deleteExpense, editExpense } from "../../actions";
import { useEscape } from "./use-escape";

type Mode = "equal" | "manual" | "units";

/** `2026-09-16` theo giờ máy người dùng — input[type=date] chỉ nhận dạng này. */
function dateInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Giữ nguyên giờ phút cũ khi người dùng không đụng vào ngày — sửa tên khoản chi
 * không có lý do gì làm xáo trộn thứ tự danh sách.
 */
function spentAtFrom(value: string, previousIso?: string): Date {
  const previous = previousIso ? new Date(previousIso) : new Date();
  if (value === dateInputValue(previousIso)) return previous;
  const [y, m, d] = value.split("-").map(Number);
  const picked = new Date(previous);
  picked.setFullYear(y, m - 1, d);
  return picked;
}

/**
 * Màn 4 và 5 — thêm khoản chi, và cũng là màn sửa khoản chi.
 * Mục tiêu: nhập xong một khoản dưới 15 giây.
 *
 * Số tiền client tính ra chỉ để xem trước; server tự chia lại bằng cùng
 * lib/split.ts nên hai bên luôn ra một kết quả.
 */
export function AddExpenseSheet({
  group,
  meId,
  editing,
  onClose,
  onSaved,
}: {
  group: GroupData;
  meId: string;
  /** Có giá trị thì sheet chuyển sang chế độ sửa. */
  editing?: GroupExpense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialParticipants = editing
    ? group.members.map((m) => m.id).filter((id) => id in editing.shares)
    : group.members.map((m) => m.id);

  const [amountText, setAmountText] = useState(
    editing ? editing.total.toLocaleString("vi-VN") : "",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  // Nhập bù lúc tối thì ngày phải chỉnh được, không thì khoản nào cũng là hôm nay.
  const [spentOn, setSpentOn] = useState(() => dateInputValue(editing?.spentAt));
  const [payerIds, setPayerIds] = useState<string[]>(
    editing ? Object.keys(editing.payers) : [meId],
  );
  const [multiPayer, setMultiPayer] = useState(
    editing ? Object.keys(editing.payers).length > 1 : false,
  );
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() =>
    editing
      ? Object.fromEntries(
          Object.entries(editing.payers).map(([id, v]) => [
            id,
            v.toLocaleString("vi-VN"),
          ]),
        )
      : {},
  );
  const [participants, setParticipants] = useState<string[]>(initialParticipants);
  const [mode, setMode] = useState<Mode>(editing ? editing.splitMode : "equal");
  const [manual, setManual] = useState<Record<string, string>>(() =>
    editing
      ? Object.fromEntries(
          Object.entries(editing.shares).map(([id, v]) => [
            id,
            v.toLocaleString("vi-VN"),
          ]),
        )
      : {},
  );
  const [units, setUnits] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      group.members.map((m) => [m.id, editing?.units?.[m.id] ?? 1]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEscape(onClose);

  /** Enter ở hai ô gõ tay: đủ điều kiện thì lưu luôn. */
  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Enter" && canSave && !pending) save();
  }

  const total = parseVnd(amountText) ?? 0;

  const payers: Record<string, number> = useMemo(() => {
    if (!multiPayer) {
      return payerIds[0] && total > 0 ? { [payerIds[0]]: total } : {};
    }
    const out: Record<string, number> = {};
    for (const id of payerIds) {
      const value = parseVnd(payerAmounts[id] ?? "");
      if (value && value > 0) out[id] = value;
    }
    return out;
  }, [multiPayer, payerIds, payerAmounts, total]);

  const paidSum = Object.values(payers).reduce((a, b) => a + b, 0);

  /** Xem trước phần chia — cùng thuật toán server sẽ chạy. */
  const shares: Record<string, number> = useMemo(() => {
    if (total <= 0) return {};
    const ordered = group.members.map((m) => m.id);
    try {
      if (mode === "equal") {
        const chosen = ordered.filter((id) => participants.includes(id));
        return chosen.length ? splitEqual(total, chosen) : {};
      }
      if (mode === "units") {
        const chosen = ordered.filter((id) => participants.includes(id));
        const picked = Object.fromEntries(chosen.map((id) => [id, units[id] ?? 0]));
        const sum = Object.values(picked).reduce((a, b) => a + b, 0);
        return sum > 0 ? splitByUnits(total, picked, chosen) : {};
      }
      const out: Record<string, number> = {};
      for (const id of participants) out[id] = parseVnd(manual[id] ?? "") ?? 0;
      return out;
    } catch {
      return {};
    }
  }, [total, mode, participants, units, manual, group.members]);

  const sharedSum = Object.values(shares).reduce((a, b) => a + b, 0);
  const shortfall = total - sharedSum;

  const payersBalanced = total > 0 && paidSum === total;
  const sharesBalanced = total > 0 && shortfall === 0;
  const canSave =
    total > 0 && title.trim().length > 0 && payersBalanced && sharesBalanced;

  function togglePayer(id: string) {
    if (!multiPayer) {
      setPayerIds([id]);
      return;
    }
    setPayerIds((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  function toggleParticipant(id: string) {
    setParticipants((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const split =
        mode === "equal"
          ? ({ mode: "equal", participants } as const)
          : mode === "units"
            ? ({
                mode: "units",
                units: Object.fromEntries(
                  participants.map((id) => [id, units[id] ?? 0]),
                ),
              } as const)
            : ({ mode: "manual", shares } as const);

      const body = { title, total, payers, split, spentAt: spentAtFrom(spentOn, editing?.spentAt) };
      const result = editing
        ? await editExpense({
            slug: group.slug,
            actorId: meId,
            expenseId: editing.id,
            expense: body,
          })
        : await addExpense({ slug: group.slug, actorId: meId, expense: body });

      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  function remove() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteExpense({
        slug: group.slug,
        actorId: meId,
        expenseId: editing.id,
      });
      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Sửa khoản chi" : "Thêm khoản chi"}
      >
        <div className="grab" />
        <div className="flex justify-between items-center">
          <span className="text-[17px] font-medium">
            {editing ? "Sửa khoản chi" : "Thêm khoản chi"}
          </span>
          <button className="m text-[18px] px-2" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="mt16">
          <label className="lbl block" htmlFor="amount">
            Số tiền
          </label>
          {/* Bấm vào khoảng trống cạnh chữ số vẫn phải vào được ô nhập. */}
          <div
            className={total > 0 ? "amt mt4" : "amt idle mt4"}
            onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
          >
            {/* Ô co theo nội dung để chữ "đ" bám ngay sau chữ số, như bản dựng:
                bản sao ẩn trong .amtfield giữ bề rộng, size={1} để cỡ mặc định
                của input không chiếm chỗ. */}
            <span className="amtfield" data-value={amountText || "0"}>
              <input
                id="amount"
                className="w-full bg-transparent outline-none tnum"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => {
                  const parsed = parseVnd(e.target.value);
                  setAmountText(
                    e.target.value.trim() === ""
                      ? ""
                      : parsed === null
                        ? e.target.value
                        : parsed.toLocaleString("vi-VN"),
                  );
                }}
                placeholder="0"
                onKeyDown={onKey}
                size={1}
                autoFocus
                autoComplete="off"
              />
            </span>
            <span className="amtunit">đ</span>
          </div>

          <input
            className="field mt14"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ăn tối quán nướng"
            maxLength={80}
            autoComplete="off"
            aria-label="Tên khoản chi"
          />

          <div className="inl mt10">
            <label className="lbl grow" htmlFor="spent-on">
              Ngày chi
            </label>
            <input
              id="spent-on"
              type="date"
              className="field w-auto"
              value={spentOn}
              max={dateInputValue()}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </div>

          <div className="lbl mt16">Ai trả?</div>
          <div className="chips mt8">
            {group.members.map((m) => (
              <button
                key={m.id}
                className={payerIds.includes(m.id) ? "chip on" : "chip"}
                onClick={() => togglePayer(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
          {/* Ô đánh dấu, không phải liên kết: đây là một chế độ đang bật hay tắt,
              nhìn vào phải biết ngay mình đang ở chế độ nào. */}
          <label className="check mt8">
            <input
              type="checkbox"
              checked={multiPayer}
              onChange={(e) => {
                setMultiPayer(e.target.checked);
                if (!e.target.checked) {
                  setPayerIds([payerIds[0] ?? meId]);
                  return;
                }
                // Vừa bật lên thì người đang trả vẫn đang trả cả khoản — gán sẵn
                // để không đập ngay vào mặt một hộp báo lệch màu đỏ.
                const first = payerIds[0] ?? meId;
                setPayerAmounts((prev) =>
                  prev[first] ? prev : { ...prev, [first]: amountText },
                );
              }}
            />
            Nhiều người cùng trả
          </label>

          {multiPayer && (
            <div className="stack mt12">
              {payerIds.map((id) => (
                <div key={id} className="inl">
                  <span className="grow t15">
                    {group.members.find((m) => m.id === id)?.name}
                  </span>
                  <span className="num tnum">
                    <input
                      inputMode="numeric"
                      value={payerAmounts[id] ?? ""}
                      onChange={(e) =>
                        setPayerAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      placeholder="0"
                      aria-label={`Số tiền ${group.members.find((m) => m.id === id)?.name} đã trả`}
                    />
                    <span className="unit">đ</span>
                  </span>
                </div>
              ))}
              {total > 0 && paidSum !== total && (
                <div className="warn">
                  {paidSum < total
                    ? `Người trả còn thiếu ${formatVnd(total - paidSum)}`
                    : `Người trả thừa ${formatVnd(paidSum - total)}`}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt16">
            <span className="lbl">Chia cho ai?</span>
            <button
              className="tap accent"
              onClick={() =>
                setParticipants((list) =>
                  list.length === group.members.length
                    ? []
                    : group.members.map((m) => m.id),
                )
              }
            >
              {participants.length === group.members.length
                ? "Bỏ chọn tất cả"
                : "Chọn tất cả"}
            </button>
          </div>
          <div className="chips mt8">
            {group.members.map((m) => (
              <button
                key={m.id}
                className={participants.includes(m.id) ? "chip sel" : "chip"}
                onClick={() => toggleParticipant(m.id)}
              >
                {participants.includes(m.id) ? `✓ ${m.name}` : m.name}
              </button>
            ))}
          </div>

          <div className="tabs mt16" role="tablist">
            {(
              [
                ["equal", "Chia đều"],
                ["manual", "Nhập tay"],
                ["units", "Theo suất"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? "on" : undefined}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "equal" && (
            <p className="center t13 m mt10">
              {total > 0 && participants.length > 0
                ? `Mỗi người ${formatVnd(Math.floor(total / participants.length))}${
                    total % participants.length ? " (lẻ vài đồng)" : ""
                  }`
                : "Chọn người và nhập số tiền"}
            </p>
          )}

          {mode === "manual" && (
            <div className="stack mt12">
              {group.members
                .filter((m) => participants.includes(m.id))
                .map((m) => (
                  <div key={m.id} className="inl">
                    <span className="grow t15">{m.name}</span>
                    <span className="num tnum">
                      <input
                        inputMode="numeric"
                        value={manual[m.id] ?? ""}
                        onChange={(e) =>
                          setManual((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="0"
                        aria-label={`Phần của ${m.name}`}
                      />
                      <span className="unit">đ</span>
                    </span>
                  </div>
                ))}
              {total > 0 && shortfall !== 0 && (
                <div className="warn">
                  {shortfall > 0
                    ? `Còn thiếu ${formatVnd(shortfall)} chưa chia`
                    : `Đã chia thừa ${formatVnd(-shortfall)}`}
                </div>
              )}
            </div>
          )}

          {mode === "units" && (
            <div className="stack mt12">
              {group.members
                .filter((m) => participants.includes(m.id))
                .map((m) => (
                  <div key={m.id} className="inl">
                    <span className="grow t15">{m.name}</span>
                    {/* Luôn là số tiền, kể cả khi bằng 0: dấu gạch "—" đứng ngay
                        cạnh nút bớt suất trông hệt một cái nút thứ hai. */}
                    <span className="t13 m tnum text-right">
                      {formatVnd(shares[m.id] ?? 0)}
                    </span>
                    <div className="stepper">
                      <button
                        className="step"
                        aria-label={`Bớt suất của ${m.name}`}
                        onClick={() =>
                          setUnits((u) => ({
                            ...u,
                            [m.id]: Math.max(0, (u[m.id] ?? 0) - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="count tnum">{units[m.id] ?? 0}</span>
                      <button
                        className="step"
                        aria-label={`Thêm suất cho ${m.name}`}
                        onClick={() =>
                          setUnits((u) => ({
                            ...u,
                            [m.id]: Math.min(100, (u[m.id] ?? 0) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {error && <p className="warn mt12">{error}</p>}
        </div>

        <div className="pt-4">
          <button className="btn" onClick={save} disabled={!canSave || pending}>
            {pending ? "Đang lưu…" : "Lưu khoản chi"}
          </button>

          {editing &&
            (confirmDelete ? (
              <div className="mt12">
                <p className="t13 m center">
                  Xóa khoản này thì số dư cả nhóm đổi theo. Lịch sử vẫn giữ lại.
                </p>
                <div className="inl mt8">
                  <button
                    className="ghost block"
                    onClick={() => setConfirmDelete(false)}
                    disabled={pending}
                  >
                    Giữ lại
                  </button>
                  <button
                    className="ghost block neg"
                    onClick={remove}
                    disabled={pending}
                  >
                    {pending ? "Đang xóa…" : "Xóa hẳn"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="ghost block neg mt10"
                onClick={() => setConfirmDelete(true)}
              >
                Xóa khoản chi
              </button>
            ))}
        </div>
      </div>
    </>
  );
}
