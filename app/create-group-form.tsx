"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createGroup } from "./actions";
import { rememberIdentity } from "@/lib/identity";

/**
 * Màn 1 — tạo nhóm. Người tạo gõ tên nhóm rồi thả tên từng người vào ô chip.
 * Không có bước đăng nhập nào ở đây và sẽ không bao giờ có.
 */
export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draftRef = useRef<HTMLInputElement>(null);

  function addPerson(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (value.length > 40) {
      setError("Tên dài quá 40 ký tự");
      return;
    }
    setPeople((list) => [...list, value]);
    setDraft("");
    setError(null);
  }

  function onDraftKey(event: React.KeyboardEvent<HTMLInputElement>) {
    // Ô trống mà đã có người trong nhóm: Enter để nguyên cho form gửi đi,
    // không chặn — gõ xong tên cuối rồi Enter hai cái là tạo được nhóm.
    if (event.key === "Enter" && !draft.trim()) return;

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addPerson(draft);
    } else if (event.key === "Backspace" && draft === "" && people.length) {
      setPeople((list) => list.slice(0, -1));
    }
  }

  function submit() {
    // Tên còn trong ô nhập vẫn tính — không ai nghĩ mình phải bấm Enter lần cuối.
    const names = draft.trim() ? [...people, draft.trim()] : people;

    if (!name.trim()) {
      setError("Tên nhóm không được để trống");
      return;
    }
    if (names.length === 0) {
      setError("Thêm ít nhất một người vào nhóm");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createGroup({ name, memberNames: names });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Người tạo chưa chọn tên mình — màn 2 sẽ hỏi ngay khi mở link.
      rememberIdentity(result.data.slug, null);
      router.push(`/g/${result.data.slug}`);
    });
  }

  return (
    <form
      className="px-[18px] pb-[18px]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="lbl block" htmlFor="group-name">
        Tên nhóm
      </label>
      <input
        id="group-name"
        className="field white mt6"
        value={name}
        onChange={(e) => setName(e.target.value)}
        // Enter ở ô tên nhóm: chưa có ai trong nhóm thì nhảy sang ô thành viên,
        // vì tạo nhóm rỗng chắc chắn lỗi. Có rồi thì gửi luôn.
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (people.length === 0 && !draft.trim()) {
            e.preventDefault();
            draftRef.current?.focus();
          }
        }}
        placeholder="Đà Lạt 3N2Đ"
        maxLength={60}
        autoComplete="off"
      />

      <div className="lbl mt16">Thành viên</div>
      <div
        className="field white mt6 p-[10px] cursor-text"
        onClick={() => draftRef.current?.focus()}
      >
        <div className="chips">
          {people.map((person, index) => (
            <span key={`${person}-${index}`} className="chip tag">
              {person}
              <button
                type="button"
                aria-label={`Bỏ ${person}`}
                className="m px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setPeople((list) => list.filter((_, i) => i !== index));
                }}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            ref={draftRef}
            className="t13 py-[5px] px-1 bg-transparent outline-none min-w-[130px] flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            onBlur={() => addPerson(draft)}
            placeholder="Gõ tên rồi Enter"
            aria-label="Thêm thành viên"
            autoComplete="off"
          />
        </div>
      </div>
      <p className="t12 m mt8">Thêm cả tên bạn. Ai thiếu thì bổ sung sau cũng được.</p>

      {error && <p className="warn mt12">{error}</p>}

      <button className="btn mt18" type="submit" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo nhóm"}
      </button>
    </form>
  );
}
