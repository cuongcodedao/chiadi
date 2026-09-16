"use client";

import { useState, useTransition } from "react";

import type { GroupMember } from "@/db/queries";
import { bankAppLink, bankName } from "@/lib/banks";
import { formatVnd, parseVnd } from "@/lib/split";
import { transferMemo, vietQrImageUrl } from "@/lib/vietqr";

import { markSettled } from "../../actions";
import { useEscape } from "./use-escape";

/**
 * Màn 8 — mã QR chuyển khoản.
 * Người dùng nghĩ theo đơn vị "trả Minh", không phải "thanh toán", nên sheet này
 * luôn gắn với đúng một người nhận.
 */
export function QrSheet({
  slug,
  groupName,
  me,
  to,
  amount,
  onClose,
  onSettled,
  onNeedBank,
}: {
  slug: string;
  groupName: string;
  me: GroupMember;
  to: GroupMember;
  amount: number;
  onClose: () => void;
  onSettled: () => void;
  onNeedBank: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Trả trước một phần là chuyện thường: đưa 200k trong khoản nợ 530k.
  const [partial, setPartial] = useState(false);
  const [partialText, setPartialText] = useState(amount.toLocaleString("vi-VN"));

  useEscape(onClose);

  const paying = partial ? (parseVnd(partialText) ?? 0) : amount;
  const payingValid = paying > 0 && paying <= amount;

  const memo = transferMemo(groupName, me.name);
  const appLink = to.bank ? bankAppLink(to.bank.code) : null;
  const qrUrl = to.bank && payingValid
    ? vietQrImageUrl({
        bank: {
          bankCode: to.bank.code,
          bankAccount: to.bank.account,
          bankHolder: to.bank.holder,
        },
        amount: paying,
        memo,
      })
    : null;

  function settle() {
    setError(null);
    startTransition(async () => {
      const result = await markSettled({
        slug,
        actorId: me.id,
        toMemberId: to.id,
        amount: paying,
      });
      if (!result.ok) setError(result.error);
      else onSettled();
    });
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet center"
        role="dialog"
        aria-modal="true"
        aria-label={`Chuyển cho ${to.name}`}
      >
        <div className="grab" />
        <div className="t13 m">Chuyển cho {to.name}</div>
        {partial ? (
          <div className="mt8">
            <span className="num tnum mx-auto">
              <input
                inputMode="numeric"
                value={partialText}
                onChange={(e) => {
                  const parsed = parseVnd(e.target.value);
                  setPartialText(
                    e.target.value.trim() === ""
                      ? ""
                      : parsed === null
                        ? e.target.value
                        : parsed.toLocaleString("vi-VN"),
                  );
                }}
                aria-label={`Số tiền chuyển cho ${to.name}`}
                autoFocus
              />
              <span className="unit">đ</span>
            </span>
            <p className="t12 m mt6">
              {payingValid
                ? `Còn lại ${formatVnd(amount - paying)}`
                : `Nhập số từ 1đ đến ${formatVnd(amount)}`}
            </p>
            <button
              className="ghost mt10"
              onClick={() => {
                setPartial(false);
                setPartialText(amount.toLocaleString("vi-VN"));
              }}
            >
              Trả trọn {formatVnd(amount)}
            </button>
          </div>
        ) : (
          <>
            <div className="text-[30px] font-medium tracking-[-.5px] mt4 tnum">
              {formatVnd(amount)}
            </div>
            <button className="ghost mt10" onClick={() => setPartial(true)}>
              Trả một phần
            </button>
          </>
        )}

        {qrUrl && to.bank ? (
          <>
            <div className="qr">
              {/* Ảnh tĩnh từ img.vietqr.io, không gọi API và không có khóa bí mật. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`Mã QR chuyển ${formatVnd(amount)} cho ${to.name}`}
                width={166}
                height={166}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="t14 mt14">
              {bankName(to.bank.code)} · {to.bank.account}
            </div>
            <div className="t13 m mt4">{to.bank.holder}</div>
            <div className="t13 m mt8">Nội dung: {memo}</div>

            {appLink && (
              // Quét QR bằng chính máy đang hiện QR thì không được, nên vẫn cần
              // đường mở thẳng app ngân hàng để gõ tay hoặc quét từ máy khác.
              <a
                className="btn green mt16"
                href={appLink}
                target="_blank"
                rel="noreferrer"
              >
                Mở app ngân hàng
              </a>
            )}
          </>
        ) : (
          <div className="mt16">
            <div className="blob">🏦</div>
            <p className="t14 m mt14 leading-[1.5]">
              {to.name} chưa điền tài khoản nhận tiền nên chưa dựng được mã QR.
            </p>
            <button className="ghost mt14" onClick={onNeedBank}>
              Điền giúp {to.name}
            </button>
          </div>
        )}

        {error && <p className="warn mt12">{error}</p>}

        {/* "Đánh dấu đã chuyển" cố tình nhẹ hơn nút chính — bấm nhầm là ghi sai số dư. */}
        <button
          className="ghost mt18 disabled:opacity-50"
          onClick={settle}
          disabled={pending || !payingValid}
        >
          {pending ? "Đang lưu…" : `Đánh dấu đã chuyển ${formatVnd(paying)}`}
        </button>
      </div>
    </>
  );
}
