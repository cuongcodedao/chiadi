"use client";

import { useEffect, useState, useTransition } from "react";

import type { GroupMember } from "@/db/queries";
import { BANKS } from "@/lib/banks";
import { readBank, rememberBank } from "@/lib/identity";
import { toAsciiUpper } from "@/lib/vietqr";

import { saveBankInfo } from "../../actions";
import { useEscape } from "./use-escape";

/** Màn 9 — tài khoản nhận tiền. */
export function BankSheet({
  slug,
  meId,
  member,
  onClose,
  onSaved,
}: {
  slug: string;
  meId: string;
  member: GroupMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bankCode, setBankCode] = useState(member.bank?.code ?? BANKS[0].code);
  const [account, setAccount] = useState(member.bank?.account ?? "");
  const [holder, setHolder] = useState(member.bank?.holder ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Chỉ chính chủ mới được gợi ý sẵn số tài khoản nhớ trong máy.
  const isMe = member.id === meId;

  useEscape(onClose);

  /** Gõ xong bấm Enter là lưu — không phải rê tay xuống tận nút. */
  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !pending) save();
  }

  useEffect(() => {
    if (!isMe || member.bank) return;
    const saved = readBank();
    if (!saved) return;
    setBankCode(saved.code);
    setAccount(saved.account);
    setHolder(saved.holder);
  }, [isMe, member.bank]);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveBankInfo({
        slug,
        actorId: meId,
        memberId: member.id,
        bankCode,
        bankAccount: account,
        bankHolder: holder,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (isMe) rememberBank({ code: bankCode, account, holder });
      onSaved();
    });
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Tài khoản nhận tiền"
      >
        <div className="grab" />
        <div className="text-[17px] font-medium">Tài khoản nhận tiền</div>
        <p className="t13 m mt4 leading-[1.5]">
          Chỉ các thành viên trong nhóm nhìn thấy thông tin này.
        </p>

        <div className="mt16">
          <label className="lbl block" htmlFor="bank">
            Ngân hàng
          </label>
          <select
            id="bank"
            className="field mt6"
            onKeyDown={onKey}
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          >
            {BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>

          <label className="lbl block mt14" htmlFor="account">
            Số tài khoản
          </label>
          <input
            id="account"
            className="field mt6 tnum"
            inputMode="numeric"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={30}
            autoComplete="off"
          />

          <label className="lbl block mt14" htmlFor="holder">
            Tên chủ tài khoản
          </label>
          <input
            id="holder"
            className="field mt6"
            onKeyDown={onKey}
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            onBlur={() => setHolder((v) => toAsciiUpper(v))}
            maxLength={60}
            autoComplete="off"
          />
          <p className="t12 m mt12">Tên viết hoa, không dấu</p>

          {error && <p className="warn mt12">{error}</p>}
        </div>

        <div className="pt-[18px]">
          <button className="btn" onClick={save} disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </>
  );
}
