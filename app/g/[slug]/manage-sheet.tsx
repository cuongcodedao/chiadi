"use client";

import { useState, useTransition } from "react";

import type { GroupData } from "@/db/queries";

import { addMember, removeMember, renameGroup, renameMember } from "../../actions";
import { useEscape } from "./use-escape";

/**
 * Sửa tên nhóm, sửa và xóa thành viên.
 * Gõ nhầm tên bạn mình lúc tạo nhóm là chuyện gặp ngay ngày đầu — sống chung
 * với nó cả chuyến thì vô lý.
 */
export function ManageSheet({
  group,
  meId,
  onClose,
  onSaved,
}: {
  group: GroupData;
  meId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEscape(onClose);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Không lưu được");
      else onSaved();
    });
  }

  function saveGroupName() {
    if (!name.trim() || name.trim() === group.name) return;
    run(() => renameGroup({ slug: group.slug, actorId: meId, name }));
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Sửa nhóm">
        <div className="grab" />
        <div className="flex justify-between items-center">
          <span className="text-[17px] font-medium">Sửa nhóm</span>
          <button className="m text-[18px] px-2" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <label className="lbl block mt16" htmlFor="group-rename">
          Tên nhóm
        </label>
        <div className="inl mt6">
          <input
            id="group-rename"
            className="field grow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveGroupName()}
            maxLength={60}
            autoComplete="off"
          />
          <button
            className="tap accent"
            onClick={saveGroupName}
            disabled={pending || !name.trim() || name.trim() === group.name}
          >
            Lưu
          </button>
        </div>

        <div className="lbl mt16">Thành viên</div>
        <div className="stack mt8">
          {group.members.map((member) => (
            <MemberRow
              key={member.id}
              slug={group.slug}
              meId={meId}
              member={member}
              canRemove={group.members.length > 1}
              onDone={onSaved}
              onError={setError}
            />
          ))}
        </div>

        <div className="inl mt12">
          <input
            className="field grow"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !draft.trim()) return;
              run(() => addMember({ slug: group.slug, name: draft, actorId: meId }));
              setDraft("");
            }}
            placeholder="Thêm người mới"
            maxLength={40}
            autoComplete="off"
            aria-label="Thêm thành viên"
          />
          <button
            className="tap accent"
            disabled={pending || !draft.trim()}
            onClick={() => {
              run(() => addMember({ slug: group.slug, name: draft, actorId: meId }));
              setDraft("");
            }}
          >
            Thêm
          </button>
        </div>

        {error && <p className="warn mt12">{error}</p>}

        <p className="t12 m mt12 leading-[1.5]">
          Người đã có khoản chi thì không xóa được — sửa hoặc xóa khoản đó trước,
          nếu không tổng tiền của nhóm sẽ lệch.
        </p>
      </div>
    </>
  );
}

function MemberRow({
  slug,
  meId,
  member,
  canRemove,
  onDone,
  onError,
}: {
  slug: string;
  meId: string;
  member: { id: string; name: string };
  canRemove: boolean;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(member.name);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = name.trim().length > 0 && name.trim() !== member.name;

  function rename() {
    if (!changed) return;
    onError(null);
    startTransition(async () => {
      const result = await renameMember({
        slug,
        actorId: meId,
        memberId: member.id,
        name,
      });
      if (!result.ok) onError(result.error);
      else onDone();
    });
  }

  function remove() {
    onError(null);
    startTransition(async () => {
      const result = await removeMember({ slug, actorId: meId, memberId: member.id });
      if (!result.ok) {
        onError(result.error);
        setConfirming(false);
      } else onDone();
    });
  }

  return (
    <div className="inl">
      <input
        className="field grow"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && rename()}
        maxLength={40}
        autoComplete="off"
        aria-label={`Tên của ${member.name}`}
      />
      {changed ? (
        <button className="tap accent" onClick={rename} disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
      ) : confirming ? (
        <>
          <button className="tap" onClick={() => setConfirming(false)} disabled={pending}>
            Giữ
          </button>
          <button
            className="tap"
            style={{ color: "var(--color-warn)" }}
            onClick={remove}
            disabled={pending}
          >
            {pending ? "Đang xóa…" : "Xóa hẳn"}
          </button>
        </>
      ) : (
        canRemove && (
          <button
            className="tap"
            onClick={() => setConfirming(true)}
            aria-label={`Xóa ${member.name} khỏi nhóm`}
          >
            Xóa
          </button>
        )
      )}
    </div>
  );
}
